import { BulkBillingRow, InventoryLot, ProgressEvent } from '../types';
import { fetchInventorySnapshot, getDaysInMonth, getMonthIndex } from './innovintApi';

const THROTTLE_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a lot has a BULK or OOP tag.
 */
function isBulkLot(item: InventoryLot): boolean {
  if (!item.tags) return false;
  return item.tags.some((tag) => /^bulk$/i.test(tag) || /^oop$/i.test(tag));
}

/**
 * Get owner code from the lot's access.owners[0].name field.
 */
function getOwnerCode(item: InventoryLot): string {
  return item.access?.owners?.[0]?.name || 'UNK';
}

/**
 * Aggregate a snapshot's bulk lots into per-customer volume totals.
 */
function aggregateSnapshot(items: InventoryLot[]): Map<string, number> {
  const ownerVolumes = new Map<string, number>();

  for (const item of items) {
    if (!isBulkLot(item)) continue;

    const ownerCode = getOwnerCode(item);
    const volume = item.volume?.value || 0;
    ownerVolumes.set(ownerCode, (ownerVolumes.get(ownerCode) || 0) + volume);
  }

  return ownerVolumes;
}

/**
 * Run the simplified bulk inventory billing process (Step 3).
 * Takes 3 snapshots (day 1, day 15, last day), aggregates by customer,
 * and applies 50%/100% proration.
 */
export async function runBulkInventory(
  wineryId: string,
  token: string,
  month: string,
  year: number,
  bulkStorageRate: number,
  onProgress: (event: ProgressEvent) => void,
  bulkStorageMinimum: number = 0
): Promise<BulkBillingRow[]> {
  const monthIndex = getMonthIndex(month);
  const totalDays = getDaysInMonth(month, year);

  onProgress({
    step: 'bulk',
    message: `Starting bulk inventory for ${month} ${year}. Rate: $${bulkStorageRate}/gal`,
    pct: 60,
  });

  if (bulkStorageRate === 0) {
    onProgress({
      step: 'bulk',
      message: 'Warning: Bulk Storage Rate is $0. Set it in Settings to bill for bulk inventory.',
      pct: -1,
    });
  }

  // 3 snapshot days: day 1, day 15, last day of month
  const snapDays = [1, 15, totalDays];
  const snapTimestamps = snapDays.map((day) => {
    const date = new Date(Date.UTC(year, monthIndex, day, 23, 59, 0));
    return { day, ts: date.toISOString() };
  });

  const snapResults: Map<string, number>[] = [];

  for (let i = 0; i < snapTimestamps.length; i++) {
    const { day, ts } = snapTimestamps[i];

    onProgress({
      step: 'bulk',
      message: `Fetching bulk inventory snapshot ${i + 1}/3 (day ${day})...`,
      pct: 60 + Math.round((i / 3) * 30),
    });

    try {
      const lots = await fetchInventorySnapshot(wineryId, token, ts, (msg) => {
        onProgress({ step: 'bulk', message: msg, pct: -1 });
      });
      snapResults.push(aggregateSnapshot(lots));
    } catch (err) {
      onProgress({
        step: 'bulk',
        message: `Warning: Failed to fetch snapshot ${i + 1} (day ${day}): ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      snapResults.push(new Map());
    }

    if (i < snapTimestamps.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  const [snap1Map, snap2Map, snap3Map] = snapResults;

  // Collect all owner codes across all 3 snapshots
  const allOwners = new Set<string>();
  for (const m of snapResults) {
    for (const ownerCode of m.keys()) {
      allOwners.add(ownerCode);
    }
  }

  onProgress({
    step: 'bulk',
    message: `Building billing rows for ${allOwners.size} customers...`,
    pct: 93,
  });

  const rows: BulkBillingRow[] = [];

  for (const ownerCode of allOwners) {
    const snap1Volume = snap1Map.get(ownerCode) || 0;
    const snap2Volume = snap2Map.get(ownerCode) || 0;
    const snap3Volume = snap3Map.get(ownerCode) || 0;

    const billingVolume = (snap1Volume + snap2Volume + snap3Volume) / 3;
    const proration = snap2Volume > 0 ? 1.0 : 0.5;
    let totalCost = Math.round(billingVolume * bulkStorageRate * proration * 100) / 100;
    if (totalCost > 0 && bulkStorageMinimum > 0) {
      totalCost = Math.max(totalCost, bulkStorageMinimum);
    }

    rows.push({
      ownerCode,
      snap1Volume: Math.round(snap1Volume * 100) / 100,
      snap2Volume: Math.round(snap2Volume * 100) / 100,
      snap3Volume: Math.round(snap3Volume * 100) / 100,
      billingVolume: Math.round(billingVolume * 100) / 100,
      proration,
      rate: bulkStorageRate,
      totalCost,
    });
  }

  rows.sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));

  onProgress({
    step: 'bulk',
    message: `Bulk inventory complete: ${rows.length} billing rows generated.`,
    pct: 100,
  });

  return rows;
}
