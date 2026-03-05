const BASE_URL = '/api';

// ─── Shared Types ───

export interface RateRule {
  id: string;
  actionType: string;
  variation: string;
  label: string;
  billingUnit: string;
  rate: number;
  setupFee: number;
  minQty: number;
  maxQty: number;
  notes: string;
  enabled: boolean;
}

export interface BarrelBillingRow {
  ownerCode: string;
  snap1: number;
  snap2: number;
  snap3: number;
  avgBarrels: number;
  rate: number;
  charge: number;
}

export interface BarrelSnapshots {
  snap1Day: number;
  snap2Day: number;
  snap3Day: number | 'last';
}

export interface ContractLengthRule {
  color: string;
  varietal: string;
  months: number;
}

export interface FruitIntakeRate {
  vintage: number;
  contractMonths: number;
  ratePerTon: number;
}

export interface FruitIntakeSettings {
  actionTypeKey: string;
  vintageLookback: number;
  apiPageDelaySeconds: number;
  contractLengthRules: ContractLengthRule[];
  rates: FruitIntakeRate[];
}

export interface FruitInstallment {
  month: string;
  amount: number;
}

export interface FruitIntakeRecord {
  id: string;
  eventId: string;
  actionId: string;
  vintage: number;
  effectiveDate: string;
  weighTagNumber: string;
  ownerName: string;
  ownerCode: string;
  lotCode: string;
  varietal: string;
  color: string;
  fruitWeightTons: number;
  contractLengthMonths: number;
  contractRatePerTon: number;
  totalCost: number;
  monthlyAmount: number;
  contractStartMonth: string;
  contractEndMonth: string;
  installments: FruitInstallment[];
  savedAt: string;
}

export interface FruitIntakeRunResult {
  runId: string;
  ranAt: string;
  vintagesQueried: number[];
  totalRecords: number;
  newRecords: number;
  duplicatesSkipped: number;
  records: FruitIntakeRecord[];
}

export interface BillableAddOn {
  id: string;
  date: string;
  rateRuleId: string;
  rateRuleLabel: string;
  quantity: number;
  ownerCode: string;
  rate: number;
  billingUnit: string;
  totalCost: number;
  notes: string;
}

export interface AppConfig {
  token: string;
  wineryId: string;
  hasToken: boolean;
  rateRules: RateRule[];
  lastUsedMonth: string;
  lastUsedYear: number;
  barrelSnapshots: BarrelSnapshots;
  customerMap: Record<string, string>;
  fruitIntakeSettings: FruitIntakeSettings;
  billableAddOns: BillableAddOn[];
}

export interface ActionRow {
  actionType: string;
  actionId: string;
  lotCodes: string;
  performer: string;
  date: string;
  ownerCode: string;
  analysisOrNotes: string;
  hours: number;
  rate: number;
  setupFee: number;
  total: number;
  matched: boolean;
  matchedRuleLabel: string;
  error?: string;
}

export interface AuditRow {
  actionType: string;
  actionId: string;
  lotCodes: string;
  performer: string;
  date: string;
  ownerCode: string;
  analysisOrNotes: string;
  reason: string;
}

export interface BulkBillingRow {
  ownerCode: string;
  lotCode: string;
  tankVolume: number;
  barrelCount: number;
  kegCount: number;
  tankDaysPresent: number;
  barrelDaysPresent: number;
  kegDaysPresent: number;
  totalDays: number;
  tankPct: number;
  barrelPct: number;
  kegPct: number;
  tankRate: number;
  barrelRate: number;
  kegRate: number;
  tankCost: number;
  barrelCost: number;
  kegCost: number;
  totalCost: number;
}

export interface BillingResults {
  actions: ActionRow[];
  auditRows: AuditRow[];
  bulkInventory: BulkBillingRow[];
  barrelInventory: BarrelBillingRow[];
  summary: {
    totalActions: number;
    totalBilled: number;
    auditCount: number;
    bulkLots: number;
    barrelOwners: number;
  };
}

// ─── API Functions ───

export async function getSettings(): Promise<AppConfig> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function saveSettings(data: {
  token?: string;
  wineryId?: string;
  rateRules?: RateRule[];
  lastUsedMonth?: string;
  lastUsedYear?: number;
}): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function saveRateRules(rules: RateRule[]): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/rate-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error('Failed to save rate rules');
  return res.json();
}

export async function saveBillingPrefs(prefs: { lastUsedMonth?: string; lastUsedYear?: number }): Promise<void> {
  await fetch(`${BASE_URL}/settings/billing-prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
}

export async function runBilling(params: {
  month: string;
  year: number;
  rateRules: RateRule[];
  steps: string[];
}): Promise<{ sessionId: string }> {
  const res = await fetch(`${BASE_URL}/run-billing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start billing');
  }
  return res.json();
}

export function subscribeToBillingProgress(
  sessionId: string,
  onEvent: (event: { step: string; message: string; pct: number }) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${BASE_URL}/billing-progress?sessionId=${sessionId}`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {
      // ignore
    }
  };
  if (onError) es.onerror = onError;
  return es;
}

export async function getBillingResults(sessionId: string): Promise<BillingResults> {
  const res = await fetch(`${BASE_URL}/billing-results?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Results not ready');
  return res.json();
}

export function getExcelDownloadUrl(sessionId: string): string {
  return `${BASE_URL}/export-excel?sessionId=${sessionId}`;
}

export async function saveBarrelSnapshots(snapshots: BarrelSnapshots): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/barrel-snapshots`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshots),
  });
  if (!res.ok) throw new Error('Failed to save barrel snapshots');
  return res.json();
}

// ─── Fruit Intake API ───

export async function getFruitIntakeSaved(): Promise<FruitIntakeRunResult | null> {
  const res = await fetch(`${BASE_URL}/fruit-intake/saved`);
  if (!res.ok) throw new Error('Failed to load fruit intake data');
  return res.json();
}

export async function runFruitIntake(customerMap: Record<string, string>): Promise<{ sessionId: string }> {
  const res = await fetch(`${BASE_URL}/fruit-intake/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerMap }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start fruit intake');
  }
  return res.json();
}

export async function deleteFruitIntakeSaved(): Promise<void> {
  const res = await fetch(`${BASE_URL}/fruit-intake/saved`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete fruit intake data');
}

export async function updateFruitIntakeRecord(
  recordId: string,
  updates: { contractLengthMonths: number }
): Promise<FruitIntakeRunResult> {
  const res = await fetch(`${BASE_URL}/fruit-intake/records/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update record');
  return res.json();
}

export async function saveFruitIntakeSettings(settings: FruitIntakeSettings): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/fruit-intake-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save fruit intake settings');
  return res.json();
}

export async function saveCustomerMap(customerMap: Record<string, string>): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/settings/customer-map`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerMap),
  });
  if (!res.ok) throw new Error('Failed to save customer map');
  return res.json();
}

// ─── Billable Add-Ons API ───

export async function getBillableAddOns(): Promise<BillableAddOn[]> {
  const res = await fetch(`${BASE_URL}/billable-add-ons`);
  if (!res.ok) throw new Error('Failed to load billable add-ons');
  return res.json();
}

export async function addBillableAddOn(addOn: Omit<BillableAddOn, 'id'>): Promise<BillableAddOn[]> {
  const res = await fetch(`${BASE_URL}/billable-add-ons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(addOn),
  });
  if (!res.ok) throw new Error('Failed to add billable add-on');
  return res.json();
}

export async function deleteBillableAddOn(id: string): Promise<BillableAddOn[]> {
  const res = await fetch(`${BASE_URL}/billable-add-ons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete billable add-on');
  return res.json();
}

// ─── Helpers ───

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
