import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../persistence';
import { emitProgress, generateSessionId } from './actions';
import { runFruitIntake, recalculateRecord, recalculateRecordWithProgram } from '../services/fruitIntakeService';

const router = Router();

// POST /api/fruit-intake/run — run fruit intake fetch and processing
router.post('/run', async (req: Request, res: Response) => {
  const settings = await loadSettings();

  if (!settings.token || !settings.wineryId) {
    res.status(400).json({ error: 'Token and Winery ID must be configured in Settings.' });
    return;
  }

  // Derive customerMap from unified customers[]
  const customerMap: Record<string, string> = Object.fromEntries(
    settings.customers.filter(c => c.ownerName && c.code).map(c => [c.ownerName, c.code])
  );

  const sessionId = generateSessionId();
  res.json({ sessionId });

  // Run asynchronously
  const onProgress = (event: { step: string; message: string; pct: number }) =>
    emitProgress(sessionId, event);

  try {
    const existingRecords = settings.fruitIntake?.records || [];

    const result = await runFruitIntake(
      settings.wineryId,
      settings.token,
      settings.fruitIntakeSettings,
      customerMap,
      existingRecords,
      onProgress
    );

    // Save result to config
    const current = await loadSettings();
    current.fruitIntake = result;
    await saveSettings(current);

    onProgress({ step: 'complete', message: 'Fruit intake run complete!', pct: 100 });
  } catch (err) {
    onProgress({
      step: 'error',
      message: `Fatal error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      pct: -1,
    });
  }
});

// GET /api/fruit-intake/saved — get saved fruit intake data
router.get('/saved', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json(settings.fruitIntake || null);
});

// DELETE /api/fruit-intake/saved — clear saved fruit intake data
router.delete('/saved', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  settings.fruitIntake = null;
  await saveSettings(settings);
  res.json({ success: true });
});

// PUT /api/fruit-intake/records/:recordId — update contract length, program, rate, or small lot fee
router.put('/records/:recordId', async (req: Request, res: Response) => {
  const { recordId } = req.params;
  const { contractLengthMonths, programId, contractRatePerTon, smallLotFee } = req.body as {
    contractLengthMonths?: number;
    programId?: string;
    contractRatePerTon?: number;
    smallLotFee?: number;
  };

  if (contractLengthMonths !== undefined && (typeof contractLengthMonths !== 'number' || contractLengthMonths < 0)) {
    res.status(400).json({ error: 'contractLengthMonths must be a non-negative number' });
    return;
  }

  const settings = await loadSettings();
  const fruitIntake = settings.fruitIntake;

  if (!fruitIntake || !fruitIntake.records) {
    res.status(404).json({ error: 'No fruit intake data found' });
    return;
  }

  const idx = fruitIntake.records.findIndex((r: { id: string }) => r.id === recordId);
  if (idx === -1) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  const programs = settings.fruitIntakeSettings?.programs || [];
  const minProcessingFee = settings.fruitIntakeSettings?.minProcessingFee || 0;
  let record = fruitIntake.records[idx];

  // Apply direct field overrides first
  if (contractRatePerTon !== undefined) {
    record = { ...record, contractRatePerTon };
  }
  if (smallLotFee !== undefined) {
    record = { ...record, smallLotFee };
  }

  // Apply program change (sets rate)
  if (programId !== undefined) {
    record = recalculateRecordWithProgram(record, programId, programs, minProcessingFee);
  }

  // Recalculate totals with current or new contract length
  const months = contractLengthMonths ?? record.contractLengthMonths;
  record = recalculateRecord(record, months, minProcessingFee);

  fruitIntake.records[idx] = record;
  settings.fruitIntake = fruitIntake;
  await saveSettings(settings);

  res.json(fruitIntake);
});

// GET /api/fruit-intake/debug-lots — test lotsModular API directly
router.get('/debug-lots', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  if (!settings.token || !settings.wineryId) {
    res.status(400).json({ error: 'Token and Winery ID must be configured.' });
    return;
  }

  const vintage = 2025;
  const url = `https://sutter.innovint.us/wineries/${settings.wineryId}/lotsModular?fruitLot=true&includeFullLot=true&includeIntendedUseAllocations=true&includeWorkOrders=true&minComponentPercent=-1&offset=0&sort=lotCode:1&vintages=${vintage}&size=5`;

  try {
    const apiRes = await fetch(url, {
      headers: {
        'Authorization': `Access-Token ${settings.token}`,
        'Accept': 'application/json',
      },
    });

    const status = apiRes.status;
    const body = await apiRes.text();

    // Parse to extract lot codes and tags
    let summary: unknown[] = [];
    try {
      const data = JSON.parse(body);
      if (Array.isArray(data)) {
        summary = data.map((item: Record<string, unknown>) => ({
          lotCode: (item as { lotCode?: string }).lotCode,
          tags: (item as { tags?: unknown[] }).tags,
          accessOwners: ((item as { access?: { owners?: unknown[] } }).access?.owners),
          topLevelKeys: Object.keys(item),
        }));
      } else {
        summary = [{ notArray: true, topLevelKeys: typeof data === 'object' && data ? Object.keys(data) : typeof data }];
      }
    } catch { /* raw body will show */ }

    res.json({ status, lotCount: summary.length, lots: summary, rawBodyPreview: body.slice(0, 500) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
