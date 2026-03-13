import { ActionRow, AuditRow, RateRule } from '../types';

/**
 * Clean a string for matching: trim, uppercase, strip all whitespace.
 */
export function cleanKey(v: string | undefined | null): string {
  if (!v) return '';
  return v.toString().trim().toUpperCase().replace(/\s/g, '');
}

interface RateMatch {
  matched: boolean;
  rate: number;
  setupFee: number;
  total: number;
  ruleLabel: string;
  reason?: string;
  setupFeeMode?: 'per_action' | 'spread_daily';
  minDollar: number;
  freeFirstPerLot: boolean;
  billingUnit?: string;
  excludeAllInclusive?: boolean;
}

/**
 * Find a matching rate rule for a given action row.
 *
 * Lookup order:
 * 1. ANALYSIS: match on actionType=ANALYSIS AND cleanKey(variation)=cleanKey(analysisName)
 * 2. BILLABLE keyword in notes/name → match variation="BILLABLE"
 * 3. PROCESSFRUITTOVOLUME/WEIGHT → range-based on qty
 * 4. Exact match: actionType + variation
 * 5. Prefix match: actionType with blank variation (catch-all for that type)
 */
function matchedResult(rule: RateRule, total: number): RateMatch {
  const minDollar = rule.minDollar || 0;
  return {
    matched: true,
    rate: rule.rate,
    setupFee: rule.setupFee,
    total: Math.max(total, minDollar),
    ruleLabel: rule.label,
    setupFeeMode: rule.setupFeeMode || 'per_action',
    minDollar,
    freeFirstPerLot: rule.freeFirstPerLot || false,
    billingUnit: rule.billingUnit,
    excludeAllInclusive: rule.excludeAllInclusive || false,
  };
}

function unmatchedResult(reason: string): RateMatch {
  return { matched: false, rate: 0, setupFee: 0, total: 0, ruleLabel: '', reason, minDollar: 0, freeFirstPerLot: false };
}

/**
 * Pick the effective quantity based on the matched rule's billing unit.
 */
function effectiveQtyForUnit(
  billingUnit: string,
  qty: number,
  hours: number,
  vesselCount?: number
): number {
  switch (billingUnit) {
    case 'per hour':
      return hours || 1;
    case 'per barrel':
    case 'per vessel':
      return vesselCount || 1;
    case 'per gallon':
    case 'per kg':
    case 'per ton':
    case 'per case':
    case 'per analysis':
    case 'per additive unit':
      return qty || 1;
    case 'per lot':
      return 1;
    case 'flat fee':
      return 1;
    default:
      return qty || hours || 1;
  }
}

function findRate(
  rules: RateRule[],
  actionType: string,
  variation: string,
  qty: number,
  notes: string,
  actionName: string,
  hours: number,
  vesselCount?: number,
  bottlesPerCase?: number,
  taxClass?: string,
  vesselType?: string,
  materialChargeApplies?: boolean,
  additiveQuantity?: number,
  analysisSource?: string,
  isAllInclusive?: boolean
): RateMatch {
  const cleanActionType = cleanKey(actionType);
  const cleanVariation = cleanKey(variation);
  const combinedText = `${notes} ${actionName}`;

  // 0a. BOTTLE match: qty (cases) * rate, matched by variation (format name) + bottlesPerCase
  if (cleanActionType === 'BOTTLE') {
    // Exact match: format name + bottlesPerCase
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== 'BOTTLE') continue;
      const ruleVar = cleanKey(rule.variation);
      if (ruleVar !== '' && ruleVar === cleanVariation && rule.bottlesPerCase && bottlesPerCase && rule.bottlesPerCase === bottlesPerCase) {
        return matchedResult(rule, (qty || 0) * rule.rate + rule.setupFee);
      }
    }
    // Format name match without bottlesPerCase constraint
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== 'BOTTLE') continue;
      const ruleVar = cleanKey(rule.variation);
      if (ruleVar !== '' && ruleVar === cleanVariation && !rule.bottlesPerCase) {
        return matchedResult(rule, (qty || 0) * rule.rate + rule.setupFee);
      }
    }
    // Catch-all (blank variation)
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== 'BOTTLE') continue;
      if (cleanKey(rule.variation) === '') {
        return matchedResult(rule, (qty || 0) * rule.rate + rule.setupFee);
      }
    }
    return unmatchedResult(`No rate rule for bottle format: ${variation || 'unknown'}${bottlesPerCase ? ` (${bottlesPerCase} btl/case)` : ''}`);
  }

  // 0b. ADDITION match: 4-tier vesselType matching + material charges
  if (cleanActionType === 'ADDITION') {
    const vc = vesselCount || 0;
    const cleanVesselType = cleanKey(vesselType);
    let matchedRule: RateRule | null = null;

    // Tier 1: Exact variation + exact vesselType
    if (cleanVesselType) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ADDITION') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleVT = cleanKey(rule.vesselType);
        if (ruleVar !== '' && ruleVar === cleanVariation && ruleVT !== '' && ruleVT === cleanVesselType) {
          matchedRule = rule;
          break;
        }
      }
    }

    // Tier 2: Exact variation + blank vesselType (any)
    if (!matchedRule) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ADDITION') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleVT = cleanKey(rule.vesselType);
        if (ruleVar !== '' && ruleVar === cleanVariation && ruleVT === '') {
          matchedRule = rule;
          break;
        }
      }
    }

    // Tier 3: Blank variation + exact vesselType
    if (!matchedRule && cleanVesselType) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ADDITION') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleVT = cleanKey(rule.vesselType);
        if (ruleVar === '' && ruleVT !== '' && ruleVT === cleanVesselType) {
          matchedRule = rule;
          break;
        }
      }
    }

    // Tier 4: Blank variation + blank vesselType (full catch-all)
    if (!matchedRule) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ADDITION') continue;
        if (cleanKey(rule.variation) === '' && cleanKey(rule.vesselType) === '') {
          matchedRule = rule;
          break;
        }
      }
    }

    if (matchedRule) {
      // Check tax class exclusion
      if (matchedRule.excludeTaxClasses?.length && taxClass && matchedRule.excludeTaxClasses.includes(taxClass)) {
        return {
          matched: true,
          rate: 0,
          setupFee: 0,
          total: 0,
          ruleLabel: `${matchedRule.label} (Excluded)`,
          setupFeeMode: matchedRule.setupFeeMode || 'per_action',
          minDollar: 0,
          freeFirstPerLot: false,
        };
      }
      let total = vc * matchedRule.rate + matchedRule.setupFee;
      if (materialChargeApplies && matchedRule.materialRate && matchedRule.materialRate > 0 && additiveQuantity) {
        total += matchedRule.materialRate * additiveQuantity;
      }
      return matchedResult(matchedRule, total);
    }
    return unmatchedResult(`No rate rule for addition: ${variation || 'unknown additive'}${vesselType ? ` (${vesselType})` : ''}`);
  }

  // 1. ANALYSIS match: 4-tier source matching
  if (cleanActionType === 'ANALYSIS') {
    const cleanSource = cleanKey(analysisSource);
    let matchedAnalysisRule: RateRule | null = null;

    // Tier 1: Exact variation + exact source
    if (cleanSource) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ANALYSIS') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleSrc = cleanKey(rule.analysisSource);
        if (ruleVar !== '' && ruleVar === cleanVariation && ruleSrc !== '' && ruleSrc === cleanSource) {
          matchedAnalysisRule = rule;
          break;
        }
      }
    }

    // Tier 2: Exact variation + blank source (any)
    if (!matchedAnalysisRule) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ANALYSIS') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleSrc = cleanKey(rule.analysisSource);
        if (ruleVar !== '' && ruleVar === cleanVariation && ruleSrc === '') {
          matchedAnalysisRule = rule;
          break;
        }
      }
    }

    // Tier 3: Blank variation + exact source
    if (!matchedAnalysisRule && cleanSource) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ANALYSIS') continue;
        const ruleVar = cleanKey(rule.variation);
        const ruleSrc = cleanKey(rule.analysisSource);
        if (ruleVar === '' && ruleSrc !== '' && ruleSrc === cleanSource) {
          matchedAnalysisRule = rule;
          break;
        }
      }
    }

    // Tier 4: Blank variation + blank source (full catch-all)
    if (!matchedAnalysisRule) {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (cleanKey(rule.actionType) !== 'ANALYSIS') continue;
        if (cleanKey(rule.variation) === '' && cleanKey(rule.analysisSource) === '') {
          matchedAnalysisRule = rule;
          break;
        }
      }
    }

    if (matchedAnalysisRule) {
      const effectiveQty = qty || 1;
      return matchedResult(matchedAnalysisRule, effectiveQty * matchedAnalysisRule.rate + matchedAnalysisRule.setupFee);
    }
    return unmatchedResult(`No rate rule for analysis type: ${variation}${analysisSource ? ` (${analysisSource})` : ''}`);
  }

  // 2. BILLABLE keyword
  if (/billable/i.test(combinedText)) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.variation) === 'BILLABLE') {
        const eQty = effectiveQtyForUnit(rule.billingUnit, qty, hours, vesselCount);
        return matchedResult(rule, eQty * rule.rate + rule.setupFee);
      }
    }
  }

  // 3. PROCESSFRUITTOVOLUME / PROCESSFRUITTOWEIGHT — range-based
  if (cleanActionType === 'PROCESSFRUITTOVOLUME' || cleanActionType === 'PROCESSFRUITTOWEIGHT') {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== cleanActionType) continue;
      const min = rule.minQty ?? 0;
      const max = rule.maxQty === null || rule.maxQty === undefined ? Infinity : rule.maxQty;
      if (qty >= min && qty <= max) {
        return matchedResult(rule, qty * rule.rate + rule.setupFee);
      }
    }
    return unmatchedResult(`No rate rule for ${actionType} with qty ${qty}`);
  }

  // 4. Exact match: actionType + variation
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (cleanKey(rule.actionType) !== cleanActionType) continue;
    const ruleVar = cleanKey(rule.variation);
    if (ruleVar !== '' && ruleVar === cleanVariation) {
      const eQty = effectiveQtyForUnit(rule.billingUnit, qty, hours, vesselCount);
      return matchedResult(rule, eQty * rule.rate + rule.setupFee);
    }
  }

  // Also try matching variation against vessel types or action name
  if (actionName) {
    const cleanName = cleanKey(actionName);
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (cleanKey(rule.actionType) !== cleanActionType) continue;
      const ruleVar = cleanKey(rule.variation);
      if (ruleVar !== '' && ruleVar === cleanName) {
        const eQty = effectiveQtyForUnit(rule.billingUnit, qty, hours, vesselCount);
        return matchedResult(rule, eQty * rule.rate + rule.setupFee);
      }
    }
  }

  // 5. Prefix match: actionType with blank variation (catch-all)
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (cleanKey(rule.actionType) !== cleanActionType) continue;
    const ruleVar = cleanKey(rule.variation);
    if (ruleVar === '') {
      const eQty = effectiveQtyForUnit(rule.billingUnit, qty, hours, vesselCount);
      return matchedResult(rule, eQty * rule.rate + rule.setupFee);
    }
  }

  return unmatchedResult(`No rate rule found for action type: ${actionType}`);
}

/**
 * Apply rate rules to all action rows.
 */
export function applyRateMapping(
  rows: ActionRow[],
  rules: RateRule[],
  allInclusiveLotCodes?: Set<string>
): { matched: ActionRow[]; auditRows: AuditRow[] } {
  const auditRows: AuditRow[] = [];

  // Track per-row metadata for post-processing
  const setupFeeModes: Array<'per_action' | 'spread_daily'> = [];
  const originalSetupFees: number[] = [];
  const minDollars: number[] = [];
  const freeFirstFlags: boolean[] = [];

  const updatedRows = rows.map((row, idx) => {
    const result = findRate(
      rules,
      row.actionType,
      row.analysisOrNotes,
      row.quantity || 0,
      row.analysisOrNotes,
      row.analysisOrNotes,
      row.hours,
      row.vesselCount,
      row.bottlesPerCase,
      row.taxClass,
      row.vesselTypes,
      row.materialChargeApplies,
      row.additiveQuantity,
      row.analysisSource
    );

    // Check if any of the action's lot codes are all-inclusive
    const isAllInclusive = allInclusiveLotCodes && allInclusiveLotCodes.size > 0 && row.lotCodes
      ? row.lotCodes.split(',').some((lc) => allInclusiveLotCodes.has(lc.trim()))
      : false;

    // If the matched rule excludes all-inclusive lots and the lot is all-inclusive, zero out
    if (result.matched && result.excludeAllInclusive && isAllInclusive) {
      result.rate = 0;
      result.setupFee = 0;
      result.total = 0;
      result.ruleLabel = `${result.ruleLabel} (All-Inclusive)`;
    }

    setupFeeModes[idx] = result.setupFeeMode || 'per_action';
    originalSetupFees[idx] = result.setupFee;
    minDollars[idx] = result.minDollar;
    freeFirstFlags[idx] = result.freeFirstPerLot;

    // Set quantity to the effective qty used for billing
    let displayQty = row.quantity;
    if (result.matched && result.billingUnit) {
      displayQty = effectiveQtyForUnit(result.billingUnit, row.quantity || 0, row.hours, row.vesselCount);
    }

    const updatedRow: ActionRow = {
      ...row,
      quantity: displayQty,
      rate: result.rate,
      setupFee: result.setupFee,
      total: result.total,
      matched: result.matched,
      matchedRuleLabel: result.matched ? result.ruleLabel : '',
    };

    if (!result.matched) {
      auditRows.push({
        actionType: row.actionType,
        actionId: row.actionId,
        lotCodes: row.lotCodes,
        performer: row.performer,
        date: row.date,
        ownerCode: row.ownerCode,
        analysisOrNotes: row.analysisOrNotes,
        reason: result.reason || 'No matching rate rule',
      });
    }

    return updatedRow;
  });

  // Post-process: spread_daily setup fees
  // Group rows with spread_daily by actionType + date (YYYY-MM-DD)
  const spreadGroups = new Map<string, number[]>();
  for (let i = 0; i < updatedRows.length; i++) {
    if (setupFeeModes[i] !== 'spread_daily' || !updatedRows[i].matched) continue;
    const dateOnly = updatedRows[i].date.substring(0, 10); // YYYY-MM-DD
    const key = `${updatedRows[i].actionType}|${dateOnly}`;
    if (!spreadGroups.has(key)) spreadGroups.set(key, []);
    spreadGroups.get(key)!.push(i);
  }

  for (const indices of spreadGroups.values()) {
    const totalVolume = indices.reduce((sum, i) => sum + (updatedRows[i].quantity || 0), 0);
    if (totalVolume <= 0) continue;
    const perActionSetupFee = originalSetupFees[indices[0]]; // same rule, same fee
    for (const i of indices) {
      const proportion = (updatedRows[i].quantity || 0) / totalVolume;
      updatedRows[i].setupFee = Math.round(perActionSetupFee * proportion * 100) / 100;
      const qty = updatedRows[i].quantity || 0;
      updatedRows[i].total = qty * updatedRows[i].rate + updatedRows[i].setupFee;
    }
  }

  // Post-process: enforce minimum dollar amount per row
  for (let i = 0; i < updatedRows.length; i++) {
    if (!updatedRows[i].matched || minDollars[i] <= 0) continue;
    if (updatedRows[i].total < minDollars[i]) {
      updatedRows[i].total = minDollars[i];
    }
  }

  // Post-process: free first occurrence per lot
  // For each individual lot code + rule combination, the earliest row is "Included".
  // A row's lotCodes may contain multiple lots (comma-separated); use each one as a key.
  const includedSet = new Set<number>(); // row indices already marked included
  const freeFirstSeen = new Map<string, { idx: number; date: string }>(); // earliest per key

  for (let i = 0; i < updatedRows.length; i++) {
    if (!freeFirstFlags[i] || !updatedRows[i].matched) continue;
    const ruleLabel = updatedRows[i].matchedRuleLabel;
    const lots = updatedRows[i].lotCodes.split(',').map((s) => s.trim()).filter(Boolean);

    for (const lot of lots) {
      const key = `${ruleLabel}|${lot}`;
      const existing = freeFirstSeen.get(key);
      if (!existing || updatedRows[i].date < existing.date) {
        freeFirstSeen.set(key, { idx: i, date: updatedRows[i].date });
      }
    }
  }

  // Collect unique row indices that should be included
  for (const { idx } of freeFirstSeen.values()) {
    includedSet.add(idx);
  }

  for (const idx of includedSet) {
    updatedRows[idx].total = 0;
    updatedRows[idx].matchedRuleLabel = `${updatedRows[idx].matchedRuleLabel} (Included)`;
  }

  return { matched: updatedRows, auditRows };
}
