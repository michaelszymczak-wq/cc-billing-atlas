import {
  FruitInstallment,
  FruitIntakeApiItem,
  FruitIntakeRecord,
  FruitIntakeRunResult,
  FruitIntakeSettings,
  FruitProgram,
  ProgressEvent,
} from '../types';
import { cleanKey } from './rateMapper';

const BASE_URL = 'https://sutter.innovint.us';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch fruit intake report from InnoVint API with pagination.
 */
export async function fetchFruitIntakeReport(
  wineryId: string,
  token: string,
  vintages: number[],
  pageDelaySeconds: number,
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeApiItem[]> {
  const allItems: FruitIntakeApiItem[] = [];
  let offset = 0;
  const size = 200;
  const maxPages = 50;
  let page = 0;

  while (page < maxPages) {
    const url = new URL(`${BASE_URL}/wineries/${wineryId}/components/fruitIntakeReport`);
    url.searchParams.set('size', String(size));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('states', 'ACTIVE');
    url.searchParams.set('vintages', vintages.join(','));

    onProgress({
      step: 'fruit-intake',
      message: `Fetching fruit intake page ${page + 1} (offset ${offset})...`,
      pct: Math.min(50, Math.round((page / 10) * 50)),
    });

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Access-Token ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      onProgress({
        step: 'fruit-intake',
        message: `Network error on page ${page + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      break;
    }

    if (response.status === 429) {
      onProgress({
        step: 'fruit-intake',
        message: 'Rate limited by InnoVint API. Stopping pagination.',
        pct: -1,
      });
      break;
    }

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      onProgress({
        step: 'fruit-intake',
        message: `API error ${response.status}: ${response.statusText}. ${body.slice(0, 200)}`,
        pct: -1,
      });
      break;
    }

    const data = (await response.json()) as unknown;
    const items: FruitIntakeApiItem[] = Array.isArray(data) ? data : [];

    // Filter out voided records
    const active = items.filter((item) => !item.voided);
    allItems.push(...active);

    if (items.length < size) break;
    offset += items.length;
    page++;

    if (page < maxPages && pageDelaySeconds > 0) {
      await delay(pageDelaySeconds * 1000);
    }
  }

  onProgress({
    step: 'fruit-intake',
    message: `Fetched ${allItems.length} fruit intake records.`,
    pct: 50,
  });

  return allItems;
}

/**
 * Fetch fruit lots from the lotsModular API to get tags and owner names.
 */
export async function fetchFruitLots(
  wineryId: string,
  token: string,
  vintages: number[],
  pageDelaySeconds: number,
  onProgress: (event: ProgressEvent) => void
): Promise<Array<{ lotCode: string; tags: string[]; ownerName: string }>> {
  const allLots: Array<{ lotCode: string; tags: string[]; ownerName: string }> = [];
  let requestCount = 0;

  for (const vintage of vintages) {
    let offset = 0;
    const size = 200;
    const maxPages = 50;
    let page = 0;

    while (page < maxPages) {
      // 4-second delay before each request (except the very first) to avoid rate limiting
      if (requestCount > 0) {
        await delay(4000);
      }

      const url = `${BASE_URL}/wineries/${wineryId}/lotsModular?fruitLot=true&includeFullLot=true&includeIntendedUseAllocations=true&includeWorkOrders=true&minComponentPercent=-1&offset=${offset}&sort=lotCode:1&vintages=${vintage}&size=${size}`;

      onProgress({
        step: 'fruit-lots',
        message: `Fetching lots for vintage ${vintage}, page ${page + 1} (offset=${offset}, size=${size})...`,
        pct: -1,
      });

      requestCount++;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Access-Token ${token}`,
            'Accept': 'application/json',
          },
        });
      } catch (err) {
        onProgress({
          step: 'fruit-lots',
          message: `Network error fetching lots: ${err instanceof Error ? err.message : 'Unknown error'}`,
          pct: -1,
        });
        break;
      }

      if (response.status === 429) {
        onProgress({ step: 'fruit-lots', message: `Rate limited fetching lots (vintage ${vintage}, page ${page + 1}). Stopping.`, pct: -1 });
        break;
      }

      if (!response.ok) {
        let body = '';
        try { body = await response.text(); } catch { /* ignore */ }
        onProgress({
          step: 'fruit-lots',
          message: `Lots API error ${response.status}: ${body.slice(0, 200)}`,
          pct: -1,
        });
        break;
      }

      const data = (await response.json()) as unknown;
      const items: Array<Record<string, unknown>> = Array.isArray(data) ? data : [];

      onProgress({
        step: 'fruit-lots',
        message: `Vintage ${vintage} page ${page + 1}: got ${items.length} lots.`,
        pct: -1,
      });

      for (const item of items) {
        const lotCode = (item as { lotCode?: string }).lotCode || '';
        const tags: string[] = Array.isArray((item as { tags?: unknown[] }).tags) ? (item as { tags: string[] }).tags : [];
        const access = item.access as { owners?: Array<{ name: string }> } | undefined;
        const ownerName = access?.owners?.[0]?.name || '';
        if (tags.length > 0) {
          onProgress({
            step: 'fruit-lots',
            message: `  Lot ${lotCode}: tags=${JSON.stringify(tags)}, owner=${ownerName}`,
            pct: -1,
          });
        }
        allLots.push({ lotCode, tags, ownerName });
      }

      if (items.length < size) break;
      offset += items.length;
      page++;
    }
  }

  const taggedCount = allLots.filter((l) => l.tags.some((t) => t.toLowerCase().startsWith('program'))).length;
  onProgress({
    step: 'fruit-lots',
    message: `Fetched ${allLots.length} fruit lots (${taggedCount} with program tags).`,
    pct: -1,
  });

  return allLots;
}

/**
 * Build a map from lotCode to the first "Program"-matching tag and the owner name.
 */
export function buildLotTagMap(
  lots: Array<{ lotCode: string; tags: string[]; ownerName: string }>
): Map<string, { tag: string; ownerName: string }> {
  const map = new Map<string, { tag: string; ownerName: string }>();
  for (const lot of lots) {
    // Match tags containing "#" followed by a digit (e.g. "Program #2", "Prgram #1")
    const programTag = lot.tags.find((t) => /#\d/.test(t));
    if (programTag || lot.ownerName) {
      map.set(lot.lotCode, { tag: programTag || '', ownerName: lot.ownerName });
    }
  }
  return map;
}

/**
 * Find a program by matching a tag string against program names using cleanKey.
 */
export function findProgramByTag(tag: string, programs: FruitProgram[]): FruitProgram | undefined {
  // First try exact cleanKey match (handles "Program #2" == "Program #2")
  const cleanTag = cleanKey(tag);
  const exactMatch = programs.find((p) => cleanKey(p.name) === cleanTag);
  if (exactMatch) return exactMatch;

  // Fallback: extract "#N..." suffix and match (handles typos like "Prgram #2" -> "Program #2")
  const tagSuffix = tag.match(/(#\d+.*)/)?.[1]?.trim();
  if (tagSuffix) {
    const cleanSuffix = cleanKey(tagSuffix);
    return programs.find((p) => {
      const progSuffix = p.name.match(/(#\d+.*)/)?.[1]?.trim();
      return progSuffix && cleanKey(progSuffix) === cleanSuffix;
    });
  }

  return undefined;
}

/**
 * Recalculate a record with a specific program.
 */
export function recalculateRecordWithProgram(
  record: FruitIntakeRecord,
  programId: string,
  programs: FruitProgram[],
  minProcessingFee: number
): FruitIntakeRecord {
  const program = programs.find((p) => p.id === programId);
  if (!program) return record;

  const contractRatePerTon = program.ratePerTon;
  const totalCost = Math.max(record.fruitWeightTons * contractRatePerTon, minProcessingFee) + (record.smallLotFee || 0);
  const monthlyAmount = record.contractLengthMonths > 0
    ? Math.round((totalCost / record.contractLengthMonths) * 100) / 100
    : 0;
  const contractEndMonth = getContractEndMonth(record.contractStartMonth, record.contractLengthMonths);
  const installments = generateInstallments(record.contractStartMonth, record.contractLengthMonths, monthlyAmount);

  return {
    ...record,
    contractRatePerTon,
    totalCost,
    monthlyAmount,
    contractEndMonth,
    installments,
    programId: program.id,
    programName: program.name,
  };
}

/**
 * Generate monthly installments for a contract.
 */
export function generateInstallments(
  contractStartMonth: string,
  contractLengthMonths: number,
  monthlyAmount: number
): FruitInstallment[] {
  const installments: FruitInstallment[] = [];
  const parts = contractStartMonth.split(' ');
  if (parts.length !== 2) return installments;

  let monthIdx = MONTHS.indexOf(parts[0]);
  let year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return installments;

  for (let i = 0; i < contractLengthMonths; i++) {
    installments.push({
      month: `${MONTHS[monthIdx]} ${year}`,
      amount: monthlyAmount,
    });
    monthIdx++;
    if (monthIdx >= 12) {
      monthIdx = 0;
      year++;
    }
  }

  return installments;
}

/**
 * Determine contract start month: always November of the vintage year.
 */
function getContractStartMonth(effectiveDate: string): string {
  const date = new Date(effectiveDate);
  const year = date.getUTCFullYear();
  return `November ${year}`;
}

/**
 * Get the contract end month from start + length.
 */
export function getContractEndMonth(contractStartMonth: string, lengthMonths: number): string {
  if (lengthMonths <= 0) return contractStartMonth;
  const installments = generateInstallments(contractStartMonth, lengthMonths, 0);
  return installments.length > 0 ? installments[installments.length - 1].month : contractStartMonth;
}

/**
 * Process a single raw fruit intake API item into a FruitIntakeRecord.
 */
export function processRawRecord(
  item: FruitIntakeApiItem,
  customerMap: Record<string, string>,
  lotTagMap: Map<string, { tag: string; ownerName: string }>,
  programs: FruitProgram[],
  minProcessingFee: number,
  defaultContractMonths: number,
  smallLotFee: number = 0,
  smallLotThresholdTons: number = 0
): FruitIntakeRecord {
  const lotCode = item.lot?.lotCode || '';
  const fruitWeightTons = item.fruitWeight?.value || 0;
  const effectiveDate = item.effectiveAt || '';
  const vintage = item.vintage || 0;
  const weighTagNumber = item.weighTagNumber || '';
  const color = item.lot?.color || '';
  const varietal = item.varietal?.name || '';

  // Lot tag lookup for program and owner override
  const lotInfo = lotTagMap.get(lotCode);

  // Owner: prefer lot API's owner name, fall back to fruit intake API
  const ownerName = lotInfo?.ownerName || item.access?.owners?.[0]?.name || '';

  // Owner code: use customerMap override if present, otherwise use ownerName directly from API
  let ownerCode: string;
  if (ownerName && customerMap[ownerName]) {
    ownerCode = customerMap[ownerName];
  } else if (ownerName) {
    ownerCode = ownerName;
  } else {
    ownerCode = 'UNMAPPED';
  }

  // Program matching via lot tags
  let programId: string | undefined;
  let programName: string | undefined;
  let contractRatePerTon: number;
  const contractLengthMonths = defaultContractMonths;

  const matchedProgram = lotInfo?.tag ? findProgramByTag(lotInfo.tag, programs) : undefined;

  if (matchedProgram) {
    programId = matchedProgram.id;
    programName = matchedProgram.name;
    contractRatePerTon = matchedProgram.ratePerTon;
  } else {
    contractRatePerTon = 0;
  }

  const lotSmallLotFee = (smallLotThresholdTons > 0 && fruitWeightTons < smallLotThresholdTons) ? smallLotFee : 0;
  const totalCost = Math.max(fruitWeightTons * contractRatePerTon, minProcessingFee) + lotSmallLotFee;
  const monthlyAmount = contractLengthMonths > 0 ? Math.round((totalCost / contractLengthMonths) * 100) / 100 : 0;
  const contractStartMonth = getContractStartMonth(effectiveDate);
  const contractEndMonth = getContractEndMonth(contractStartMonth, contractLengthMonths);
  const installments = generateInstallments(contractStartMonth, contractLengthMonths, monthlyAmount);

  return {
    id: `fi_${item.eventId}_${item.actionId}`,
    eventId: String(item.eventId),
    actionId: String(item.actionId),
    vintage,
    effectiveDate,
    weighTagNumber,
    ownerName,
    ownerCode,
    lotCode,
    varietal,
    color,
    fruitWeightTons,
    contractLengthMonths,
    contractRatePerTon,
    totalCost,
    smallLotFee: lotSmallLotFee,
    monthlyAmount,
    contractStartMonth,
    contractEndMonth,
    installments,
    savedAt: new Date().toISOString(),
    programId,
    programName,
  };
}

/**
 * Recalculate a record with a new contract length.
 */
export function recalculateRecord(
  record: FruitIntakeRecord,
  newContractLengthMonths: number,
  minProcessingFee: number = 0
): FruitIntakeRecord {
  const contractRatePerTon = record.contractRatePerTon;
  const totalCost = Math.max(record.fruitWeightTons * contractRatePerTon, minProcessingFee) + (record.smallLotFee || 0);
  const monthlyAmount = newContractLengthMonths > 0
    ? Math.round((totalCost / newContractLengthMonths) * 100) / 100
    : 0;
  const contractEndMonth = getContractEndMonth(record.contractStartMonth, newContractLengthMonths);
  const installments = generateInstallments(record.contractStartMonth, newContractLengthMonths, monthlyAmount);

  return {
    ...record,
    contractLengthMonths: newContractLengthMonths,
    contractRatePerTon,
    totalCost,
    monthlyAmount,
    contractEndMonth,
    installments,
  };
}

/**
 * Main entry: fetch, dedup, process, merge with existing records.
 */
export async function runFruitIntake(
  wineryId: string,
  token: string,
  settings: FruitIntakeSettings,
  customerMap: Record<string, string>,
  existingRecords: FruitIntakeRecord[],
  onProgress: (event: ProgressEvent) => void
): Promise<FruitIntakeRunResult> {
  const currentYear = new Date().getFullYear();
  const vintages: number[] = [];
  for (let i = 0; i < settings.vintageLookback; i++) {
    vintages.push(currentYear - i);
  }

  onProgress({
    step: 'fruit-intake',
    message: `Querying vintages: ${vintages.join(', ')}`,
    pct: 5,
  });

  const rawItems = await fetchFruitIntakeReport(
    wineryId,
    token,
    vintages,
    settings.apiPageDelaySeconds,
    onProgress
  );

  // Fetch fruit lots to get tags for program matching and owner names
  onProgress({
    step: 'fruit-lots',
    message: 'Fetching fruit lots for program matching...',
    pct: 52,
  });

  const fruitLots = await fetchFruitLots(wineryId, token, vintages, settings.apiPageDelaySeconds, onProgress);
  const lotTagMap = buildLotTagMap(fruitLots);

  const programs = settings.programs || [];

  onProgress({
    step: 'fruit-lots',
    message: `Lot tag map: ${lotTagMap.size} lots mapped, ${programs.length} programs available.`,
    pct: 55,
  });
  const minProcessingFee = settings.minProcessingFee || 0;
  const defaultContractMonths = settings.defaultContractMonths || 9;
  const smallLotFee = settings.smallLotFee || 0;
  const smallLotThresholdTons = settings.smallLotThresholdTons || 0;

  // Build dedup sets from existing records
  const existingEventIds = new Set(existingRecords.map((r) => r.eventId));
  const existingCompositeKeys = new Set(
    existingRecords.map((r) => `${r.lotCode}_${r.vintage}_${r.effectiveDate}`)
  );

  let newCount = 0;
  let dupCount = 0;
  const newRecords: FruitIntakeRecord[] = [];

  onProgress({
    step: 'fruit-intake',
    message: `Processing ${rawItems.length} records...`,
    pct: 60,
  });

  for (const item of rawItems) {
    const eventId = String(item.eventId);
    const compositeKey = `${item.lot?.lotCode || ''}_${item.vintage}_${item.effectiveAt}`;

    // Tier 1: exact eventId dedup
    if (existingEventIds.has(eventId)) {
      dupCount++;
      continue;
    }

    // Tier 2: composite key dedup
    if (existingCompositeKeys.has(compositeKey)) {
      dupCount++;
      continue;
    }

    const record = processRawRecord(
      item,
      customerMap,
      lotTagMap,
      programs,
      minProcessingFee,
      defaultContractMonths,
      smallLotFee,
      smallLotThresholdTons
    );

    newRecords.push(record);
    existingEventIds.add(eventId);
    existingCompositeKeys.add(compositeKey);
    newCount++;
  }

  // Merge: existing + new
  const allRecords = [...existingRecords, ...newRecords];

  onProgress({
    step: 'fruit-intake',
    message: `Done. ${newCount} new records, ${dupCount} duplicates skipped.`,
    pct: 90,
  });

  return {
    runId: `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    ranAt: new Date().toISOString(),
    vintagesQueried: vintages,
    totalRecords: allRecords.length,
    newRecords: newCount,
    duplicatesSkipped: dupCount,
    records: allRecords,
  };
}
