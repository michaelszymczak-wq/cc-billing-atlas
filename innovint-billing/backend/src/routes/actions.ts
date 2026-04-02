import { Router, Request, Response } from 'express';
import { ActionRow, AuditRow, BillingRequest, BillingResponse, ProgressEvent, RateRule, SessionData } from '../types';
import { fetchAllActions, fetchInventorySnapshot, getMonthDateRange } from '../services/innovintApi';
import { processActions, enrichCustomActionVolumes } from '../services/actionProcessor';
import { applyRateMapping } from '../services/rateMapper';
import { runBulkInventory } from '../services/bulkInventory';
import { runBarrelInventory } from '../services/barrelInventory';
import { generateExcel } from '../services/excelExport';
import { loadSettings, saveSessionResult, loadSessionResult } from '../persistence';

const router = Router();

// In-memory session store
export const sessions = new Map<string, SessionData>();

// SSE clients for progress streaming (exported for reuse by fruit intake routes)
export const sseClients = new Map<string, Response>();

// Progress event store for polling (in-memory)
export const progressStore = new Map<string, ProgressEvent[]>();

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function emitProgress(sessionId: string, event: ProgressEvent): void {
  // Store for polling
  if (!progressStore.has(sessionId)) {
    progressStore.set(sessionId, []);
  }
  progressStore.get(sessionId)!.push(event);

  // Also emit to SSE client if connected (local dev)
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

// Polling endpoint for billing progress
router.get('/billing-progress-poll', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const after = parseInt(req.query.after as string) || 0;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }
  const events = progressStore.get(sessionId) || [];
  const newEvents = events.slice(after);
  res.json({ events: newEvents, total: events.length });
});

// SSE endpoint for billing progress (kept for local dev)
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
router.get('/billing-results', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  let session = sessions.get(sessionId);
  if (!session?.billingResult) {
    // Try Firestore
    const stored = await loadSessionResult(sessionId);
    if (stored?.billingResult) {
      sessions.set(sessionId, stored); // populate cache
      session = stored;
    }
  }
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No results found for this session.' });
    return;
  }
  res.json(session.billingResult);
});

// Rectify an audit row — persist to session so exports reflect changes
router.post('/rectify', async (req: Request, res: Response) => {
  const { sessionId, auditIndex, actionRow } = req.body as {
    sessionId: string;
    auditIndex: number;
    actionRow: ActionRow;
  };

  let session = sessions.get(sessionId);
  if (!session?.billingResult) {
    const stored = await loadSessionResult(sessionId);
    if (stored?.billingResult) {
      sessions.set(sessionId, stored);
      session = stored;
    }
  }
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No results found for this session.' });
    return;
  }

  const br = session.billingResult;

  // Replace the original unmatched row in actions (same actionId), or append
  const existingIdx = br.actions.findIndex(
    (r) => r.actionId === actionRow.actionId && !r.matched
  );
  if (existingIdx >= 0) {
    br.actions[existingIdx] = actionRow;
  } else {
    br.actions.push(actionRow);
  }

  // Remove from audit rows
  br.auditRows = br.auditRows.filter((_, i) => i !== auditIndex);

  // Update summary
  br.summary.totalBilled = br.actions
    .filter((r) => r.matched)
    .reduce((sum, r) => sum + r.total, 0);
  br.summary.totalActions = br.actions.length;
  br.summary.auditCount = br.auditRows.length;

  // Persist to Firestore if enabled
  saveSessionResult(sessionId, session).catch(() => {});

  res.json({ success: true });
});

// Excel export
router.get('/export-excel', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  let session = sessions.get(sessionId);
  if (!session?.billingResult) {
    const stored = await loadSessionResult(sessionId);
    if (stored?.billingResult) {
      sessions.set(sessionId, stored);
      session = stored;
    }
  }
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
    res.setHeader('Content-Disposition', 'attachment; filename=cc-billing-atlas.xlsx');
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

      await enrichCustomActionVolumes(actionRows, wineryId, token, onProgress);

      // Fetch all-inclusive lot codes from inventory snapshot (if any rules use excludeAllInclusive)
      // Logic: lots WITHOUT an "Out of Program" tag are considered all-inclusive
      let allInclusiveLotCodes = new Set<string>();
      const hasAllInclusiveRules = rateRules.some((r) => r.enabled && r.excludeAllInclusive);
      if (hasAllInclusiveRules) {
        onProgress({ step: 'rates', message: "Checking lot tags for 'OOP'...", pct: 38 });
        const snapshot = await fetchInventorySnapshot(wineryId, token, end);
        const outOfProgramLotCodes = new Set<string>();
        for (const item of snapshot) {
          if (item.lot?.lotCode) {
            allInclusiveLotCodes.add(item.lot.lotCode);
            if (item.tags?.some((tag) => /^oop$/i.test(tag))) {
              outOfProgramLotCodes.add(item.lot.lotCode);
            }
          }
        }
        // Remove "Out of Program" lots — they are billable, not all-inclusive
        for (const code of outOfProgramLotCodes) {
          allInclusiveLotCodes.delete(code);
        }
        onProgress({
          step: 'rates',
          message: `Found ${allInclusiveLotCodes.size} all-inclusive lot(s) (${outOfProgramLotCodes.size} "OOP").`,
          pct: 39,
        });
      }

      onProgress({ step: 'rates', message: 'Matching rate rules to actions...', pct: 40 });

      // Log rules with freeFirstPerLot for debugging
      const freeFirstRules = rateRules.filter((r) => r.freeFirstPerLot && r.enabled);
      if (freeFirstRules.length > 0) {
        onProgress({
          step: 'rates',
          message: `"First included" rules: ${freeFirstRules.map((r) => r.label).join(', ')}`,
          pct: -1,
        });
      }

      const { matched, auditRows } = applyRateMapping(actionRows, rateRules, allInclusiveLotCodes);

      // Log freeFirstPerLot results
      const includedRows = matched.filter((r) => r.matchedRuleLabel.includes('(Included)'));
      if (freeFirstRules.length > 0) {
        if (includedRows.length > 0) {
          onProgress({
            step: 'rates',
            message: `"First included" applied to ${includedRows.length} row(s): ${includedRows.slice(0, 5).map((r) => `${r.actionType}/${r.analysisOrNotes} on ${r.lotCodes.substring(0, 30)}`).join('; ')}${includedRows.length > 5 ? '...' : ''}`,
            pct: -1,
          });
        } else {
          onProgress({
            step: 'rates',
            message: `WARNING: ${freeFirstRules.length} "First included" rule(s) enabled but 0 rows were marked as included. Check that rule variations match the action data.`,
            pct: -1,
          });
        }
      }

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

        const bulkSettings = await loadSettings();
        result.bulkInventory = await runBulkInventory(
          wineryId,
          token,
          month,
          year,
          bulkSettings.bulkStorageRate,
          onProgress,
          bulkSettings.bulkStorageMinimum
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

    const sessionData: SessionData = { billingResult: result };
    sessions.set(sessionId, sessionData);
    await saveSessionResult(sessionId, sessionData);
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
