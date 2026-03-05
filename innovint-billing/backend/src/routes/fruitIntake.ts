import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../persistence';
import { emitProgress, generateSessionId } from './actions';
import { runFruitIntake, recalculateRecord } from '../services/fruitIntakeService';

const router = Router();

// POST /api/fruit-intake/run — run fruit intake fetch and processing
router.post('/run', async (req: Request, res: Response) => {
  const settings = await loadSettings();

  if (!settings.token || !settings.wineryId) {
    res.status(400).json({ error: 'Token and Winery ID must be configured in Settings.' });
    return;
  }

  const { customerMap } = req.body as { customerMap?: Record<string, string> };

  // If customer map was provided, save it first
  if (customerMap) {
    settings.customerMap = customerMap;
    await saveSettings(settings);
  }

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
      settings.customerMap,
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

// PUT /api/fruit-intake/records/:recordId — update contract length and recalculate
router.put('/records/:recordId', async (req: Request, res: Response) => {
  const { recordId } = req.params;
  const { contractLengthMonths } = req.body as { contractLengthMonths: number };

  if (typeof contractLengthMonths !== 'number' || contractLengthMonths < 0) {
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

  const rates = settings.fruitIntakeSettings?.rates || [];
  fruitIntake.records[idx] = recalculateRecord(fruitIntake.records[idx], contractLengthMonths, rates);

  settings.fruitIntake = fruitIntake;
  await saveSettings(settings);

  res.json(fruitIntake);
});

export default router;
