import { Router, Request, Response } from 'express';
import { AppSettings, BarrelSnapshots, BillableAddOn, FruitIntakeSettings, QBExportSettings, RateRule } from '../types';
import { loadSettings, saveSettings } from '../persistence';

const router = Router();

// GET /api/settings — return full config (token masked)
router.get('/', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json({
    token: settings.token ? '••••••••' : '',
    wineryId: settings.wineryId,
    hasToken: !!settings.token,
    rateRules: settings.rateRules,
    lastUsedMonth: settings.lastUsedMonth,
    lastUsedYear: settings.lastUsedYear,
    barrelSnapshots: settings.barrelSnapshots,
    customerMap: settings.customerMap,
    fruitIntakeSettings: settings.fruitIntakeSettings,
    billableAddOns: settings.billableAddOns,
    qbExportSettings: settings.qbExportSettings,
    qbExportHistory: settings.qbExportHistory,
  });
});

// POST /api/settings — save credentials
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Partial<AppSettings>;
  const current = await loadSettings();

  const updated: AppSettings = {
    token: body.token !== undefined && body.token !== '••••••••' ? body.token : current.token,
    wineryId: body.wineryId !== undefined ? body.wineryId : current.wineryId,
    rateRules: body.rateRules !== undefined ? body.rateRules : current.rateRules,
    lastUsedMonth: body.lastUsedMonth !== undefined ? body.lastUsedMonth : current.lastUsedMonth,
    lastUsedYear: body.lastUsedYear !== undefined ? body.lastUsedYear : current.lastUsedYear,
    barrelSnapshots: body.barrelSnapshots !== undefined ? body.barrelSnapshots : current.barrelSnapshots,
    fruitIntake: current.fruitIntake,
    customerMap: (body as Record<string, unknown>).customerMap !== undefined ? (body as Record<string, unknown>).customerMap as Record<string, string> : current.customerMap,
    fruitIntakeSettings: (body as Record<string, unknown>).fruitIntakeSettings !== undefined ? (body as Record<string, unknown>).fruitIntakeSettings as FruitIntakeSettings : current.fruitIntakeSettings,
    billableAddOns: (body as Record<string, unknown>).billableAddOns !== undefined ? (body as Record<string, unknown>).billableAddOns as BillableAddOn[] : current.billableAddOns,
    qbExportSettings: (body as Record<string, unknown>).qbExportSettings !== undefined ? (body as Record<string, unknown>).qbExportSettings as QBExportSettings : current.qbExportSettings,
    qbExportHistory: current.qbExportHistory,
  };

  await saveSettings(updated);
  res.json({ success: true, wineryId: updated.wineryId, hasToken: !!updated.token });
});

// GET /api/settings/rate-rules — get just rate rules
router.get('/rate-rules', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json(settings.rateRules);
});

// PUT /api/settings/rate-rules — replace all rate rules
router.put('/rate-rules', async (req: Request, res: Response) => {
  const rules = req.body as RateRule[];
  if (!Array.isArray(rules)) {
    res.status(400).json({ error: 'Expected an array of rate rules.' });
    return;
  }
  const current = await loadSettings();
  current.rateRules = rules;
  await saveSettings(current);
  res.json({ success: true, count: rules.length });
});

// PUT /api/settings/billing-prefs — save month/year preferences
router.put('/billing-prefs', async (req: Request, res: Response) => {
  const { lastUsedMonth, lastUsedYear } = req.body as { lastUsedMonth?: string; lastUsedYear?: number };
  const current = await loadSettings();
  if (lastUsedMonth !== undefined) current.lastUsedMonth = lastUsedMonth;
  if (lastUsedYear !== undefined) current.lastUsedYear = lastUsedYear;
  await saveSettings(current);
  res.json({ success: true });
});

// PUT /api/settings/barrel-snapshots — save barrel snapshot day config
router.put('/barrel-snapshots', async (req: Request, res: Response) => {
  const body = req.body as Partial<BarrelSnapshots>;
  const current = await loadSettings();
  current.barrelSnapshots = {
    snap1Day: body.snap1Day ?? current.barrelSnapshots.snap1Day,
    snap2Day: body.snap2Day ?? current.barrelSnapshots.snap2Day,
    snap3Day: body.snap3Day ?? current.barrelSnapshots.snap3Day,
  };
  await saveSettings(current);
  res.json({ success: true, barrelSnapshots: current.barrelSnapshots });
});

// PUT /api/settings/fruit-intake-settings — save fruit intake configuration
router.put('/fruit-intake-settings', async (req: Request, res: Response) => {
  const body = req.body as Partial<FruitIntakeSettings>;
  const current = await loadSettings();
  current.fruitIntakeSettings = {
    actionTypeKey: body.actionTypeKey ?? current.fruitIntakeSettings.actionTypeKey,
    vintageLookback: body.vintageLookback ?? current.fruitIntakeSettings.vintageLookback,
    apiPageDelaySeconds: body.apiPageDelaySeconds ?? current.fruitIntakeSettings.apiPageDelaySeconds,
    contractLengthRules: body.contractLengthRules ?? current.fruitIntakeSettings.contractLengthRules,
    rates: body.rates ?? current.fruitIntakeSettings.rates,
  };
  await saveSettings(current);
  res.json({ success: true, fruitIntakeSettings: current.fruitIntakeSettings });
});

// PUT /api/settings/customer-map — save customer name→code mapping
router.put('/customer-map', async (req: Request, res: Response) => {
  const customerMap = req.body as Record<string, string>;
  if (typeof customerMap !== 'object' || Array.isArray(customerMap)) {
    res.status(400).json({ error: 'Expected an object mapping customer names to codes.' });
    return;
  }
  const current = await loadSettings();
  current.customerMap = customerMap;
  await saveSettings(current);
  res.json({ success: true, count: Object.keys(customerMap).length });
});

export default router;
