import {
  ActionRow,
  BarrelBillingRow,
  BillableAddOn,
  BulkBillingRow,
  CustomerInvoice,
  CustomerRecord,
  FruitIntakeRecord,
  InvoiceCustomerSummary,
  InvoiceLineItem,
  InvoicePreviewResponse,
} from '../types';

const MERCHANT_FEE_RATE = 0.03;

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatIssueDate(month: string, year: number): string {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return `${year}-12-31`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function makeInvoiceNumber(year: number, month: string, ownerCode: string, seq: number): string {
  const monthIndex = MONTHS.indexOf(month);
  const mm = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${mm}-${ownerCode}-${String(seq).padStart(3, '0')}`;
}

function buildMerchantFeeItem(subtotal: number): InvoiceLineItem {
  return {
    description: 'Merchant Fee (3%)',
    quantity: 1,
    price: round2(subtotal * MERCHANT_FEE_RATE),
    amount: round2(subtotal * MERCHANT_FEE_RATE),
  };
}

export function buildInvoicePreview(
  actions: ActionRow[],
  barrelInv: BarrelBillingRow[],
  bulkInv: BulkBillingRow[],
  fruitRecords: FruitIntakeRecord[],
  addOns: BillableAddOn[],
  month: string,
  year: number,
  excludedCustomers: string[],
  customers: CustomerRecord[]
): InvoicePreviewResponse {
  const excludedSet = new Set(excludedCustomers.map(c => c.toUpperCase()));
  const issueDate = formatIssueDate(month, year);

  // Build lookup by code
  const customerByCode = new Map<string, CustomerRecord>();
  for (const c of customers) {
    if (c.code) customerByCode.set(c.code, c);
  }

  // Collect all owner codes
  const allOwners = new Set<string>();
  actions.filter(a => a.matched).forEach(a => allOwners.add(a.ownerCode));
  barrelInv.forEach(b => allOwners.add(b.ownerCode));
  bulkInv.forEach(b => allOwners.add(b.ownerCode));
  fruitRecords.forEach(f => allOwners.add(f.ownerCode));
  addOns.forEach(a => allOwners.add(a.ownerCode));

  const owners = [...allOwners].filter(o => !excludedSet.has(o.toUpperCase())).sort();

  const customerSummaries: InvoiceCustomerSummary[] = [];
  let invoiceCount = 0;

  // Filter add-ons by billing month
  const monthIndex = MONTHS.indexOf(month);
  const monthStr = String(monthIndex + 1).padStart(2, '0');
  const yearStr = String(year);

  for (const ownerCode of owners) {
    const record = customerByCode.get(ownerCode);
    const customerName = record?.displayName || ownerCode;
    let seq = 1;

    // ─── Winery Services Invoice ───
    let wineryServices: CustomerInvoice | null = null;
    const wsLineItems: InvoiceLineItem[] = [];

    // Actions: group by matchedRuleLabel
    const ownerActions = actions.filter(a => a.ownerCode === ownerCode && a.matched);
    const grouped = new Map<string, { qty: number; total: number }>();
    for (const row of ownerActions) {
      const label = row.matchedRuleLabel || row.actionType;
      const existing = grouped.get(label);
      const qty = (row.quantity && row.quantity > 0) ? row.quantity : (row.hours && row.hours > 0 ? row.hours : 1);
      if (existing) {
        existing.qty += qty;
        existing.total += row.total;
      } else {
        grouped.set(label, { qty, total: row.total });
      }
    }
    for (const [label, g] of grouped) {
      const price = g.qty > 0 ? round2(g.total / g.qty) : 0;
      wsLineItems.push({
        description: label,
        quantity: round2(g.qty),
        price,
        amount: round2(g.total),
      });
    }

    // Barrel inventory
    const ownerBarrels = barrelInv.filter(b => b.ownerCode === ownerCode);
    for (const b of ownerBarrels) {
      wsLineItems.push({
        description: 'Barrel Storage',
        quantity: round2(b.avgBarrels),
        price: round2(b.rate),
        amount: round2(b.charge),
      });
    }

    // Bulk inventory
    const ownerBulk = bulkInv.filter(b => b.ownerCode === ownerCode);
    for (const b of ownerBulk) {
      wsLineItems.push({
        description: 'Bulk Wine Storage',
        quantity: round2(b.billingVolume),
        price: round2(b.rate),
        amount: round2(b.totalCost),
      });
    }

    // Add-ons for billing month
    const ownerAddOns = addOns.filter(a => {
      if (a.ownerCode !== ownerCode) return false;
      return a.date.startsWith(`${yearStr}-${monthStr}`);
    });
    for (const addon of ownerAddOns) {
      wsLineItems.push({
        description: addon.rateRuleLabel,
        quantity: round2(addon.quantity),
        price: round2(addon.rate),
        amount: round2(addon.totalCost),
      });
    }

    if (wsLineItems.length > 0) {
      const subtotal = round2(wsLineItems.reduce((s, li) => s + li.amount, 0));
      const feeItem = buildMerchantFeeItem(subtotal);
      wsLineItems.push(feeItem);
      const totalDue = round2(subtotal + feeItem.amount);
      wineryServices = {
        invoiceType: 'winery-services',
        invoiceNumber: makeInvoiceNumber(year, month, ownerCode, seq),
        issueDate,
        title: 'Winery Services',
        customerName,
        ownerCode,
        customerAddress: record?.address || undefined,
        customerPhone: record?.phone || undefined,
        customerEmail: record?.email || undefined,
        lineItems: wsLineItems,
        subtotal,
        merchantFee: feeItem.amount,
        totalDue,
      };
      seq++;
      invoiceCount++;
    }

    // ─── Fruit Intake Invoice ───
    let fruitIntake: CustomerInvoice | null = null;
    const fiLineItems: InvoiceLineItem[] = [];
    const monthKey = `${month} ${year}`;
    const ownerFruit = fruitRecords.filter(f => f.ownerCode === ownerCode);

    let installmentNumber = 0;
    let totalInstallments = 0;
    let vintage = 0;

    for (const record of ownerFruit) {
      const instIndex = record.installments.findIndex(inst => inst.month === monthKey);
      if (instIndex === -1) continue;
      const installment = record.installments[instIndex];
      if (installment.amount <= 0) continue;

      fiLineItems.push({
        description: record.lotCode,
        quantity: round2(record.fruitWeightTons),
        price: round2(record.totalCost),
        amount: round2(installment.amount),
      });

      // Use the first record's data for title
      if (installmentNumber === 0) {
        installmentNumber = instIndex + 1;
        totalInstallments = record.installments.length;
        vintage = record.vintage;
      }
    }

    if (fiLineItems.length > 0) {
      const subtotal = round2(fiLineItems.reduce((s, li) => s + li.amount, 0));
      const feeItem = buildMerchantFeeItem(subtotal);
      fiLineItems.push(feeItem);
      const totalDue = round2(subtotal + feeItem.amount);
      fruitIntake = {
        invoiceType: 'fruit-intake',
        invoiceNumber: makeInvoiceNumber(year, month, ownerCode, seq),
        issueDate,
        title: `${ordinal(installmentNumber)} Crush Installment`,
        subtitle: `${installmentNumber} OF ${totalInstallments} INSTALLMENTS ${vintage} CRUSH`,
        customerName,
        ownerCode,
        customerAddress: record?.address || undefined,
        customerPhone: record?.phone || undefined,
        customerEmail: record?.email || undefined,
        lineItems: fiLineItems,
        subtotal,
        merchantFee: feeItem.amount,
        totalDue,
      };
      invoiceCount++;
    }

    const combinedTotal = round2(
      (wineryServices?.totalDue || 0) + (fruitIntake?.totalDue || 0)
    );

    if (wineryServices || fruitIntake) {
      customerSummaries.push({
        ownerCode,
        customerName,
        wineryServices,
        fruitIntake,
        combinedTotal,
      });
    }
  }

  const grandTotal = round2(customerSummaries.reduce((s, c) => s + c.combinedTotal, 0));

  return {
    customers: customerSummaries,
    grandTotal,
    invoiceCount,
    billingMonth: month,
    billingYear: year,
  };
}
