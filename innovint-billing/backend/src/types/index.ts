// ─── Auth Types ───

export type UserRole = 'admin' | 'team_member' | 'cellar';

export interface UserRecord {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
  createdBy: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

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
      taxClass?: string;
    };
    vessels?: Array<{
      _id: number;
      vesselCode: string;
      vesselType: string;
      publicId?: string;
      capacity?: { value: number; unit: string };
      volume?: { value: number; unit: string };
      startingVolume?: { value: number; unit: string };
      volumeChange?: { value: number; unit: string };
    }>;
    additives?: Array<{
      name?: string;
      quantity?: number;
      unit?: string;
      additionRateUnit?: string;
      additionRateValue?: number;
      additive?: {
        _id: number;
        productName: string;
        additionUnit?: string;
        inventoryUnit?: string;
        access?: { global?: boolean; owners?: Array<{ _id: number; name: string }> };
      };
      batches?: Array<{
        amount: number;
      }>;
    }>;
    drains?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
      volume?: { value: number; unit: string };
      vessels?: Array<{
        vessel?: { vesselCode: string; vesselType?: string };
        volume?: { value: number; unit: string };
        startingVolume?: { value: number; unit: string };
        volumeChange?: { value: number; unit: string };
      }>;
    }>;
    fills?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
      volume?: { value: number; unit: string };
      vessels?: Array<{
        vessel?: { vesselCode: string; vesselType?: string };
        volume?: { value: number; unit: string };
        startingVolume?: { value: number; unit: string };
        volumeChange?: { value: number; unit: string };
        numberOfFilledBottles?: number;
      }>;
    }>;
    involvedLots?: Array<{
      lot?: { lotCode: string };
      vessel?: { vesselCode: string; vesselType?: string; customerIdPrefix?: string };
      volume?: { value: number; unit: string };
      startingVolume?: { value: number; unit: string };
      volumeChange?: { value: number; unit: string };
    }>;
    complianceContext?: string;
    lots?: Array<{
      lot?: { _id: number; lotCode: string; taxClass?: string };
      vessels?: Array<{ _id: number; vesselCode: string; vesselType: string }>;
    }>;
    bottleFormats?: Array<{
      bottleType: { name: string; volume?: { value: number; unit: string }; _id?: number };
      bottlesPerCase: number;
      cases: number;
      bottles: number;
      pallets: number;
      casesPerPallet: number;
      caseGoodsLot?: { _id: number; lotCode: string };
    }>;
    bottleFormat?: {
      bottleType?: { name: string; volume?: { value: number; unit: string }; _id?: number };
      bottlesPerCase: number;
      cases: number;
      bottles: number;
      pallets: number;
      casesPerPallet: number;
    };
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
  vesselCount?: number;
  bottlesPerCase?: number;
  taxClass?: string;
  materialChargeApplies?: boolean;
  additiveQuantity?: number;
  analysisSource?: string;
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
  access?: { owners?: Array<{ _id: number; name: string }> };
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
  skipCurrentYearBarrels?: boolean;
  barrelRate: number;
  puncheonRate: number;
  tirageRate: number;
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

// ─── Fruit Programs ───

export interface FruitProgram {
  id: string;
  name: string;           // "Program #1" — matches lot tag value
  description: string;    // "Red Wine"
  ratePerTon: number;     // 2300
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

// ─── Customer Record ───

export interface CustomerRecord {
  ownerName: string;   // InnoVint API owner name (was customerMap key)
  code: string;        // billing code (was customerMap value / qbCustomerMap key)
  displayName: string; // invoice display name (was qbCustomerMap value)
  address: string;
  phone: string;
  email: string;
}

// ─── Settings / Config ───

export interface AppSettings {
  token: string;
  wineryId: string;
  rateRules: RateRule[];
  lastUsedMonth: string;
  lastUsedYear: number;
  barrelSnapshots: BarrelSnapshots;
  bulkStorageRate: number;
  bulkStorageMinimum: number;
  fruitIntake: FruitIntakeRunResult | null;
  customers: CustomerRecord[];
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

// ─── Invoice Types ───

export interface InvoiceSections {
  actions?: boolean;
  bulkStorage?: boolean;
  barrelStorage?: boolean;
  addOns?: boolean;
  fruitIntake?: boolean;
}

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

export interface InvoiceCategoryTotals {
  actions: number;
  bulkStorage: number;
  barrelStorage: number;
  addOns: number;
  fruitIntake: number;
}

export interface InvoiceCustomerSummary {
  ownerCode: string;
  customerName: string;
  wineryServices: CustomerInvoice | null;
  fruitIntake: CustomerInvoice | null;
  combinedTotal: number;
  categoryTotals: InvoiceCategoryTotals;
}

export interface InvoicePreviewResponse {
  customers: InvoiceCustomerSummary[];
  grandTotal: number;
  invoiceCount: number;
  billingMonth: string;
  billingYear: number;
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
