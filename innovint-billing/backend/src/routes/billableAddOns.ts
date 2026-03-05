import { Router, Request, Response } from 'express';
import { loadSettings, saveSettings } from '../persistence';
import { BillableAddOn } from '../types';

const router = Router();

// GET /api/billable-add-ons — return all add-on rows
router.get('/', async (_req: Request, res: Response) => {
  const settings = await loadSettings();
  res.json(settings.billableAddOns);
});

// POST /api/billable-add-ons — add a new row
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Omit<BillableAddOn, 'id'>;
  const settings = await loadSettings();

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
  await saveSettings(settings);
  res.json(settings.billableAddOns);
});

// DELETE /api/billable-add-ons/clear-month/:yearMonth — remove all rows for a given month
router.delete('/clear-month/:yearMonth', async (req: Request, res: Response) => {
  const { yearMonth } = req.params; // e.g. "2026-02"
  const settings = await loadSettings();
  settings.billableAddOns = settings.billableAddOns.filter((a) => !a.date.startsWith(yearMonth));
  await saveSettings(settings);
  res.json(settings.billableAddOns);
});

// DELETE /api/billable-add-ons/:id — remove a row by ID
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const settings = await loadSettings();
  settings.billableAddOns = settings.billableAddOns.filter((a) => a.id !== id);
  await saveSettings(settings);
  res.json(settings.billableAddOns);
});

export default router;
