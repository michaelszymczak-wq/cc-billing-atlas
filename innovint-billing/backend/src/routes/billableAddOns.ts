import { Router, Request, Response } from 'express';
import { loadSettings } from './settings';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BillableAddOn } from '../types';

const router = Router();
const CONFIG_PATH = path.join(os.homedir(), '.innovint-billing-config.json');

function saveSettings(settings: ReturnType<typeof loadSettings>): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/billable-add-ons — return all add-on rows
router.get('/', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings.billableAddOns);
});

// POST /api/billable-add-ons — add a new row
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Omit<BillableAddOn, 'id'>;
  const settings = loadSettings();

  const newAddOn: BillableAddOn = {
    id: `addon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    date: body.date,
    rateRuleId: body.rateRuleId,
    rateRuleLabel: body.rateRuleLabel,
    quantity: body.quantity,
    ownerCode: body.ownerCode,
    rate: body.rate,
    billingUnit: body.billingUnit,
    totalCost: body.totalCost,
    notes: body.notes,
  };

  settings.billableAddOns.push(newAddOn);
  saveSettings(settings);
  res.json(settings.billableAddOns);
});

// DELETE /api/billable-add-ons/:id — remove a row by ID
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const settings = loadSettings();
  settings.billableAddOns = settings.billableAddOns.filter((a) => a.id !== id);
  saveSettings(settings);
  res.json(settings.billableAddOns);
});

export default router;
