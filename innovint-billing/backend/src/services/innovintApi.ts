import { ActionApiItem, InventoryLot, OMITTED_ACTION_TYPES, ProgressEvent } from '../types';

const BASE_URL = 'https://sutter.innovint.us';
const PAGE_SIZE = 50;

/**
 * Parse content-range header: "items 0-49/1234" → { total: 1234 }
 */
function parseContentRange(header: string | null): { total: number } {
  if (!header) return { total: 0 };
  const match = /\/(\d+)/.exec(header);
  return { total: match ? parseInt(match[1], 10) : 0 };
}

export async function fetchAllActions(
  wineryId: string,
  token: string,
  startDate: string,
  endDate: string,
  onProgress: (event: ProgressEvent) => void
): Promise<ActionApiItem[]> {
  const allActions: ActionApiItem[] = [];
  let offset = 0;
  let totalItems = Infinity;

  while (offset < totalItems) {
    const url = new URL(`${BASE_URL}/wineries/${wineryId}/actions`);
    url.searchParams.set('actionTypes', 'FILTER,ANALYSIS,CUSTOM,BOND_TO_BOND_TRANSFER_IN,BOND_TO_BOND_TRANSFER_OUT,BOTTLE,ADDITION,VOLUME_ADJUSTMENT,BOTTLING_EN_TIRAGE');
    url.searchParams.set('startEffectiveAt', startDate);
    url.searchParams.set('endEffectiveAt', endDate);
    url.searchParams.set('includeWineryContents', 'True');
    url.searchParams.set('sort', 'effectiveAt:-1');
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    const page = Math.floor(offset / PAGE_SIZE) + 1;
    onProgress({
      step: 'actions',
      message: `Fetching actions page ${page} (offset ${offset})...`,
      pct: Math.min(30, totalItems === Infinity ? 5 : Math.round((offset / totalItems) * 30)),
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
        step: 'actions',
        message: `Network error on page ${page}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        pct: -1,
      });
      break;
    }

    if (response.status === 429) {
      onProgress({
        step: 'actions',
        message: 'Rate limited by InnoVint API. Stopping pagination.',
        pct: -1,
      });
      break;
    }

    if (!response.ok) {
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      onProgress({
        step: 'actions',
        message: `API error ${response.status}: ${response.statusText}. ${body.slice(0, 200)}`,
        pct: -1,
      });
      break;
    }

    // Parse content-range for total count
    const contentRange = response.headers.get('content-range');
    const { total } = parseContentRange(contentRange);
    if (total > 0) totalItems = total;

    const data = (await response.json()) as unknown;
    const items: ActionApiItem[] = Array.isArray(data) ? data : [];

    if (items.length === 0) break;

    const filtered = items.filter(
      (item) => !OMITTED_ACTION_TYPES.includes(item.actionType)
    );
    allActions.push(...filtered);
    offset += items.length;

    // If we got fewer than PAGE_SIZE, we're done
    if (items.length < PAGE_SIZE) break;
  }

  onProgress({
    step: 'actions',
    message: `Fetched ${allActions.length} actions total.`,
    pct: 30,
  });

  return allActions;
}

export async function fetchInventorySnapshot(
  wineryId: string,
  token: string,
  timestamp: string,
  onProgress?: (msg: string) => void
): Promise<InventoryLot[]> {
  const allLots: InventoryLot[] = [];
  let offset = 0;
  const size = 100;

  while (true) {
    const url = new URL(`${BASE_URL}/wineries/${wineryId}/lotsInventory`);
    url.searchParams.set('sort', 'totalContents:-1');
    url.searchParams.set('includeVessels', 'true');
    url.searchParams.set('contents', 'true');
    url.searchParams.set('lotTypes', 'JUICE_WINE');
    url.searchParams.set('ngsw-bypass', 'true');
    url.searchParams.set('size', String(size));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('time', timestamp);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Access-Token ${token}`,
          'Accept': 'application/json',
        },
      });
    } catch (err) {
      if (onProgress) {
        onProgress(`Network error fetching inventory at offset ${offset}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
      break;
    }

    if (response.status === 429) {
      if (onProgress) {
        onProgress('Rate limited during inventory fetch. Stopping pagination for this snapshot.');
      }
      break;
    }

    if (!response.ok) {
      if (onProgress) {
        onProgress(`Inventory API error ${response.status}: ${response.statusText}`);
      }
      break;
    }

    const data = (await response.json()) as unknown;
    const items: InventoryLot[] = Array.isArray(data) ? data : [];
    allLots.push(...items);

    if (items.length < size) break;
    offset += items.length;
  }

  return allLots;
}

export async function fetchLotVolume(
  wineryId: string,
  token: string,
  lotCode: string,
  timestamp: string
): Promise<number> {
  const url = new URL(`${BASE_URL}/wineries/${wineryId}/lotsInventory`);
  url.searchParams.set('q', lotCode);
  url.searchParams.set('time', timestamp);
  url.searchParams.set('lotTypes', 'JUICE_WINE');
  url.searchParams.set('includeVessels', 'true');
  url.searchParams.set('contents', 'true');
  url.searchParams.set('size', '100');
  url.searchParams.set('offset', '0');
  url.searchParams.set('sort', 'totalContents:-1');
  url.searchParams.set('ngsw-bypass', 'true');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Access-Token ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return 0;

    const data = (await response.json()) as unknown;
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) return 0;

    const volume = items[0]?.volume?.value;
    return typeof volume === 'number' ? volume : 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch the owner of a vessel by its vesselCode.
 * Returns the first owner name, or '' if none found.
 */
export async function fetchVesselOwner(
  wineryId: string,
  token: string,
  vesselCode: string
): Promise<string> {
  const url = new URL(`${BASE_URL}/wineries/${wineryId}/vessels`);
  url.searchParams.set('vesselCode', vesselCode);
  url.searchParams.set('size', '1');
  url.searchParams.set('offset', '0');
  url.searchParams.set('sort', 'vesselType:1,vesselCode:1');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Access-Token ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return '';

    const data = (await response.json()) as unknown;
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) return '';

    const ownerName = items[0]?.access?.owners?.[0]?.name;
    return typeof ownerName === 'string' ? ownerName : '';
  } catch {
    return '';
  }
}

export function getMonthDateRange(month: string, year: number): { start: string; end: string } {
  const monthIndex = getMonthIndex(month);
  if (monthIndex === -1) {
    throw new Error(`Invalid month: ${month}`);
  }

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function getDaysInMonth(month: string, year: number): number {
  const monthIndex = getMonthIndex(month);
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getMonthIndex(month: string): number {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ].indexOf(month);
}
