import { UserRole } from '../auth/AuthContext';

const BASE_URL = '/api';

// ─── Auth Token Injection ───

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = tokenGetter ? await tokenGetter() : null;
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

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
  setupFeeMode?: 'per_action' | 'spread_daily';
  minDollar?: number;
  freeFirstPerLot?: boolean;
  materialRate?: number;
  bottlesPerCase?: number;
  excludeTaxClasses?: string[];
  excludeAllInclusive?: boolean;
  vesselType?: string;
  analysisSource?: string;
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

export interface FruitProgram {
  id: string;
  name: string;
  description: string;
  ratePerTon: number;
}

export interface FruitIntakeSettings {
  actionTypeKey: string;
  vintageLookback: number;
  apiPageDelaySeconds: number;
  programs: FruitProgram[];
  minProcessingFee: number;
  defaultContractMonths: number;
  smallLotFee: number;
  smallLotThresholdTons: number;
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
  smallLotFee: number;
  installments: FruitInstallment[];
  savedAt: string;
  programId?: string;
  programName?: string;
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

// ─── Customer Record ───

export interface CustomerRecord {
  ownerName: string;
  code: string;
  displayName: string;
  address: string;
  phone: string;
  email: string;
}

// ─── Invoice Types ───

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface CustomerInvoice {
  invoiceType: 'winery-services' | 'fruit-intake';
  invoiceNumber: string;
  issueDate: string;
  title: string;
  subtitle?: string;
  customerName: string;
  ownerCode: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  merchantFee: number;
  totalDue: number;
}

export interface InvoiceCustomerSummary {
  ownerCode: string;
  customerName: string;
  wineryServices: CustomerInvoice | null;
  fruitIntake: CustomerInvoice | null;
  combinedTotal: number;
}

export interface InvoicePreviewResponse {
  customers: InvoiceCustomerSummary[];
  grandTotal: number;
  invoiceCount: number;
  billingMonth: string;
  billingYear: number;
}

export interface AppConfig {
  token: string;
  wineryId: string;
  hasToken: boolean;
  rateRules: RateRule[];
  lastUsedMonth: string;
  lastUsedYear: number;
  barrelSnapshots: BarrelSnapshots;
  bulkStorageRate: number;
  customers: CustomerRecord[];
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
  quantity?: number;
  unit?: string;
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
  snap1Volume: number;
  snap2Volume: number;
  snap3Volume: number;
  billingVolume: number;
  proration: number;
  rate: number;
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

// ─── User Management Types ───

export interface UserInfo {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
  createdBy: string;
}

// ─── API Functions ───

export async function getSettings(): Promise<AppConfig> {
  const res = await apiFetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function saveSettings(data: {
  token?: string;
  wineryId?: string;
  rateRules?: RateRule[];
  lastUsedMonth?: string;
  lastUsedYear?: number;
  bulkStorageRate?: number;
}): Promise<{ success: boolean }> {
  const res = await apiFetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function saveRateRules(rules: RateRule[]): Promise<{ success: boolean }> {
  const res = await apiFetch(`${BASE_URL}/settings/rate-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error('Failed to save rate rules');
  return res.json();
}

export async function saveBillingPrefs(prefs: { lastUsedMonth?: string; lastUsedYear?: number }): Promise<void> {
  await apiFetch(`${BASE_URL}/settings/billing-prefs`, {
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
  const res = await apiFetch(`${BASE_URL}/run-billing`, {
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

export function pollBillingProgress(
  sessionId: string,
  onEvent: (event: { step: string; message: string; pct: number }) => void,
  onDone?: () => void
): { stop: () => void } {
  let after = 0;
  let stopped = false;
  const poll = async () => {
    if (stopped) return;
    try {
      const res = await apiFetch(`${BASE_URL}/billing-progress-poll?sessionId=${sessionId}&after=${after}`);
      if (!res.ok) return;
      const data = await res.json() as { events: Array<{ step: string; message: string; pct: number }>; total: number };
      for (const event of data.events) {
        onEvent(event);
      }
      after = data.total;
      const lastEvent = data.events[data.events.length - 1];
      if (lastEvent && (lastEvent.step === 'complete' || lastEvent.step === 'error')) {
        stopped = true;
        onDone?.();
        return;
      }
    } catch {
      // ignore, retry next poll
    }
    if (!stopped) {
      setTimeout(poll, 1000);
    }
  };
  poll();
  return { stop: () => { stopped = true; } };
}

export async function getBillingResults(sessionId: string): Promise<BillingResults> {
  const res = await apiFetch(`${BASE_URL}/billing-results?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Results not ready');
  return res.json();
}

export async function downloadExcel(sessionId: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/export-excel?sessionId=${sessionId}`);
  if (!res.ok) throw new Error('Failed to download Excel file');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cc-billing-atlas.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function saveBarrelSnapshots(snapshots: BarrelSnapshots): Promise<{ success: boolean }> {
  const res = await apiFetch(`${BASE_URL}/settings/barrel-snapshots`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshots),
  });
  if (!res.ok) throw new Error('Failed to save barrel snapshots');
  return res.json();
}

// ─── Fruit Intake API ───

export async function getFruitIntakeSaved(): Promise<FruitIntakeRunResult | null> {
  const res = await apiFetch(`${BASE_URL}/fruit-intake/saved`);
  if (!res.ok) throw new Error('Failed to load fruit intake data');
  return res.json();
}

export async function runFruitIntake(customerMap: Record<string, string>): Promise<{ sessionId: string }> {
  const res = await apiFetch(`${BASE_URL}/fruit-intake/run`, {
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
  const res = await apiFetch(`${BASE_URL}/fruit-intake/saved`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete fruit intake data');
}

export async function updateFruitIntakeRecord(
  recordId: string,
  updates: { contractLengthMonths?: number; programId?: string; contractRatePerTon?: number; smallLotFee?: number }
): Promise<FruitIntakeRunResult> {
  const res = await apiFetch(`${BASE_URL}/fruit-intake/records/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update record');
  return res.json();
}

export async function saveFruitIntakeSettings(settings: FruitIntakeSettings): Promise<{ success: boolean }> {
  const res = await apiFetch(`${BASE_URL}/settings/fruit-intake-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save fruit intake settings');
  return res.json();
}

export async function saveCustomers(customers: CustomerRecord[]): Promise<{ success: boolean }> {
  const res = await apiFetch(`${BASE_URL}/settings/customers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customers),
  });
  if (!res.ok) throw new Error('Failed to save customers');
  return res.json();
}

// ─── Billable Add-Ons API ───

export async function getBillableAddOns(): Promise<BillableAddOn[]> {
  const res = await apiFetch(`${BASE_URL}/billable-add-ons`);
  if (!res.ok) throw new Error('Failed to load billable add-ons');
  return res.json();
}

export async function addBillableAddOn(addOn: Omit<BillableAddOn, 'id'>): Promise<BillableAddOn[]> {
  const res = await apiFetch(`${BASE_URL}/billable-add-ons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(addOn),
  });
  if (!res.ok) throw new Error('Failed to add billable add-on');
  return res.json();
}

export async function clearBillableAddOnsByMonth(yearMonth: string): Promise<BillableAddOn[]> {
  const res = await apiFetch(`${BASE_URL}/billable-add-ons/clear-month/${encodeURIComponent(yearMonth)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear billable add-ons');
  return res.json();
}

export async function deleteBillableAddOn(id: string): Promise<BillableAddOn[]> {
  const res = await apiFetch(`${BASE_URL}/billable-add-ons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete billable add-on');
  return res.json();
}

// ─── Invoice Export API ───

export async function getInvoicePreview(params: {
  sessionId: string;
  month: string;
  year: number;
  excludedCustomers?: string[];
}): Promise<InvoicePreviewResponse> {
  const res = await apiFetch(`${BASE_URL}/export/invoices/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to generate invoice preview');
  }
  return res.json();
}

export async function downloadInvoiceZip(params: {
  sessionId: string;
  month: string;
  year: number;
  excludedCustomers?: string[];
}): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(`${BASE_URL}/export/invoices/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to download invoices');
  }
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : 'Invoices.zip';
  const blob = await res.blob();
  return { blob, filename };
}

// ─── User Management API ───

export async function getUsers(): Promise<UserInfo[]> {
  const res = await apiFetch(`${BASE_URL}/users`);
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function createUser(email: string, role: UserRole): Promise<{ uid: string; email: string; role: UserRole; resetLink: string }> {
  const res = await apiFetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create user');
  }
  return res.json();
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/users/${encodeURIComponent(uid)}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update role');
  }
}

export async function deleteUser(uid: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete user');
  }
}

export async function getResetLink(uid: string): Promise<string> {
  const res = await apiFetch(`${BASE_URL}/users/${encodeURIComponent(uid)}/reset-link`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to generate reset link');
  const data = await res.json();
  return data.resetLink;
}

// ─── Helpers ───

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
