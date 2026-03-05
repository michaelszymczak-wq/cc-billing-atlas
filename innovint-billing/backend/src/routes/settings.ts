import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { AppSettings, BarrelSnapshots, BillableAddOn, FruitIntakeSettings, QBExportSettings, RateRule } from '../types';
import { CONFIG_PATH } from '../config';

const router = Router();

function defaultSettings(): AppSettings {
  return {
    token: '',
    wineryId: '',
    rateRules: [],
    lastUsedMonth: 'January',
    lastUsedYear: new Date().getFullYear(),
    barrelSnapshots: { snap1Day: 1, snap2Day: 15, snap3Day: 'last' },
    fruitIntake: null,
    customerMap: {},
    billableAddOns: [],
    qbExportSettings: {
      excludedCustomers: ['ELE'],
      enabledSources: { actions: true, barrel: true, bulk: true, fruitIntake: true, addOns: true },
    },
    qbExportHistory: [],
    fruitIntakeSettings: {
      actionTypeKey: 'FRUITINTAKE',
      vintageLookback: 3,
      apiPageDelaySeconds: 5,
      contractLengthRules: [
        { color: 'red', varietal: '', months: 22 },
        { color: 'white', varietal: 'chardonnay', months: 12 },
        { color: 'white', varietal: '', months: 9 },
        { color: 'rosé', varietal: '', months: 9 },
        { color: 'rose', varietal: '', months: 9 },
        { color: 'orange', varietal: '', months: 9 },
      ],
      rates: [
        { vintage: 2026, contractMonths: 9, ratePerTon: 3100 },
        { vintage: 2026, contractMonths: 12, ratePerTon: 3150 },
        { vintage: 2026, contractMonths: 22, ratePerTon: 4600 },
        { vintage: 2025, contractMonths: 9, ratePerTon: 2950 },
        { vintage: 2025, contractMonths: 12, ratePerTon: 3150 },
        { vintage: 2025, contractMonths: 22, ratePerTon: 4600 },
        { vintage: 2024, contractMonths: 9, ratePerTon: 2800 },
        { vintage: 2024, contractMonths: 12, ratePerTon: 3000 },
        { vintage: 2024, contractMonths: 22, ratePerTon: 4300 },
      ],
    },
  };
}

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const defaults = defaultSettings();
      return {
        token: parsed.token ?? defaults.token,
        wineryId: parsed.wineryId ?? defaults.wineryId,
        rateRules: Array.isArray(parsed.rateRules) ? parsed.rateRules : defaults.rateRules,
        lastUsedMonth: parsed.lastUsedMonth ?? defaults.lastUsedMonth,
        lastUsedYear: parsed.lastUsedYear ?? defaults.lastUsedYear,
        barrelSnapshots: parsed.barrelSnapshots ?? defaults.barrelSnapshots,
        fruitIntake: parsed.fruitIntake ?? defaults.fruitIntake,
        customerMap: parsed.customerMap ?? defaults.customerMap,
        fruitIntakeSettings: parsed.fruitIntakeSettings ?? defaults.fruitIntakeSettings,
        billableAddOns: Array.isArray(parsed.billableAddOns) ? parsed.billableAddOns : defaults.billableAddOns,
        qbExportSettings: parsed.qbExportSettings ?? defaults.qbExportSettings,
        qbExportHistory: Array.isArray(parsed.qbExportHistory) ? parsed.qbExportHistory : defaults.qbExportHistory,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings();
}

function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings — return full config (token masked)
router.get('/', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json({
    token: settings.token ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '',
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
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<AppSettings>;
  const current = loadSettings();

  const updated: AppSettings = {
    token: body.token !== undefined && body.token !== '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? body.token : current.token,
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

  saveSettings(updated);
  res.json({ success: true, wineryId: updated.wineryId, hasToken: !!updated.token });
});

// GET /api/settings/rate-rules — get just rate rules
router.get('/rate-rules', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings.rateRules);
});

// PUT /api/settings/rate-rules — replace all rate rules
router.put('/rate-rules', (req: Request, res: Response) => {
  const rules = req.body as RateRule[];
  if (!Array.isArray(rules)) {
    res.status(400).json({ error: 'Expected an array of rate rules.' });
    return;
  }
  const current = loadSettings();
  current.rateRules = rules;
  saveSettings(current);
  res.json({ success: true, count: rules.length });
});

// PUT /api/settings/billing-prefs — save month/year preferences
router.put('/billing-prefs', (req: Request, res: Response) => {
  const { lastUsedMonth, lastUsedYear } = req.body as { lastUsedMonth?: string; lastUsedYear?: number };
  const current = loadSettings();
  if (lastUsedMonth !== undefined) current.lastUsedMonth = lastUsedMonth;
  if (lastUsedYear !== undefined) current.lastUsedYear = lastUsedYear;
  saveSettings(current);
  res.json({ success: true });
});

// PUT /api/settings/barrel-snapshots — save barrel snapshot day config
router.put('/barrel-snapshots', (req: Request, res: Response) => {
  const body = req.body as Partial<BarrelSnapshots>;
  const current = loadSettings();
  current.barrelSnapshots = {
    snap1Day: body.snap1Day ?? current.barrelSnapshots.snap1Day,
    snap2Day: body.snap2Day ?? current.barrelSnapshots.snap2Day,
    snap3Day: body.snap3Day ?? current.barrelSnapshots.snap3Day,
  };
  saveSettings(current);
  res.json({ success: true, barrelSnapshots: current.barrelSnapshots });
});

// PUT /api/settings/fruit-intake-settings — save fruit intake configuration
router.put('/fruit-intake-settings', (req: Request, res: Response) => {
  const body = req.body as Partial<FruitIntakeSettings>;
  const current = loadSettings();
  current.fruitIntakeSettings = {
    actionTypeKey: body.actionTypeKey ?? current.fruitIntakeSettings.actionTypeKey,
    vintageLookback: body.vintageLookback ?? current.fruitIntakeSettings.vintageLookback,
    apiPageDelaySeconds: body.apiPageDelaySeconds ?? current.fruitIntakeSettings.apiPageDelaySeconds,
    contractLengthRules: body.contractLengthRules ?? current.fruitIntakeSettings.contractLengthRules,
    rates: body.rates ?? current.fruitIntakeSettings.rates,
  };
  saveSettings(current);
  res.json({ success: true, fruitIntakeSettings: current.fruitIntakeSettings });
});

// PUT /api/settings/customer-map — save customer name→code mapping
router.put('/customer-map', (req: Request, res: Response) => {
  const customerMap = req.body as Record<string, string>;
  if (typeof customerMap !== 'object' || Array.isArray(customerMap)) {
    res.status(400).json({ error: 'Expected an object mapping customer names to codes.' });
    return;
  }
  const current = loadSettings();
  current.customerMap = customerMap;
  saveSettings(current);
  res.json({ success: true, count: Object.keys(customerMap).length });
});

export default router;
