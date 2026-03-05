import { Router, Request, Response } from 'express';
import { sessions } from './actions';
import { loadSettings } from './settings';
import { buildPreview, generateCSV, getShortMonthYear } from '../services/qbExport';
import { QBExportRecord } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const router = Router();
const CONFIG_PATH = path.join(os.homedir(), '.innovint-billing-config.json');

// POST /preview — generate preview data
router.post('/preview', (req: Request, res: Response) => {
  const { sessionId, month, year, excludedCustomers, enabledSources } = req.body as {
    sessionId: string;
    month: string;
    year: number;
    excludedCustomers?: string[];
    enabledSources?: { actions: boolean; barrel: boolean; bulk: boolean; fruitIntake: boolean; addOns: boolean };
  };

  const session = sessions.get(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
    return;
  }

  const settings = loadSettings();
  const qbSettings = settings.qbExportSettings;
  const excluded = excludedCustomers ?? qbSettings.excludedCustomers;
  const sources = enabledSources ?? qbSettings.enabledSources;
  const fruitRecords = settings.fruitIntake?.records || [];
  const addOns = settings.billableAddOns || [];

  const preview = buildPreview(
    session.billingResult.actions,
    session.billingResult.barrelInventory,
    session.billingResult.bulkInventory,
    fruitRecords,
    addOns,
    month,
    year,
    excluded,
    sources
  );

  res.json(preview);
});

// POST / — generate and download CSV
router.post('/', (req: Request, res: Response) => {
  const { sessionId, month, year, excludedCustomers, enabledSources } = req.body as {
    sessionId: string;
    month: string;
    year: number;
    excludedCustomers?: string[];
    enabledSources?: { actions: boolean; barrel: boolean; bulk: boolean; fruitIntake: boolean; addOns: boolean };
  };

  const session = sessions.get(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
    return;
  }

  const settings = loadSettings();
  const qbSettings = settings.qbExportSettings;
  const excluded = excludedCustomers ?? qbSettings.excludedCustomers;
  const sources = enabledSources ?? qbSettings.enabledSources;
  const fruitRecords = settings.fruitIntake?.records || [];
  const addOns = settings.billableAddOns || [];

  const preview = buildPreview(
    session.billingResult.actions,
    session.billingResult.barrelInventory,
    session.billingResult.bulkInventory,
    fruitRecords,
    addOns,
    month,
    year,
    excluded,
    sources
  );

  const csv = generateCSV(preview);
  const filename = `QB_Import_${getShortMonthYear(month, year)}.csv`;

  // Record in history (keep last 12)
  const record: QBExportRecord = {
    id: `qb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    exportedAt: new Date().toISOString(),
    month,
    year,
    customerCount: preview.customers.length,
    lineItemCount: preview.lineItemCount,
    totalAmount: preview.grandTotal,
    filename,
  };

  settings.qbExportHistory = [record, ...settings.qbExportHistory].slice(0, 12);

  // Save updated settings with new history
  if (excludedCustomers) settings.qbExportSettings.excludedCustomers = excludedCustomers;
  if (enabledSources) settings.qbExportSettings.enabledSources = enabledSources;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// GET /history — return export history
router.get('/history', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings.qbExportHistory);
});

export default router;
