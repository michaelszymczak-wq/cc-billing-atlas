import { Router, Request, Response } from 'express';
import { AppSettings, BarrelSnapshots, BillableAddOn, CustomerRecord, FruitIntakeSettings, RateRule } from '../types';
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
    bulkStorageRate: settings.bulkStorageRate,
    bulkStorageMinimum: settings.bulkStorageMinimum,
    customers: settings.customers,
    fruitIntakeSettings: settings.fruitIntakeSettings,
    billableAddOns: settings.billableAddOns,
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
    bulkStorageRate: (body as Record<string, unknown>).bulkStorageRate !== undefined ? (body as Record<string, unknown>).bulkStorageRate as number : current.bulkStorageRate,
    bulkStorageMinimum: (body as Record<string, unknown>).bulkStorageMinimum !== undefined ? (body as Record<string, unknown>).bulkStorageMinimum as number : current.bulkStorageMinimum,
    fruitIntake: current.fruitIntake,
    customers: (body as Record<string, unknown>).customers !== undefined ? (body as Record<string, unknown>).customers as CustomerRecord[] : current.customers,
    fruitIntakeSettings: (body as Record<string, unknown>).fruitIntakeSettings !== undefined ? (body as Record<string, unknown>).fruitIntakeSettings as FruitIntakeSettings : current.fruitIntakeSettings,
    billableAddOns: (body as Record<string, unknown>).billableAddOns !== undefined ? (body as Record<string, unknown>).billableAddOns as BillableAddOn[] : current.billableAddOns,
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
    skipCurrentYearBarrels: body.skipCurrentYearBarrels ?? current.barrelSnapshots.skipCurrentYearBarrels,
    barrelRate: body.barrelRate ?? current.barrelSnapshots.barrelRate,
    puncheonRate: body.puncheonRate ?? current.barrelSnapshots.puncheonRate,
    tirageRate: body.tirageRate ?? current.barrelSnapshots.tirageRate,
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
    programs: body.programs ?? current.fruitIntakeSettings.programs,
    minProcessingFee: body.minProcessingFee ?? current.fruitIntakeSettings.minProcessingFee,
    defaultContractMonths: body.defaultContractMonths ?? current.fruitIntakeSettings.defaultContractMonths,
    smallLotFee: body.smallLotFee ?? current.fruitIntakeSettings.smallLotFee,
    smallLotThresholdTons: body.smallLotThresholdTons ?? current.fruitIntakeSettings.smallLotThresholdTons,
  };
  await saveSettings(current);
  res.json({ success: true, fruitIntakeSettings: current.fruitIntakeSettings });
});

// PUT /api/settings/customers — save unified customer records
router.put('/customers', async (req: Request, res: Response) => {
  const customers = req.body as CustomerRecord[];
  if (!Array.isArray(customers)) {
    res.status(400).json({ error: 'Expected an array of customer records.' });
    return;
  }
  const current = await loadSettings();
  current.customers = customers;
  await saveSettings(current);
  res.json({ success: true, count: customers.length });
});

export default router;
