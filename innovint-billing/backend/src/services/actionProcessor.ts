import { ActionApiItem, ActionRow } from '../types';

/**
 * Convert UTC date string to PST-formatted string: YYYY-MM-DD HH:mm
 */
export function convertDateToPST(dateStr: string): string {
  const date = new Date(dateStr);
  const pst = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const y = pst.getFullYear();
  const m = String(pst.getMonth() + 1).padStart(2, '0');
  const d = String(pst.getDate()).padStart(2, '0');
  const hh = String(pst.getHours()).padStart(2, '0');
  const mm = String(pst.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

/**
 * Get all notes text concatenated from the action's notes array.
 */
function getNotesText(action: ActionApiItem): string {
  if (!action.notes || !Array.isArray(action.notes)) return '';
  return action.notes.map((n) => n.text || '').join(' ');
}

/**
 * Get the action name. For CUSTOM actions it's in actionData.name,
 * for others it might be in workOrder.name.
 */
function getActionName(action: ActionApiItem): string {
  return action.actionData?.name || action.workOrder?.name || '';
}

/**
 * Extract owner code from action data.
 * Priority: actionData.lot.lotCode → analyses[0].lot.lotCode → drains → fills → involvedLots → vessel codes
 * From lot code: substring(4, 7)
 * From vessel code: substring(2, 5)
 */
export function extractOwnerCode(action: ActionApiItem): string {
  // Try actionData.lot
  const adLot = action.actionData?.lot;
  if (adLot?.lotCode && adLot.lotCode.length >= 7) {
    return adLot.lotCode.substring(4, 7);
  }

  // Try analyses lots
  if (action.actionData?.analyses) {
    for (const a of action.actionData.analyses) {
      if (a.lot?.lotCode && a.lot.lotCode.length >= 7) {
        return a.lot.lotCode.substring(4, 7);
      }
    }
    // Try analyses vessels
    for (const a of action.actionData.analyses) {
      if (a.vessel?.vesselCode && a.vessel.vesselCode.length >= 5) {
        return a.vessel.vesselCode.substring(2, 5);
      }
    }
  }

  // Try drains
  if (action.actionData?.drains) {
    for (const drain of action.actionData.drains) {
      if (drain.lot?.lotCode && drain.lot.lotCode.length >= 7) {
        return drain.lot.lotCode.substring(4, 7);
      }
    }
    for (const drain of action.actionData.drains) {
      if (drain.vessel?.vesselCode && drain.vessel.vesselCode.length >= 5) {
        return drain.vessel.vesselCode.substring(2, 5);
      }
    }
  }

  // Try fills
  if (action.actionData?.fills) {
    for (const fill of action.actionData.fills) {
      if (fill.lot?.lotCode && fill.lot.lotCode.length >= 7) {
        return fill.lot.lotCode.substring(4, 7);
      }
    }
    for (const fill of action.actionData.fills) {
      if (fill.vessel?.vesselCode && fill.vessel.vesselCode.length >= 5) {
        return fill.vessel.vesselCode.substring(2, 5);
      }
    }
  }

  // Try involvedLots
  if (action.actionData?.involvedLots) {
    for (const inv of action.actionData.involvedLots) {
      if (inv.lot?.lotCode && inv.lot.lotCode.length >= 7) {
        return inv.lot.lotCode.substring(4, 7);
      }
    }
    for (const inv of action.actionData.involvedLots) {
      if (inv.vessel?.vesselCode && inv.vessel.vesselCode.length >= 5) {
        return inv.vessel.vesselCode.substring(2, 5);
      }
    }
  }

  // Try actionData.vessels
  if (action.actionData?.vessels) {
    for (const v of action.actionData.vessels) {
      if (v.vesselCode && v.vesselCode.length >= 5) {
        return v.vesselCode.substring(2, 5);
      }
    }
  }

  return 'UNK';
}

/**
 * Extract all lot codes from an action — union of all sources, deduplicated.
 */
export function extractAllLotCodes(action: ActionApiItem): string {
  const codes = new Set<string>();

  if (action.actionData?.lot?.lotCode) {
    codes.add(action.actionData.lot.lotCode);
  }

  if (action.actionData?.analyses) {
    for (const a of action.actionData.analyses) {
      if (a.lot?.lotCode) codes.add(a.lot.lotCode);
    }
  }

  if (action.actionData?.drains) {
    for (const d of action.actionData.drains) {
      if (d.lot?.lotCode) codes.add(d.lot.lotCode);
    }
  }

  if (action.actionData?.fills) {
    for (const f of action.actionData.fills) {
      if (f.lot?.lotCode) codes.add(f.lot.lotCode);
    }
  }

  if (action.actionData?.involvedLots) {
    for (const inv of action.actionData.involvedLots) {
      if (inv.lot?.lotCode) codes.add(inv.lot.lotCode);
    }
  }

  return Array.from(codes).join(', ');
}

/**
 * Extract hours from notes/name for CUSTOM actions.
 */
function extractHours(text: string): number {
  // Pattern 1: billable hours: N
  const p1 = /billable\s+hours?\s*[:=]\s*(\d+(?:\.\d+)?)/i;
  const m1 = p1.exec(text);
  if (m1) return parseFloat(m1[1]);

  // Pattern 2: N hrs/hours at start
  const p2 = /^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:[^a-z]|$)/i;
  const m2 = p2.exec(text);
  if (m2) return parseFloat(m2[1]);

  return 1; // default
}

/**
 * Extract hours from notes text (for Billable CUSTOM actions where actionData.name contains "Billable").
 * Looks for patterns like "4.5 hours", "2 hrs", "Billable Hours: 3" anywhere in the text.
 */
function extractHoursFromNotes(text: string): number {
  // Pattern 1: billable hours: N
  const p1 = /billable\s+hours?\s*[:=]\s*(\d+(?:\.\d+)?)/i;
  const m1 = p1.exec(text);
  if (m1) return parseFloat(m1[1]);

  // Pattern 2: N hours/hrs anywhere in text
  const p2 = /(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:[^a-z]|$)/i;
  const m2 = p2.exec(text);
  if (m2) return parseFloat(m2[1]);

  return 1; // default
}

/**
 * Check if a CUSTOM action is a steam action.
 */
function isSteamAction(action: ActionApiItem): boolean {
  return action.actionType === 'CUSTOM' && /steam/i.test(getActionName(action));
}

/**
 * Process a steam action: split by vessel customer ID prefix, one row per customer with barrel count.
 */
function processSteamAction(action: ActionApiItem): ActionRow[] {
  const rows: ActionRow[] = [];
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const actionName = getActionName(action);

  // Group vessels by customerIdPrefix
  const customerMap = new Map<string, number>();
  const vessels = action.actionData?.vessels || [];
  const drains = action.actionData?.drains || [];
  const fills = action.actionData?.fills || [];

  for (const v of vessels) {
    const prefix = (v as Record<string, unknown>).customerIdPrefix as string || 'UNKNOWN';
    customerMap.set(prefix, (customerMap.get(prefix) || 0) + 1);
  }
  for (const d of drains) {
    const prefix = d.vessel?.customerIdPrefix || 'UNKNOWN';
    customerMap.set(prefix, (customerMap.get(prefix) || 0) + 1);
  }
  for (const f of fills) {
    const prefix = f.vessel?.customerIdPrefix || 'UNKNOWN';
    customerMap.set(prefix, (customerMap.get(prefix) || 0) + 1);
  }

  if (customerMap.size === 0) {
    rows.push({
      actionType: 'CUSTOM',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode: extractOwnerCode(action),
      analysisOrNotes: actionName || 'Steam',
      hours: 0,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
     matchedRuleLabel: '',
      rawActionType: 'CUSTOM',
      quantity: 0,
    });
  } else {
    for (const [prefix, count] of customerMap) {
      rows.push({
        actionType: 'CUSTOM',
        actionId: String(action._id),
        lotCodes,
        performer: action.performedBy?.name || '',
        date,
        ownerCode: prefix.length >= 3 ? prefix.substring(0, 3) : prefix,
        analysisOrNotes: `Steam - ${prefix} (${count} barrels)`,
        hours: 0,
        rate: 0,
        setupFee: 0,
        total: 0,
        matched: false,
       matchedRuleLabel: '',
        rawActionType: 'CUSTOM',
        quantity: count,
      });
    }
  }

  return rows;
}

/**
 * Process an ADDITION action: one row per additive with quantity, unit, vessel types.
 */
function processAdditionAction(action: ActionApiItem): ActionRow[] {
  const rows: ActionRow[] = [];
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);

  // Gather vessel types
  const vesselTypes = new Set<string>();
  const vessels = action.actionData?.vessels || [];
  for (const v of vessels) {
    if (v.vesselType) vesselTypes.add(v.vesselType);
  }
  const vesselTypeStr = Array.from(vesselTypes).join(', ');

  const additives = action.actionData?.additives;
  if (additives && additives.length > 0) {
    for (const additive of additives) {
      rows.push({
        actionType: 'ADDITION',
        actionId: String(action._id),
        lotCodes,
        performer: action.performedBy?.name || '',
        date,
        ownerCode,
        analysisOrNotes: additive.name,
        hours: 0,
        rate: 0,
        setupFee: 0,
        total: 0,
        matched: false,
       matchedRuleLabel: '',
        rawActionType: 'ADDITION',
        vesselTypes: vesselTypeStr,
        quantity: additive.quantity,
        unit: additive.unit,
      });
    }
  } else {
    const notesText = getNotesText(action);
    rows.push({
      actionType: 'ADDITION',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode,
      analysisOrNotes: notesText || getActionName(action) || 'Addition',
      hours: 0,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
      matchedRuleLabel: '',
      rawActionType: 'ADDITION',
      vesselTypes: vesselTypeStr,
    });
  }

  return rows;
}

/**
 * Process an ANALYSIS action:
 * - One row per individual analysis (no panel-name grouping)
 * - Skip brix/temp analyses
 * - Skip the entire action if any note contains "bond to bond transfer"
 */
function processAnalysisAction(action: ActionApiItem): ActionRow[] {
  // Skip entire action if any note contains "bond to bond transfer"
  const notesText = getNotesText(action);
  if (/bond to bond transfer/i.test(notesText)) {
    return [];
  }

  const rows: ActionRow[] = [];
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);

  const analyses = action.actionData?.analyses || [];
  for (const analysis of analyses) {
    const typeName = analysis.analysisType?.name || '';

    // Skip brix and temperature analyses
    if (/^(brix|temp(?:erature)?)$/i.test(typeName)) {
      continue;
    }

    rows.push({
      actionType: 'ANALYSIS',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode,
      analysisOrNotes: typeName,
      hours: 0,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
      matchedRuleLabel: '',
      rawActionType: 'ANALYSIS',
    });
  }

  return rows;
}

/**
 * Process a CUSTOM (non-steam) action.
 */
function processCustomAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);
  const actionName = getActionName(action);
  const notesText = getNotesText(action);
  const combined = [actionName, notesText].filter(Boolean).join(' ');

  // When actionData.name contains "Billable", parse hours from notes text first
  let hours: number;
  if (/billable/i.test(actionName) && notesText) {
    hours = extractHoursFromNotes(notesText);
  } else {
    hours = extractHours(combined);
  }

  return [{
    actionType: 'CUSTOM',
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: combined.trim(),
    hours,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: 'CUSTOM',
  }];
}

/**
 * Process a generic action (not ANALYSIS, CUSTOM, or ADDITION).
 */
function processGenericAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);
  const notesText = getNotesText(action);

  return [{
    actionType: action.actionType,
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: notesText || getActionName(action) || '',
    hours: 0,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: action.actionType,
  }];
}

/**
 * Main processor: route each action to its handler.
 */
export function processActions(actions: ActionApiItem[]): ActionRow[] {
  const allRows: ActionRow[] = [];

  for (const action of actions) {
    if (action.actionType === 'ANALYSIS') {
      allRows.push(...processAnalysisAction(action));
    } else if (action.actionType === 'CUSTOM' && isSteamAction(action)) {
      allRows.push(...processSteamAction(action));
    } else if (action.actionType === 'CUSTOM') {
      allRows.push(...processCustomAction(action));
    } else if (action.actionType === 'ADDITION') {
      allRows.push(...processAdditionAction(action));
    } else {
      allRows.push(...processGenericAction(action));
    }
  }

  return allRows;
}
