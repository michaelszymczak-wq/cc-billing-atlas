// ─── InnoVint API Response Types ───
// Matches the real API at sutter.innovint.us

export interface ActionApiItem {
  _id: number;
  publicId: string;
  actionType: string;
  effectiveAt: string;
  performedBy?: { name: string };
  notes?: Array<{
    text: string;
    _id?: number;
  }>;
  lotAccess?: {
    owners?: Array<{ _id: number; name: string }>;
  };
  actionData?: {
    analyses?: Array<{
      analysisType: {
        name: string;
        _id?: number;
      };
      value?: number;
      unit?: string;
      lot?: {
        _id: number;
        lotCode: string;
        publicId?: string;
      };
      vessel?: {
        _id: number;
        vesselCode: string;
        vesselType: string;
        capacity?: { value: number; unit: string };
      };
    }>;
    panelName?: string;
    source?: string;
    name?: string;
    instructions?: string;
    lot?: {
      _id: number;
      publicId?: string;
      lotCode: string;
    };
    vessels?: Array<{
      _id: number;
      vesselCode: string;
      vesselType: string;
      publicId?: string;
      capacity?: { value: number; unit: string };
    }>;
    additives?: Array<{
      name: string;
      quantity?: number;
      unit?: string;
    }>;
    drains?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
      volume?: { value: number; unit: string };
    }>;
    fills?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
      volume?: { value: number; unit: string };
    }>;
    involvedLots?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
    }>;
  };
  workOrder?: {
    _id: number;
    name: string;
  };
  wineryContents?: {
    volume?: { value: number; unit: string };
  };
}

// ─── Rate Rule (user-defined billing logic) ───

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

// ─── Processed Action Row ───

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
  vesselTypes?: string;
  quantity?: number;
  unit?: string;
  rawActionType?: string;
}

// ─── Audit Row ───

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

// ─── Bulk Inventory ───

export interface LotSnapshot {
  lotCode: string;
  ownerCode: string;
  totalVolume: number;
  tankVolume: number;
  barrelCount: number;
  kegCount: number;
  tankDays: Set<string>;
  barrelDays: Set<string>;
  kegDays: Set<string>;
  maxBarrelCount: number;
  maxKegCount: number;
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

// ─── Inventory API Types (real structure) ───

export interface InventoryLot {
  lot: {
    _id: number;
    lotCode: string;
    publicId?: string;
  };
  tags?: string[];
  volume?: { value: number; unit: string };
  vessels?: Array<{
    _id: number;
    vesselCode: string;
    vesselType: string;
    capacity?: { value: number; unit: string };
  }>;
}

// ─── Barrel Inventory ───

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

// ─── Billing Request / Response ───

export interface BillingRequest {
  month: string;
  year: number;
  rateRules: RateRule[];
  steps: string[];
}

export interface BillingResponse {
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

// ─── Fruit Intake ───

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

// ─── Fruit Intake API Response ───

export interface FruitIntakeApiItem {
  eventId: number;
  actionId: number;
  weighTagNumber: string;
  effectiveAt: string;
  vintage: number;
  voided: boolean;
  fruitWeight: { value: number; unit: string };
  lot: { _id: number; lotCode: string; fruitLot?: boolean; color?: string };
  access?: { owners?: Array<{ _id: number; name: string }> };
  varietal?: { _id: number; name: string };
  vineyard?: { _id: number; name: string };
  block?: { _id: number; name: string };
  appellation?: { _id: number; name: string };
  grower?: { _id: number; name: string };
}

// ─── Billable Add-Ons ───

export interface BillableAddOn {
  id: string;
  date: string;            // YYYY-MM-DD
  rateRuleId: string;      // references RateRule.id
  rateRuleLabel: string;   // snapshot of label at time of creation
  quantity: number;         // up to 3 decimal places
  ownerCode: string;
  rate: number;             // from RateRule.rate
  billingUnit: string;      // from RateRule.billingUnit
  totalCost: number;        // rate * quantity
  notes: string;
}

// ─── Settings / Config ───

export interface AppSettings {
  token: string;
  wineryId: string;
  rateRules: RateRule[];
  lastUsedMonth: string;
  lastUsedYear: number;
  barrelSnapshots: BarrelSnapshots;
  fruitIntake: FruitIntakeRunResult | null;
  customerMap: Record<string, string>;
  fruitIntakeSettings: FruitIntakeSettings;
  billableAddOns: BillableAddOn[];
}

// ─── SSE Progress ───

export interface ProgressEvent {
  step: string;
  message: string;
  pct: number;
}

// ─── Session Store ───

export interface SessionData {
  billingResult?: BillingResponse;
}

// ─── Omitted Action Types ───

export const OMITTED_ACTION_TYPES = [
  'CREATE_LOT',
  'PULL_SAMPLE',
  'RECEIVE_DRY_GOOD',
  'UPDATE_LOT',
  'BATCH_ADJUSTMENT',
  'CREATE_VESSEL',
  'INVENTORY_LOSSES',
];
