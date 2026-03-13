import { ActionApiItem, ActionRow, ProgressEvent } from '../types';
import { fetchLotVolume } from './innovintApi';

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
 * Uses lotAccess.owners[0].name from the API response.
 */
export function extractOwnerCode(action: ActionApiItem): string {
  return action.lotAccess?.owners?.[0]?.name || 'UNK';
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

  if (action.actionData?.lots) {
    for (const l of action.actionData.lots) {
      if (l.lot?.lotCode) codes.add(l.lot.lotCode);
    }
  }

  return Array.from(codes).join(', ');
}

/**
 * Extract hours from notes/name for CUSTOM actions.
 */
function extractHours(text: string): number {
  // Pattern 1: billable hours/hrs [:=]? N
  const p1 = /billable\s+(?:hours?|hrs?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i;
  const m1 = p1.exec(text);
  if (m1) return parseFloat(m1[1]);

  // Pattern 2: hours/hrs [:=] N (e.g. "Hours: 4.5")
  const p2 = /(?:hours?|hrs?)\s*[:=]\s*(\d+(?:\.\d+)?)/i;
  const m2 = p2.exec(text);
  if (m2) return parseFloat(m2[1]);

  // Pattern 3: N hrs/hours at start
  const p3 = /^(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:[^a-z]|$)/i;
  const m3 = p3.exec(text);
  if (m3) return parseFloat(m3[1]);

  return 1; // default
}

/**
 * Extract hours from notes text (for Billable CUSTOM actions where actionData.name contains "Billable").
 * Looks for patterns like "4.5 hours", "2 hrs", "Billable Hours: 3" anywhere in the text.
 */
function extractHoursFromNotes(text: string): number {
  // Pattern 1: billable hours/hrs [:=]? N
  const p1 = /billable\s+(?:hours?|hrs?)\s*[:=]?\s*(\d+(?:\.\d+)?)/i;
  const m1 = p1.exec(text);
  if (m1) return parseFloat(m1[1]);

  // Pattern 2: hours/hrs [:=] N (e.g. "Hours: 4.5")
  const p2 = /(?:hours?|hrs?)\s*[:=]\s*(\d+(?:\.\d+)?)/i;
  const m2 = p2.exec(text);
  if (m2) return parseFloat(m2[1]);

  // Pattern 3: N hours/hrs anywhere in text
  const p3 = /(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)(?:[^a-z]|$)/i;
  const m3 = p3.exec(text);
  if (m3) return parseFloat(m3[1]);

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
 * Count total vessels across all available sources in an action.
 */
function countVessels(action: ActionApiItem): number {
  // Flat vessel list
  const flatCount = action.actionData?.vessels?.length || 0;
  if (flatCount > 0) return flatCount;

  // Nested lot groups (ADDITION actions)
  const lots = action.actionData?.lots;
  if (lots) {
    return lots.reduce((sum, l) => sum + (l.vessels?.length || 0), 0);
  }

  // Fallback: count from fills/drains nested vessels
  let count = 0;
  for (const fill of action.actionData?.fills || []) {
    count += fill.vessels?.length || (fill.vessel ? 1 : 0);
  }
  if (count > 0) return count;
  for (const drain of action.actionData?.drains || []) {
    count += drain.vessels?.length || (drain.vessel ? 1 : 0);
  }
  return count;
}

/**
 * Process an ADDITION action: one row per additive per vessel type.
 * Billing: vesselCount * rate + setupFee + (materialRate * additiveQuantity if applicable)
 */
function processAdditionAction(action: ActionApiItem): ActionRow[] {
  const rows: ActionRow[] = [];
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);
  const rawTaxClass = action.actionData?.lots?.[0]?.lot?.taxClass || action.actionData?.lot?.taxClass;
  const taxClass = rawTaxClass?.replace(/^TC_/, '');

  // Build per-vessel-type count map
  const vesselTypeCounts = new Map<string, number>();
  for (const v of action.actionData?.vessels || []) {
    const vt = v.vesselType || 'UNKNOWN';
    vesselTypeCounts.set(vt, (vesselTypeCounts.get(vt) || 0) + 1);
  }
  for (const lot of action.actionData?.lots || []) {
    for (const v of lot.vessels || []) {
      const vt = v.vesselType || 'UNKNOWN';
      vesselTypeCounts.set(vt, (vesselTypeCounts.get(vt) || 0) + 1);
    }
  }

  // Fallback: if no vessels found, use total count with 'UNKNOWN' type
  if (vesselTypeCounts.size === 0) {
    const totalCount = countVessels(action);
    if (totalCount > 0) {
      vesselTypeCounts.set('UNKNOWN', totalCount);
    }
  }

  const additives = action.actionData?.additives;
  if (additives && additives.length > 0) {
    for (const additive of additives) {
      const productName = additive.additive?.productName || additive.name || 'Unknown';
      const access = additive.additive?.access;
      const materialChargeApplies = access?.global === true ||
        (access?.owners?.some(o => o.name === ownerCode) ?? false);
      const additiveQuantity = additive.quantity || 0;

      if (vesselTypeCounts.size === 0) {
        // No vessels at all — single row with vesselCount 0
        rows.push({
          actionType: 'ADDITION',
          actionId: String(action._id),
          lotCodes,
          performer: action.performedBy?.name || '',
          date,
          ownerCode,
          analysisOrNotes: productName,
          hours: 0,
          rate: 0,
          setupFee: 0,
          total: 0,
          matched: false,
          matchedRuleLabel: '',
          rawActionType: 'ADDITION',
          vesselTypes: '',
          quantity: 0,
          unit: 'vessels',
          vesselCount: 0,
          taxClass,
          materialChargeApplies,
          additiveQuantity,
        });
      } else {
        for (const [vesselType, count] of vesselTypeCounts) {
          rows.push({
            actionType: 'ADDITION',
            actionId: String(action._id),
            lotCodes,
            performer: action.performedBy?.name || '',
            date,
            ownerCode,
            analysisOrNotes: productName,
            hours: 0,
            rate: 0,
            setupFee: 0,
            total: 0,
            matched: false,
            matchedRuleLabel: '',
            rawActionType: 'ADDITION',
            vesselTypes: vesselType,
            quantity: count,
            unit: 'vessels',
            vesselCount: count,
            taxClass,
            materialChargeApplies,
            additiveQuantity,
          });
        }
      }
    }
  } else {
    const notesText = getNotesText(action);
    const allVesselTypes = Array.from(vesselTypeCounts.keys()).join(', ');
    const totalVessels = Array.from(vesselTypeCounts.values()).reduce((a, b) => a + b, 0);
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
      vesselTypes: allVesselTypes,
      vesselCount: totalVessels,
      taxClass,
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
  const fallbackOwnerCode = extractOwnerCode(action);
  const analysisSource = action.actionData?.source || '';

  const analyses = action.actionData?.analyses || [];
  for (const analysis of analyses) {
    const typeName = analysis.analysisType?.name || '';

    // Skip brix and temperature analyses
    if (/^(brix|temp(?:erature)?)$/i.test(typeName)) {
      continue;
    }

    // Per-lot: use the individual analysis's lot code and derive owner from it
    const lotCode = analysis.lot?.lotCode || '';
    const ownerCode = lotCode.length >= 3 ? lotCode.substring(0, 3).toUpperCase() : fallbackOwnerCode;

    rows.push({
      actionType: 'ANALYSIS',
      actionId: String(action._id),
      lotCodes: lotCode,
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
      analysisSource,
    });
  }

  return rows;
}

/**
 * Process a CUSTOM (non-steam) action.
 */
/**
 * Extract owner code from vessel code (characters at index 3,4,5).
 * e.g. "19-AWC-001" → "AWC"
 */
function ownerCodeFromVesselCode(vesselCode: string): string {
  // Strip dashes to get continuous chars, then take chars 3,4,5
  // For format "YY-XXX-NNN", chars 4,5,6 (1-indexed) = index 3,4,5 after dash removal
  const stripped = vesselCode.replace(/-/g, '');
  return stripped.length >= 5 ? stripped.substring(2, 5).toUpperCase() : '';
}

function processCustomAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const actionName = getActionName(action);
  const notesText = getNotesText(action);
  const combined = [actionName, notesText].filter(Boolean).join(' ');

  // Count vessels if present (e.g. barrel shipping actions)
  const vessels = action.actionData?.vessels || [];

  // When actionData.name contains "Billable", parse hours from notes text first
  // and use actionName alone for matching (notes are just hour metadata)
  let hours: number;
  let displayName: string;
  if (/billable/i.test(actionName) && notesText) {
    hours = extractHoursFromNotes(notesText);
    displayName = actionName.trim();
  } else {
    hours = extractHours(combined);
    displayName = combined.trim();
  }

  // If vessels are present and no lotAccess owners, group by owner derived from vesselCode
  if (vessels.length > 0 && !action.lotAccess?.owners?.length) {
    const byOwner = new Map<string, number>();
    for (const v of vessels) {
      const code = ownerCodeFromVesselCode(v.vesselCode || '');
      const owner = code || 'UNK';
      byOwner.set(owner, (byOwner.get(owner) || 0) + 1);
    }

    return [...byOwner.entries()].map(([ownerCode, count]) => ({
      actionType: 'CUSTOM',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode,
      analysisOrNotes: displayName,
      hours,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
      matchedRuleLabel: '',
      rawActionType: 'CUSTOM',
      vesselCount: count,
      quantity: count,
    }));
  }

  const ownerCode = extractOwnerCode(action);
  const vesselCount = vessels.length;

  return [{
    actionType: 'CUSTOM',
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: displayName,
    hours,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: 'CUSTOM',
    vesselCount: vesselCount || undefined,
    quantity: vesselCount || undefined,
  }];
}

/**
 * Process a BOTTLE action: one row per bottle format.
 * Total cases = cases + (pallets * casesPerPallet) + (bottles / bottlesPerCase)
 * Variation = bottleType.name (e.g. "Standard")
 */
function processBottleAction(action: ActionApiItem): ActionRow[] {
  const rows: ActionRow[] = [];
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);

  const formats = action.actionData?.bottleFormats || [];
  if (formats.length === 0) {
    rows.push({
      actionType: 'BOTTLE',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode,
      analysisOrNotes: getNotesText(action) || 'Bottling',
      hours: 0,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
      matchedRuleLabel: '',
      rawActionType: 'BOTTLE',
      quantity: 0,
      unit: 'cases',
    });
    return rows;
  }

  for (const fmt of formats) {
    const bpc = fmt.bottlesPerCase || 0;
    const totalBottles = ((fmt.cases || 0) * bpc)
      + ((fmt.pallets || 0) * (fmt.casesPerPallet || 0) * bpc)
      + (fmt.bottles || 0);
    const totalCases = bpc > 0
      ? Math.round((totalBottles / bpc) * 100) / 100
      : 0;
    const bottleTypeName = fmt.bottleType?.name || 'Unknown';

    rows.push({
      actionType: 'BOTTLE',
      actionId: String(action._id),
      lotCodes,
      performer: action.performedBy?.name || '',
      date,
      ownerCode,
      analysisOrNotes: bottleTypeName,
      hours: 0,
      rate: 0,
      setupFee: 0,
      total: 0,
      matched: false,
      matchedRuleLabel: '',
      rawActionType: 'BOTTLE',
      quantity: totalCases,
      unit: 'cases',
      bottlesPerCase: bpc,
    });
  }

  return rows;
}

/**
 * Process a generic action (not ANALYSIS, CUSTOM, ADDITION, or BOTTLE).
 */
/**
 * Extract volume for bond-to-bond transfers.
 * OUT: sum absolute drain volumes (volumeChange on vessels or involvedLots.startingVolume)
 * IN:  sum fill volumes (volumeChange on vessels or involvedLots.volumeChange)
 */
function extractBondTransferVolume(action: ActionApiItem, direction: 'OUT' | 'IN'): number {
  let volume = 0;

  if (direction === 'OUT') {
    // Sum absolute volumeChange from vessels (drains show negative volumeChange)
    for (const v of action.actionData?.vessels || []) {
      if (v.volumeChange?.value) {
        volume += Math.abs(v.volumeChange.value);
      }
    }
    if (volume > 0) return volume;

    // Fallback: sum from drains
    for (const d of action.actionData?.drains || []) {
      if (d.volume?.value) {
        volume += Math.abs(d.volume.value);
      } else if (d.vessels) {
        for (const v of d.vessels) {
          if (v.volumeChange?.value) volume += Math.abs(v.volumeChange.value);
        }
      }
    }
    if (volume > 0) return volume;

    // Fallback: involvedLots startingVolume (what was there before the transfer out)
    for (const inv of action.actionData?.involvedLots || []) {
      if (inv.startingVolume?.value) {
        volume += inv.startingVolume.value;
      }
    }
  } else {
    // IN: sum volumeChange from vessels (fills show positive volumeChange)
    for (const v of action.actionData?.vessels || []) {
      if (v.volumeChange?.value) {
        volume += Math.abs(v.volumeChange.value);
      }
    }
    if (volume > 0) return volume;

    // Fallback: sum from fills
    for (const f of action.actionData?.fills || []) {
      if (f.volume?.value) {
        volume += Math.abs(f.volume.value);
      } else if (f.vessels) {
        for (const v of f.vessels) {
          if (v.volumeChange?.value) volume += Math.abs(v.volumeChange.value);
        }
      }
    }
    if (volume > 0) return volume;

    // Fallback: involvedLots volumeChange
    for (const inv of action.actionData?.involvedLots || []) {
      if (inv.volumeChange?.value) {
        volume += Math.abs(inv.volumeChange.value);
      }
    }
  }

  return volume;
}

function processGenericAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);
  const notesText = getNotesText(action);

  // Use complianceContext as actionType when present (e.g. BOND_TO_BOND_TRANSFER_OUT/IN)
  const effectiveActionType = action.actionData?.complianceContext || action.actionType;

  // Extract volume for bond-to-bond transfers
  let quantity: number | undefined;
  let unit: string | undefined;
  const ctx = (action.actionData?.complianceContext || '').toUpperCase();
  if (ctx === 'BOND_TO_BOND_TRANSFER_OUT') {
    quantity = extractBondTransferVolume(action, 'OUT');
    unit = 'gal';
  } else if (ctx === 'BOND_TO_BOND_TRANSFER_IN') {
    quantity = extractBondTransferVolume(action, 'IN');
    unit = 'gal';
  }

  return [{
    actionType: effectiveActionType,
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
    quantity,
    unit,
  }];
}

/**
 * Process a FILTER action: quantity = sum of drain volumes.
 */
function processFilterAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);
  const notesText = getNotesText(action);

  // Extract drain volume from nested vessels structure:
  // Each drain has a vessels[] array, each vessel has startingVolume (what was in the tank before draining).
  let totalDrainVolume = 0;
  if (action.actionData?.drains) {
    for (const drain of action.actionData.drains) {
      // Try nested vessels[] first (FILTER actions use this structure)
      if (drain.vessels) {
        for (const v of drain.vessels) {
          if (v.startingVolume?.value) {
            totalDrainVolume += v.startingVolume.value;
          }
        }
      } else if (drain.volume?.value) {
        // Fallback to top-level drain.volume
        totalDrainVolume += drain.volume.value;
      }
    }
  }

  return [{
    actionType: 'FILTER',
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: notesText || getActionName(action) || 'Filter',
    hours: 0,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: 'FILTER',
    quantity: totalDrainVolume,
    unit: 'gal',
  }];
}

/**
 * Process a BOTTLING_EN_TIRAGE action.
 * Quantity = total filled bottles from fills[].vessels[].numberOfFilledBottles.
 * Setup fee is expected to use spread_daily mode (split across same-day actions).
 */
function processBottlingEnTirageAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);

  let totalBottles = 0;
  for (const fill of action.actionData?.fills || []) {
    for (const v of fill.vessels || []) {
      totalBottles += v.numberOfFilledBottles || 0;
    }
  }

  return [{
    actionType: 'BOTTLING_EN_TIRAGE',
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: getNotesText(action) || getActionName(action) || 'Bottling En Tirage',
    hours: 0,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: 'BOTTLING_EN_TIRAGE',
    quantity: totalBottles,
    unit: 'bottles',
  }];
}

/**
 * Process a REMOVED_TAXPAID action (VOLUME_CHANGE with complianceContext=REMOVED_TAXPAID).
 * Billing is per case, extracted from bottleFormat.
 */
function processRemovedTaxpaidAction(action: ActionApiItem): ActionRow[] {
  const date = convertDateToPST(action.effectiveAt);
  const lotCodes = extractAllLotCodes(action);
  const ownerCode = extractOwnerCode(action);

  // Extract case count from bottleFormat (singular)
  const bf = action.actionData?.bottleFormat;
  let totalCases = 0;
  if (bf) {
    const bpc = bf.bottlesPerCase || 0;
    const totalBottles = ((bf.cases || 0) * bpc)
      + ((bf.pallets || 0) * (bf.casesPerPallet || 0) * bpc)
      + (bf.bottles || 0);
    totalCases = bpc > 0
      ? Math.round((totalBottles / bpc) * 100) / 100
      : 0;
  }

  return [{
    actionType: 'VOLUME_CHANGE',
    actionId: String(action._id),
    lotCodes,
    performer: action.performedBy?.name || '',
    date,
    ownerCode,
    analysisOrNotes: 'REMOVED_TAXPAID',
    hours: 0,
    rate: 0,
    setupFee: 0,
    total: 0,
    matched: false,
    matchedRuleLabel: '',
    rawActionType: 'VOLUME_CHANGE',
    quantity: totalCases,
    unit: 'cases',
  }];
}

/**
 * Main processor: route each action to its handler.
 */
export function processActions(actions: ActionApiItem[]): ActionRow[] {
  const allRows: ActionRow[] = [];

  for (const action of actions) {
    if (action.actionType === 'FILTER') {
      allRows.push(...processFilterAction(action));
    } else if (action.actionType === 'ANALYSIS') {
      allRows.push(...processAnalysisAction(action));
    } else if (action.actionType === 'CUSTOM' && isSteamAction(action)) {
      allRows.push(...processSteamAction(action));
    } else if (action.actionType === 'CUSTOM') {
      allRows.push(...processCustomAction(action));
    } else if (action.actionType === 'ADDITION') {
      allRows.push(...processAdditionAction(action));
    } else if (action.actionType === 'BOTTLE') {
      allRows.push(...processBottleAction(action));
    } else if (action.actionType === 'BOTTLING_EN_TIRAGE') {
      allRows.push(...processBottlingEnTirageAction(action));
    } else if (action.actionType === 'VOLUME_CHANGE' && action.actionData?.complianceContext === 'REMOVED_TAXPAID') {
      allRows.push(...processRemovedTaxpaidAction(action));
    } else {
      allRows.push(...processGenericAction(action));
    }
  }

  return allRows;
}

/**
 * Enrich CUSTOM action rows with lot volume from the lotsInventory API.
 * Needed for per-gallon billing on CUSTOM actions that don't include volume.
 * Deduplicates API calls by lotCode + date.
 */
export async function enrichCustomActionVolumes(
  rows: ActionRow[],
  wineryId: string,
  token: string,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  const customRowsWithLots = rows.filter(
    (r) => r.rawActionType === 'CUSTOM' && r.lotCodes && r.lotCodes.trim() !== ''
  );

  if (customRowsWithLots.length === 0) return;

  // Build unique lookup keys: lotCode|YYYY-MM-DD
  const lookupKeys = new Set<string>();
  for (const row of customRowsWithLots) {
    const dateOnly = row.date.substring(0, 10); // "YYYY-MM-DD" from "YYYY-MM-DD HH:mm"
    for (const code of row.lotCodes.split(',').map((c) => c.trim()).filter(Boolean)) {
      lookupKeys.add(`${code}|${dateOnly}`);
    }
  }

  onProgress({
    step: 'volumes',
    message: `Looking up lot volumes for ${lookupKeys.size} unique lot/date pair(s)...`,
    pct: 36,
  });

  // Fetch volumes with dedup cache
  const cache = new Map<string, number>();
  let completed = 0;
  for (const key of lookupKeys) {
    const [lotCode, dateStr] = key.split('|');
    const timestamp = `${dateStr}T23:59:59.000Z`;
    const volume = await fetchLotVolume(wineryId, token, lotCode, timestamp);
    cache.set(key, volume);
    completed++;
    if (completed % 5 === 0 || completed === lookupKeys.size) {
      onProgress({
        step: 'volumes',
        message: `Volume lookups: ${completed}/${lookupKeys.size}`,
        pct: 36 + Math.round((completed / lookupKeys.size) * 3),
      });
    }
  }

  // Apply volumes to rows
  for (const row of customRowsWithLots) {
    const dateOnly = row.date.substring(0, 10);
    const codes = row.lotCodes.split(',').map((c) => c.trim()).filter(Boolean);
    // Use the first lot code's volume
    const key = `${codes[0]}|${dateOnly}`;
    const volume = cache.get(key);
    if (volume !== undefined && volume > 0) {
      row.quantity = volume;
      row.unit = 'gal';
    }
  }
}
