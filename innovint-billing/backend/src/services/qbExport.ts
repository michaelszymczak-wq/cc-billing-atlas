import {
  ActionRow,
  BarrelBillingRow,
  BillableAddOn,
  BulkBillingRow,
  FruitIntakeRecord,
  QBCustomerSummary,
  QBLineItem,
  QBPreviewResponse,
} from '../types';

// ─── Date Helpers ───

export function getLastDayOfMonth(month: string, year: number): string {
  const monthIndex = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ].indexOf(month);
  if (monthIndex === -1) return `12/31/${year}`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${mm}/${dd}/${year}`;
}

export function getShortMonthYear(month: string, year: number): string {
  const short = month.substring(0, 3);
  const yy = String(year).slice(-2);
  return `${short}-${yy}`;
}

// ─── Item Mapping ───

export function mapToQuickBooksItem(
  itemCode: string,
  description: string
): { item: string; description: string } {
  const descLower = (description || '').toLowerCase();

  switch (itemCode) {
    case 'ANALYSIS': {
      if (/free\s+so[2₂]/i.test(description) || /free\s+sulfur/i.test(descLower))
        return { item: 'Free SO2', description: 'Free SO2/SO2 Test' };
      if (/glucose|fructose/i.test(description))
        return { item: 'GluFru', description: 'Glucose/Fructose Analysis' };
      if (/malic/i.test(description))
        return { item: 'MALIC', description: 'Malic Acid Analysis' };
      if (/volatile|acidity|acetic/i.test(description))
        return { item: 'Vol Acid', description: 'Volatile Acidity Analysis' };
      return { item: 'Free SO2', description: description || 'Analysis' };
    }
    case 'BULK':
      return { item: 'Bulk', description: 'Full Barrel Storage' };
    case 'BARREL':
      return { item: 'Empty', description: 'Empty Barrel Storage' };
    case 'STEAM':
      return { item: 'Steam', description: 'Barrel Steam Service' };
    case 'CONTRACT':
      return { item: 'Custom Crush', description: 'Contracted CC' };
    case 'PRESS':
      return { item: 'PRESS', description: 'Press Service' };
    case 'TASTING':
      return { item: 'Private Tasting', description: 'Private Tasting' };
    case 'LABOR':
    case 'ADDON': {
      if (/dry\s*ice/i.test(description))
        return { item: 'DRYICE', description: 'Harvest Dry Ice Charge' };
      return { item: 'Addl Winework', description: 'Billable Hours' };
    }
    default:
      return { item: 'Addl Winework', description: description || 'Miscellaneous' };
  }
}

// ─── Map ActionRow to QB item code ───

function getActionItemCode(row: ActionRow): string {
  const actionType = (row.rawActionType || row.actionType || '').toUpperCase();
  const notes = (row.analysisOrNotes || '').toLowerCase();
  const label = (row.matchedRuleLabel || '').toLowerCase();
  if (actionType === 'ANALYSIS') return 'ANALYSIS';
  if (actionType === 'DRAIN_AND_PRESS') return 'PRESS';
  if (actionType === 'CUSTOM' && /steam/i.test(row.analysisOrNotes)) return 'STEAM';
  if (actionType === 'CUSTOM' && /tasting/i.test(row.analysisOrNotes)) return 'TASTING';
  if (/billable/i.test(notes) || /billable/i.test(label)) return 'LABOR';
  if (actionType === 'CUSTOM') return 'LABOR';
  if (actionType === 'ADDITION') return 'LABOR';
  return 'LABOR';
}

function getActionDescription(row: ActionRow): string {
  return row.analysisOrNotes || row.matchedRuleLabel || row.actionType;
}

function getActionQuantity(row: ActionRow): number {
  if (row.quantity && row.quantity > 0) return row.quantity;
  if (row.hours && row.hours > 0) return row.hours;
  return 1;
}

// ─── Build Line Item ───

function makeLineItem(
  customerJob: string,
  date: string,
  item: string,
  description: string,
  quantity: number,
  rate: number
): QBLineItem {
  const amount = Math.round(quantity * rate * 100) / 100;
  return {
    arAccount: '4010 \u00b7 Sales',
    customerJob,
    date,
    salesTax: 'no tax',
    number: '',
    class: '',
    item,
    description,
    quantity: Math.round(quantity * 100) / 100,
    rate: Math.round(rate * 100) / 100,
    amount,
    taxCode: 'Non',
  };
}

// ─── Build Preview ───

type EnabledSources = { actions: boolean; barrel: boolean; bulk: boolean; fruitIntake: boolean; addOns: boolean };

export function buildPreview(
  actions: ActionRow[],
  barrelInv: BarrelBillingRow[],
  bulkInv: BulkBillingRow[],
  fruitRecords: FruitIntakeRecord[],
  addOns: BillableAddOn[],
  month: string,
  year: number,
  excluded: string[],
  enabledSources: EnabledSources
): QBPreviewResponse {
  const billingDate = getLastDayOfMonth(month, year);
  const excludedSet = new Set(excluded.map(c => c.toUpperCase()));

  // Collect all owner codes from all sources
  const allOwners = new Set<string>();
  if (enabledSources.actions) actions.filter(a => a.matched).forEach(a => allOwners.add(a.ownerCode));
  if (enabledSources.barrel) barrelInv.forEach(b => allOwners.add(b.ownerCode));
  if (enabledSources.bulk) bulkInv.forEach(b => allOwners.add(b.ownerCode));
  if (enabledSources.fruitIntake) fruitRecords.forEach(f => allOwners.add(f.ownerCode));
  if (enabledSources.addOns) addOns.forEach(a => allOwners.add(a.ownerCode));

  // Filter excluded
  const owners = [...allOwners].filter(o => !excludedSet.has(o.toUpperCase())).sort();

  const emptySources = (): QBCustomerSummary['sources'] => ({
    actions: { items: [], subtotal: 0 },
    barrel: { items: [], subtotal: 0 },
    bulk: { items: [], subtotal: 0 },
    fruitIntake: { items: [], subtotal: 0 },
    addOns: { items: [], subtotal: 0 },
  });

  const customers: QBCustomerSummary[] = [];

  for (const ownerCode of owners) {
    const sources = emptySources();

    // Actions: group matched actions by ownerCode + actionType combo, sum quantities/totals
    if (enabledSources.actions) {
      const ownerActions = actions.filter(a => a.ownerCode === ownerCode && a.matched);
      // Group by display type (itemCode + description)
      const grouped = new Map<string, { qty: number; total: number; rate: number; item: string; desc: string }>();
      for (const row of ownerActions) {
        const itemCode = getActionItemCode(row);
        const actionDesc = getActionDescription(row);
        const mapped = mapToQuickBooksItem(itemCode, actionDesc);
        const key = `${mapped.item}||${mapped.description}`;
        const existing = grouped.get(key);
        const qty = getActionQuantity(row);
        if (existing) {
          existing.qty += qty;
          existing.total += row.total;
        } else {
          grouped.set(key, { qty, total: row.total, rate: row.rate, item: mapped.item, desc: mapped.description });
        }
      }
      for (const [, g] of grouped) {
        const effectiveRate = g.qty > 0 ? Math.round((g.total / g.qty) * 100) / 100 : g.rate;
        const lineItem = makeLineItem(ownerCode, billingDate, g.item, g.desc, g.qty, effectiveRate);
        // Override amount with actual total to avoid rounding issues
        lineItem.amount = Math.round(g.total * 100) / 100;
        sources.actions.items.push(lineItem);
        sources.actions.subtotal += lineItem.amount;
      }
      sources.actions.subtotal = Math.round(sources.actions.subtotal * 100) / 100;
    }

    // Barrel inventory
    if (enabledSources.barrel) {
      const ownerBarrels = barrelInv.filter(b => b.ownerCode === ownerCode);
      for (const b of ownerBarrels) {
        const mapped = mapToQuickBooksItem('BARREL', '');
        const lineItem = makeLineItem(ownerCode, billingDate, mapped.item, mapped.description, b.avgBarrels, b.rate);
        lineItem.amount = Math.round(b.charge * 100) / 100;
        sources.barrel.items.push(lineItem);
        sources.barrel.subtotal += lineItem.amount;
      }
      sources.barrel.subtotal = Math.round(sources.barrel.subtotal * 100) / 100;
    }

    // Bulk inventory: sum totalCost per ownerCode
    if (enabledSources.bulk) {
      const ownerBulk = bulkInv.filter(b => b.ownerCode === ownerCode);
      if (ownerBulk.length > 0) {
        const totalCost = ownerBulk.reduce((sum, b) => sum + b.totalCost, 0);
        const totalQty = ownerBulk.reduce((sum, b) => sum + (b.barrelCount + b.kegCount), 0) || 1;
        const mapped = mapToQuickBooksItem('BULK', '');
        const lineItem = makeLineItem(ownerCode, billingDate, mapped.item, mapped.description, totalQty, Math.round((totalCost / totalQty) * 100) / 100);
        lineItem.amount = Math.round(totalCost * 100) / 100;
        sources.bulk.items.push(lineItem);
        sources.bulk.subtotal = lineItem.amount;
      }
    }

    // Fruit Intake: lookup installment by month/year
    if (enabledSources.fruitIntake) {
      const monthKey = `${month} ${year}`;
      const ownerFruit = fruitRecords.filter(f => f.ownerCode === ownerCode);
      // Group by contract key: "{duration} mo {vintage}"
      const contractGroups = new Map<string, { amount: number; count: number }>();
      for (const record of ownerFruit) {
        const installment = record.installments.find(inst => inst.month === monthKey);
        if (installment && installment.amount > 0) {
          const contractKey = `${record.contractLengthMonths} mo ${record.vintage}`;
          const existing = contractGroups.get(contractKey);
          if (existing) {
            existing.amount += installment.amount;
            existing.count += 1;
          } else {
            contractGroups.set(contractKey, { amount: installment.amount, count: 1 });
          }
        }
      }
      for (const [contractKey, group] of contractGroups) {
        const mapped = mapToQuickBooksItem('CONTRACT', '');
        const lineItem = makeLineItem(
          ownerCode, billingDate, mapped.item,
          `${mapped.description} (${contractKey})`,
          group.count, Math.round((group.amount / group.count) * 100) / 100
        );
        lineItem.amount = Math.round(group.amount * 100) / 100;
        sources.fruitIntake.items.push(lineItem);
        sources.fruitIntake.subtotal += lineItem.amount;
      }
      sources.fruitIntake.subtotal = Math.round(sources.fruitIntake.subtotal * 100) / 100;
    }

    // Add-Ons: filter by ownerCode + date in billing month
    if (enabledSources.addOns) {
      const monthIndex = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December',
      ].indexOf(month);
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const yearStr = String(year);
      const ownerAddOns = addOns.filter(a => {
        if (a.ownerCode !== ownerCode) return false;
        // date is YYYY-MM-DD
        return a.date.startsWith(`${yearStr}-${monthStr}`);
      });
      for (const addon of ownerAddOns) {
        const mapped = mapToQuickBooksItem('ADDON', addon.rateRuleLabel);
        const lineItem = makeLineItem(ownerCode, billingDate, mapped.item, mapped.description, addon.quantity, addon.rate);
        lineItem.amount = Math.round(addon.totalCost * 100) / 100;
        sources.addOns.items.push(lineItem);
        sources.addOns.subtotal += lineItem.amount;
      }
      sources.addOns.subtotal = Math.round(sources.addOns.subtotal * 100) / 100;
    }

    const total = Math.round(
      (sources.actions.subtotal + sources.barrel.subtotal + sources.bulk.subtotal +
       sources.fruitIntake.subtotal + sources.addOns.subtotal) * 100
    ) / 100;

    customers.push({ ownerCode, sources, total });
  }

  const grandTotal = Math.round(customers.reduce((sum, c) => sum + c.total, 0) * 100) / 100;
  const lineItemCount = customers.reduce((sum, c) => {
    return sum + c.sources.actions.items.length + c.sources.barrel.items.length +
      c.sources.bulk.items.length + c.sources.fruitIntake.items.length + c.sources.addOns.items.length;
  }, 0);

  return { customers, grandTotal, lineItemCount, billingDate };
}

// ─── CSV Generation (RFC 4180) ───

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(preview: QBPreviewResponse): string {
  const headers = [
    'AR Account', 'Customer:Job', 'Date', 'Sales Tax', 'Number',
    'Class', 'Item', 'Description', 'Quantity', 'Rate', 'Amount', 'Tax Code',
  ];
  const lines: string[] = [headers.join(',')];

  for (const customer of preview.customers) {
    const allItems: QBLineItem[] = [
      ...customer.sources.actions.items,
      ...customer.sources.barrel.items,
      ...customer.sources.bulk.items,
      ...customer.sources.fruitIntake.items,
      ...customer.sources.addOns.items,
    ];
    for (const item of allItems) {
      lines.push([
        escapeCSV(item.arAccount),
        escapeCSV(item.customerJob),
        escapeCSV(item.date),
        escapeCSV(item.salesTax),
        escapeCSV(item.number),
        escapeCSV(item.class),
        escapeCSV(item.item),
        escapeCSV(item.description),
        escapeCSV(item.quantity),
        escapeCSV(item.rate),
        escapeCSV(item.amount),
        escapeCSV(item.taxCode),
      ].join(','));
    }
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
