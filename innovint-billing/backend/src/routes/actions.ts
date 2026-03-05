import { Router, Request, Response } from 'express';
import { BillingRequest, BillingResponse, ProgressEvent, RateRule, SessionData } from '../types';
import { fetchAllActions, getMonthDateRange } from '../services/innovintApi';
import { processActions } from '../services/actionProcessor';
import { applyRateMapping } from '../services/rateMapper';
import { runBulkInventory } from '../services/bulkInventory';
import { runBarrelInventory } from '../services/barrelInventory';
import { generateExcel } from '../services/excelExport';
import { loadSettings } from '../persistence';

const router = Router();

// In-memory session store
export const sessions = new Map<string, SessionData>();

// SSE clients for progress streaming (exported for reuse by fruit intake routes)
export const sseClients = new Map<string, Response>();

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function emitProgress(sessionId: string, event: ProgressEvent): void {
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

// SSE endpoint for billing progress
router.get('/billing-progress', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  sseClients.set(sessionId, res);

  req.on('close', () => {
    sseClients.delete(sessionId);
  });
});

// Main billing endpoint
router.post('/run-billing', async (req: Request, res: Response) => {
  const body = req.body as BillingRequest;
  const { month, year, rateRules, steps } = body;
  const settings = await loadSettings();

  if (!settings.token || !settings.wineryId) {
    res.status(400).json({ error: 'Token and Winery ID must be configured in Settings.' });
    return;
  }

  const sessionId = generateSessionId();
  res.json({ sessionId });

  // Use rules from request body, falling back to saved rules
  const rules = rateRules || settings.rateRules || [];

  runBillingPipeline(sessionId, settings.token, settings.wineryId, month, year, rules, steps);
});

// Get billing results
router.get('/billing-results', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No results found for this session.' });
    return;
  }
  res.json(session.billingResult);
});

// Excel export
router.get('/export-excel', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No results found for this session.' });
    return;
  }

  try {
    const currentSettings = await loadSettings();
    const fruitIntakeRecords = currentSettings.fruitIntake?.records || [];
    const billingMonth = req.query.billingMonth as string | undefined;

    const buffer = await generateExcel(
      session.billingResult.actions,
      session.billingResult.bulkInventory,
      session.billingResult.auditRows,
      session.billingResult.barrelInventory,
      fruitIntakeRecords,
      billingMonth
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=innovint-billing.xlsx');
    res.send(buffer);
  } catch {
    res.status(500).json({ error: 'Failed to generate Excel file.' });
  }
});

async function runBillingPipeline(
  sessionId: string,
  token: string,
  wineryId: string,
  month: string,
  year: number,
  rateRules: RateRule[],
  steps: string[]
): Promise<void> {
  const result: BillingResponse = {
    actions: [],
    auditRows: [],
    bulkInventory: [],
    barrelInventory: [],
    summary: { totalActions: 0, totalBilled: 0, auditCount: 0, bulkLots: 0, barrelOwners: 0 },
  };

  const onProgress = (event: ProgressEvent) => emitProgress(sessionId, event);

  try {
    // Step 1 + 2: Actions + Rate Mapping
    if (steps.includes('actions')) {
      onProgress({ step: 'actions', message: 'Starting action pipeline...', pct: 0 });

      const { start, end } = getMonthDateRange(month, year);
      const rawActions = await fetchAllActions(wineryId, token, start, end, onProgress);

      onProgress({ step: 'actions', message: 'Processing actions...', pct: 35 });
      const actionRows = processActions(rawActions);

      onProgress({ step: 'rates', message: 'Matching rate rules to actions...', pct: 40 });
      const { matched, auditRows } = applyRateMapping(actionRows, rateRules);

      result.actions = matched;
      result.auditRows = auditRows;
      result.summary.totalActions = matched.length;
      result.summary.totalBilled = matched
        .filter((r) => r.matched)
        .reduce((sum, r) => sum + r.total, 0);
      result.summary.auditCount = auditRows.length;

      onProgress({
        step: 'rates',
        message: `Rate mapping complete. ${matched.filter((r) => r.matched).length} matched, ${auditRows.length} unmatched.`,
        pct: 55,
      });
    }

    // Step 3: Bulk Inventory
    if (steps.includes('bulk')) {
      try {
        onProgress({ step: 'bulk', message: 'Starting bulk inventory billing...', pct: 60 });

        result.bulkInventory = await runBulkInventory(
          wineryId,
          token,
          month,
          year,
          rateRules,
          onProgress
        );
        result.summary.bulkLots = result.bulkInventory.length;
      } catch (err) {
        onProgress({
          step: 'bulk',
          message: `WARNING: Bulk inventory step failed: ${err instanceof Error ? err.message : 'Unknown error'}. Step skipped.`,
          pct: -1,
        });
      }
    }

    // Step 4: Barrel Inventory
    if (steps.includes('barrels')) {
      try {
        onProgress({ step: 'barrels', message: 'Starting barrel inventory billing...', pct: 60 });
        const currentSettings = await loadSettings();
        const barrelSnapshots = currentSettings.barrelSnapshots ?? { snap1Day: 1, snap2Day: 15, snap3Day: 'last' as const };

        result.barrelInventory = await runBarrelInventory(
          wineryId,
          token,
          month,
          year,
          rateRules,
          barrelSnapshots,
          onProgress
        );
        result.summary.barrelOwners = result.barrelInventory.length;
      } catch (err) {
        onProgress({
          step: 'barrels',
          message: `WARNING: Barrel inventory step failed: ${err instanceof Error ? err.message : 'Unknown error'}. Step skipped.`,
          pct: -1,
        });
      }
    }

    sessions.set(sessionId, { billingResult: result });
    onProgress({ step: 'complete', message: 'Billing run complete!', pct: 100 });
  } catch (err) {
    onProgress({
      step: 'error',
      message: `Fatal error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      pct: -1,
    });
  }
}

export default router;
