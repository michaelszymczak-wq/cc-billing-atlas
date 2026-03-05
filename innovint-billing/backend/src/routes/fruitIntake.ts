import { Router, Request, Response } from 'express';
import { loadSettings } from './settings';
import { sseClients, emitProgress, generateSessionId } from './actions';
import { runFruitIntake, recalculateRecord } from '../services/fruitIntakeService';

const router = Router();

import * as fs from 'fs';
import { CONFIG_PATH } from '../config';

function saveConfig(settings: ReturnType<typeof loadSettings>): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// POST /api/fruit-intake/run — run fruit intake fetch and processing
router.post('/run', async (req: Request, res: Response) => {
  const settings = loadSettings();

  if (!settings.token || !settings.wineryId) {
    res.status(400).json({ error: 'Token and Winery ID must be configured in Settings.' });
    return;
  }

  const { customerMap } = req.body as { customerMap?: Record<string, string> };

  // If customer map was provided, save it first
  if (customerMap) {
    settings.customerMap = customerMap;
    saveConfig(settings);
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
    const current = loadSettings();
    current.fruitIntake = result;
    saveConfig(current);

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
router.get('/saved', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings.fruitIntake || null);
});

// DELETE /api/fruit-intake/saved — clear saved fruit intake data
router.delete('/saved', (_req: Request, res: Response) => {
  const settings = loadSettings();
  settings.fruitIntake = null;
  saveConfig(settings);
  res.json({ success: true });
});

// PUT /api/fruit-intake/records/:recordId — update contract length and recalculate
router.put('/records/:recordId', (req: Request, res: Response) => {
  const { recordId } = req.params;
  const { contractLengthMonths } = req.body as { contractLengthMonths: number };

  if (typeof contractLengthMonths !== 'number' || contractLengthMonths < 0) {
    res.status(400).json({ error: 'contractLengthMonths must be a non-negative number' });
    return;
  }

  const settings = loadSettings();
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
  saveConfig(settings);

  res.json(fruitIntake);
});

export default router;
