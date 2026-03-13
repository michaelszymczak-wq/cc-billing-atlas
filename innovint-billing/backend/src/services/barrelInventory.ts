import { parse } from 'csv-parse/sync';
import { BarrelBillingRow, BarrelSnapshots, ProgressEvent, RateRule } from '../types';
import { getDaysInMonth, getMonthIndex } from './innovintApi';

const BASE_URL = 'https://sutter.innovint.us';
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Step 1: Trigger vessel inventory export ───

async function triggerExport(wineryId: string, token: string, timestamp: string): Promise<string> {
  const url = new URL(`${BASE_URL}/wineries/${wineryId}/vesselsInventory`);
  url.searchParams.set('effectiveAt', timestamp);
  url.searchParams.set('timeZone', 'America/Los_Angeles');

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Access-Token ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Export trigger failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { _id: string };
  return data._id;
}

// ─── Step 2: Poll for export completion ───

async function pollExport(
  exportId: string,
  token: string,
  onAttempt: (attempt: number) => void
): Promise<string> {
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(POLL_INTERVAL_MS);

    onAttempt(attempt);

    const res = await fetch(`${BASE_URL}/exports/${exportId}`, {
      headers: {
        'Authorization': `Access-Token ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Export poll failed: ${res.status}`);
    }

    const data = (await res.json()) as { status: string; file?: string };
    if (data.status === 'FINISHED' && data.file) {
      return data.file;
    }
  }

  throw new Error(`Export ${exportId} did not finish after ${POLL_MAX_ATTEMPTS} attempts`);
}

// ─── Step 3: Download and parse CSV ───

interface VesselRow {
  vesselCode: string;
  fill: string;
  vesselType: string;
  owner: string;
  style: string;
}

async function downloadAndParseCsv(fileUrl: string): Promise<VesselRow[]> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`CSV download failed: ${res.status}`);
  }

  const text = await res.text();
  const allRows: string[][] = parse(text, { relax_column_count: true });

  // Row 0 = blank/title, row 1 = blank/subtitle, row 2 = headers, row 3+ = data
  if (allRows.length < 3) return [];

  const headerRow = allRows[2].map((h: string) => h.trim().toLowerCase());

  const vesselCodeIdx = headerRow.findIndex((h: string) => h.includes('vessel code'));
  const fillIdx = headerRow.findIndex((h: string) => h.includes('fill'));
  const vesselTypeIdx = headerRow.findIndex((h: string) => h.includes('vessel type'));
  const ownerIdx = headerRow.findIndex((h: string) => h.includes('owner') || h.includes('access'));
  const styleIdx = headerRow.findIndex((h: string) => h === 'style');

  const result: VesselRow[] = [];
  for (let i = 3; i < allRows.length; i++) {
    const row = allRows[i];
    result.push({
      vesselCode: vesselCodeIdx >= 0 ? (row[vesselCodeIdx] ?? '') : '',
      fill: fillIdx >= 0 ? (row[fillIdx] ?? '') : '',
      vesselType: vesselTypeIdx >= 0 ? (row[vesselTypeIdx] ?? '') : '',
      owner: ownerIdx >= 0 ? (row[ownerIdx] ?? '').trim() : '',
      style: styleIdx >= 0 ? (row[styleIdx] ?? '').trim() : '',
    });
  }

  return result;
}

// ─── Empty barrel filter (ported from GAS) ───

function countEmptyBarrels(rows: VesselRow[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const { fill, vesselType, owner, style } of rows) {
    const fillValue = fill.trim();
    const fillNum = parseFloat(fillValue);
    const isEmpty = isNaN(fillNum) || fillNum === 0 || fillValue === '';
    const vt = vesselType.toUpperCase();
    const isBarrel = vt === 'BARREL';
    const isTirage = vt === 'TIRAGE';
    const ownerCode = owner.trim();

    if (isEmpty && (isBarrel || isTirage) && ownerCode) {
      let key: string;
      if (isTirage) {
        key = `${ownerCode}-Tirage`;
      } else if (style.toUpperCase().includes('PUNCHEON')) {
        key = `${ownerCode}-Puncheon`;
      } else {
        key = ownerCode;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

// ─── Rate rule matching ───

function findBarrelStorageRules(rules: RateRule[]): { regular?: RateRule; puncheon?: RateRule; tirage?: RateRule } {
  const keywords = ['EMPTY', 'BARREL', 'STORAGE'];
  let regular: RateRule | undefined;
  let puncheon: RateRule | undefined;
  let tirage: RateRule | undefined;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const combined = `${rule.actionType} ${rule.variation}`.toUpperCase();
    if (!keywords.every((kw) => combined.includes(kw))) continue;

    if (combined.includes('TIRAGE')) {
      tirage = rule;
    } else if (combined.includes('PUNCHEON')) {
      puncheon = rule;
    } else if (!regular) {
      regular = rule;
    }
  }

  return { regular, puncheon, tirage };
}

// ─── Snapshot timestamp builder ───

function buildTimestamp(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day, 7, 59, 59)).toISOString();
}

// ─── Run a single snapshot: trigger → poll → download → count ───

async function runSingleSnapshot(
  wineryId: string,
  token: string,
  year: number,
  monthIndex: number,
  day: number,
  snapIdx: number,
  onProgress: (event: ProgressEvent) => void
): Promise<Map<string, number>> {
  const snapLabel = `Snapshot ${snapIdx + 1}/3 (day ${day})`;

  onProgress({ step: 'barrels', message: `${snapLabel}: triggering export...`, pct: -1 });

  const timestamp = buildTimestamp(year, monthIndex, day);
  let exportId: string;
  try {
    exportId = await triggerExport(wineryId, token, timestamp);
  } catch (err) {
    onProgress({
      step: 'barrels',
      message: `${snapLabel}: trigger failed — ${err instanceof Error ? err.message : 'Unknown error'}. Using 0 for this slot.`,
      pct: -1,
    });
    return new Map();
  }

  let fileUrl: string;
  try {
    fileUrl = await pollExport(exportId, token, (attempt) => {
      onProgress({
        step: 'barrels',
        message: `${snapLabel}: waiting for export... (attempt ${attempt}/${POLL_MAX_ATTEMPTS})`,
        pct: -1,
      });
    });
  } catch (err) {
    onProgress({
      step: 'barrels',
      message: `${snapLabel}: ${err instanceof Error ? err.message : 'Unknown error'}. Using 0 for this slot.`,
      pct: -1,
    });
    return new Map();
  }

  onProgress({ step: 'barrels', message: `${snapLabel}: downloading and parsing CSV...`, pct: -1 });

  let rows: VesselRow[];
  try {
    rows = await downloadAndParseCsv(fileUrl);
  } catch (err) {
    onProgress({
      step: 'barrels',
      message: `${snapLabel}: CSV parse failed — ${err instanceof Error ? err.message : 'Unknown error'}. Using 0 for this slot.`,
      pct: -1,
    });
    return new Map();
  }

  const counts = countEmptyBarrels(rows);
  onProgress({
    step: 'barrels',
    message: `${snapLabel}: found ${counts.size} owner codes with empty barrels.`,
    pct: -1,
  });

  return counts;
}

// ─── Main exported function ───

export async function runBarrelInventory(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  rateRules: RateRule[],
  snapshots: BarrelSnapshots,
  onProgress: (event: ProgressEvent) => void
): Promise<BarrelBillingRow[]> {
  const monthIndex = getMonthIndex(month);
  const totalDays = getDaysInMonth(month, year);

  const { regular: regularRule, puncheon: puncheonRule, tirage: tirageRule } = findBarrelStorageRules(rateRules);
  const regularRate = regularRule?.rate ?? 0;
  const regularSetupFee = regularRule?.setupFee ?? 0;
  const puncheonRate = puncheonRule?.rate ?? 0;
  const puncheonSetupFee = puncheonRule?.setupFee ?? 0;
  const tirageRate = tirageRule?.rate ?? 0;
  const tirageSetupFee = tirageRule?.setupFee ?? 0;

  if (!regularRule && !puncheonRule && !tirageRule) {
    onProgress({
      step: 'barrels',
      message: 'Warning: No Empty Barrel Storage rate rules found. Charges will be $0.',
      pct: -1,
    });
  } else {
    if (regularRule) {
      onProgress({
        step: 'barrels',
        message: `Regular rate: "${regularRule.label}": $${regularRate}/barrel + $${regularSetupFee} setup.`,
        pct: -1,
      });
    }
    if (puncheonRule) {
      onProgress({
        step: 'barrels',
        message: `Puncheon rate: "${puncheonRule.label}": $${puncheonRate}/barrel + $${puncheonSetupFee} setup.`,
        pct: -1,
      });
    }
    if (tirageRule) {
      onProgress({
        step: 'barrels',
        message: `Tirage rate: "${tirageRule.label}": $${tirageRate}/barrel + $${tirageSetupFee} setup.`,
        pct: -1,
      });
    }
  }

  // Resolve snapshot days
  const snap3Day = snapshots.snap3Day === 'last' ? totalDays : snapshots.snap3Day;
  const snapDays = [snapshots.snap1Day, snapshots.snap2Day, snap3Day];

  onProgress({
    step: 'barrels',
    message: `Starting barrel inventory for ${month} ${year}. Snapshots on days: ${snapDays.join(', ')}.`,
    pct: 60,
  });

  // Run three snapshots sequentially
  const snapCounts: Map<string, number>[] = [];
  for (let i = 0; i < snapDays.length; i++) {
    const counts = await runSingleSnapshot(wineryId, token, year, monthIndex, snapDays[i], i, onProgress);
    snapCounts.push(counts);

    onProgress({
      step: 'barrels',
      message: `Snapshot ${i + 1}/3 complete.`,
      pct: 65 + (i + 1) * 10,
    });
  }

  // Aggregate all owner codes
  const allOwners = new Set<string>();
  for (const map of snapCounts) {
    for (const owner of map.keys()) allOwners.add(owner);
  }

  const billingRows: BarrelBillingRow[] = [];
  for (const ownerCode of allOwners) {
    const snap1 = snapCounts[0]?.get(ownerCode) ?? 0;
    const snap2 = snapCounts[1]?.get(ownerCode) ?? 0;
    const snap3 = snapCounts[2]?.get(ownerCode) ?? 0;
    const avgBarrels = Math.round(((snap1 + snap2 + snap3) / 3) * 100) / 100;
    const isPuncheon = ownerCode.endsWith('-Puncheon');
    const isTirage = ownerCode.endsWith('-Tirage');
    const rate = isTirage ? tirageRate : isPuncheon ? puncheonRate : regularRate;
    const setupFee = isTirage ? tirageSetupFee : isPuncheon ? puncheonSetupFee : regularSetupFee;
    const charge = Math.round((avgBarrels * rate + setupFee) * 100) / 100;
    billingRows.push({ ownerCode, snap1, snap2, snap3, avgBarrels, rate, charge });
  }

  billingRows.sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));

  onProgress({
    step: 'barrels',
    message: `Barrel inventory complete: ${billingRows.length} owner codes billed.`,
    pct: 95,
  });

  return billingRows;
}
