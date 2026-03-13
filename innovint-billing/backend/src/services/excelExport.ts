import ExcelJS from 'exceljs';
import { ActionRow, AuditRow, BarrelBillingRow, BulkBillingRow, FruitIntakeRecord } from '../types';

export async function generateExcel(
  actions: ActionRow[],
  bulkInventory: BulkBillingRow[],
  auditRows: AuditRow[],
  barrelInventory: BarrelBillingRow[] = [],
  fruitIntakeRecords: FruitIntakeRecord[] = [],
  billingMonth?: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InnoVint Billing Engine';
  workbook.created = new Date();

  // ─── ACTIONS Tab ───
  const actionsSheet = workbook.addWorksheet('ACTIONS');
  actionsSheet.columns = [
    { header: 'Action Type', key: 'actionType', width: 18 },
    { header: 'Action ID', key: 'actionId', width: 20 },
    { header: 'Lot Codes', key: 'lotCodes', width: 30 },
    { header: 'Performer', key: 'performer', width: 18 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Analysis/Notes', key: 'analysisOrNotes', width: 35 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Setup Fee', key: 'setupFee', width: 12 },
    { header: 'Total', key: 'total', width: 14 },
  ];

  // Style header row
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } },
    alignment: { horizontal: 'center' },
  };

  actionsSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of actions) {
    const excelRow = actionsSheet.addRow({
      actionType: row.actionType,
      actionId: row.actionId,
      lotCodes: row.lotCodes,
      performer: row.performer,
      date: row.date,
      ownerCode: row.ownerCode,
      analysisOrNotes: row.analysisOrNotes,
      hours: row.hours || '',
      rate: row.rate,
      setupFee: row.setupFee,
      total: row.total,
    });

    // Color-code: green = matched, yellow = unmatched
    if (row.matched) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2EFDA' },
        };
      });
    } else if (row.error) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' },
        };
      });
    } else {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF9C4' },
        };
      });
    }
  }

  // Format currency columns
  ['rate', 'setupFee', 'total'].forEach((key) => {
    const col = actionsSheet.getColumn(key);
    col.numFmt = '$#,##0.00';
  });

  // ─── Bulk Inventory Tab ───
  const bulkSheet = workbook.addWorksheet('Bulk Inventory');
  bulkSheet.columns = [
    { header: 'Owner Code', key: 'ownerCode', width: 14 },
    { header: 'Snap 1 (gal)', key: 'snap1Volume', width: 14 },
    { header: 'Snap 2 (gal)', key: 'snap2Volume', width: 14 },
    { header: 'Snap 3 (gal)', key: 'snap3Volume', width: 14 },
    { header: 'Billing Vol', key: 'billingVolume', width: 14 },
    { header: 'Proration', key: 'proration', width: 12 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Total Cost', key: 'totalCost', width: 14 },
  ];

  bulkSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of bulkInventory) {
    bulkSheet.addRow(row);
  }

  ['rate', 'totalCost'].forEach((key) => {
    bulkSheet.getColumn(key).numFmt = '$#,##0.00';
  });

  bulkSheet.getColumn('proration').numFmt = '0%';

  // ─── Audit Report Tab ───
  const auditSheet = workbook.addWorksheet('Audit Report');
  auditSheet.columns = [
    { header: 'Action Type', key: 'actionType', width: 18 },
    { header: 'Action ID', key: 'actionId', width: 20 },
    { header: 'Lot Codes', key: 'lotCodes', width: 30 },
    { header: 'Performer', key: 'performer', width: 18 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Analysis/Notes', key: 'analysisOrNotes', width: 35 },
    { header: 'Reason', key: 'reason', width: 40 },
  ];

  auditSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of auditRows) {
    auditSheet.addRow(row);
  }

  // ─── Barrel Inventory Tab ───
  const barrelSheet = workbook.addWorksheet('Barrel Inventory');
  barrelSheet.columns = [
    { header: 'Owner Code', key: 'ownerCode', width: 12 },
    { header: 'Snapshot 1', key: 'snap1', width: 14 },
    { header: 'Snapshot 2', key: 'snap2', width: 14 },
    { header: 'Snapshot 3', key: 'snap3', width: 14 },
    { header: 'Avg Barrels', key: 'avgBarrels', width: 14 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Charge', key: 'charge', width: 14 },
  ];

  barrelSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (const row of barrelInventory) {
    barrelSheet.addRow(row);
  }

  ['rate', 'charge'].forEach((key) => {
    barrelSheet.getColumn(key).numFmt = '$#,##0.00';
  });

  // ─── Fruit Intake Tab ───
  if (fruitIntakeRecords.length > 0) {
    const fruitSheet = workbook.addWorksheet('Fruit Intake');
    fruitSheet.columns = [
      { header: 'Event ID', key: 'eventId', width: 12 },
      { header: 'Vintage', key: 'vintage', width: 10 },
      { header: 'Date', key: 'effectiveDate', width: 18 },
      { header: 'Weigh Tag', key: 'weighTagNumber', width: 14 },
      { header: 'Owner', key: 'ownerName', width: 20 },
      { header: 'Code', key: 'ownerCode', width: 10 },
      { header: 'Lot Code', key: 'lotCode', width: 22 },
      { header: 'Varietal', key: 'varietal', width: 16 },
      { header: 'Color', key: 'color', width: 10 },
      { header: 'Weight (tons)', key: 'fruitWeightTons', width: 14 },
      { header: 'Contract (mo)', key: 'contractLengthMonths', width: 14 },
      { header: 'Rate/ton', key: 'contractRatePerTon', width: 12 },
      { header: 'Total Cost', key: 'totalCost', width: 14 },
      { header: 'Monthly Amt', key: 'monthlyAmount', width: 14 },
      { header: 'Start', key: 'contractStartMonth', width: 16 },
      { header: 'End', key: 'contractEndMonth', width: 16 },
    ];

    fruitSheet.getRow(1).eachCell((cell) => {
      cell.style = headerStyle as ExcelJS.Style;
    });

    for (const record of fruitIntakeRecords) {
      fruitSheet.addRow({
        eventId: record.eventId,
        vintage: record.vintage,
        effectiveDate: record.effectiveDate,
        weighTagNumber: record.weighTagNumber,
        ownerName: record.ownerName,
        ownerCode: record.ownerCode,
        lotCode: record.lotCode,
        varietal: record.varietal,
        color: record.color,
        fruitWeightTons: record.fruitWeightTons,
        contractLengthMonths: record.contractLengthMonths,
        contractRatePerTon: record.contractRatePerTon,
        totalCost: record.totalCost,
        monthlyAmount: record.monthlyAmount,
        contractStartMonth: record.contractStartMonth,
        contractEndMonth: record.contractEndMonth,
      });
    }

    ['contractRatePerTon', 'totalCost', 'monthlyAmount'].forEach((key) => {
      fruitSheet.getColumn(key).numFmt = '$#,##0.00';
    });

    // ─── Installment Schedule Tab ───
    // Gather all unique months across all records' installments
    const allMonths = new Set<string>();
    for (const record of fruitIntakeRecords) {
      for (const inst of record.installments) {
        allMonths.add(inst.month);
      }
    }

    // Sort months chronologically
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const sortedMonths = Array.from(allMonths).sort((a, b) => {
      const [mA, yA] = a.split(' ');
      const [mB, yB] = b.split(' ');
      const yearDiff = parseInt(yA) - parseInt(yB);
      if (yearDiff !== 0) return yearDiff;
      return MONTH_NAMES.indexOf(mA) - MONTH_NAMES.indexOf(mB);
    });

    if (sortedMonths.length > 0) {
      const schedSheet = workbook.addWorksheet('Installment Schedule');

      // Columns: Owner Code, Lot Code, then one per month, then Total
      const cols: Partial<ExcelJS.Column>[] = [
        { header: 'Owner Code', key: 'ownerCode', width: 12 },
        { header: 'Lot Code', key: 'lotCode', width: 22 },
      ];
      for (const m of sortedMonths) {
        cols.push({ header: m, key: m, width: 14 });
      }
      cols.push({ header: 'Total', key: 'total', width: 14 });
      schedSheet.columns = cols;

      schedSheet.getRow(1).eachCell((cell) => {
        cell.style = headerStyle as ExcelJS.Style;
      });

      const subtotals: Record<string, number> = {};
      for (const m of sortedMonths) subtotals[m] = 0;
      let grandTotal = 0;

      for (const record of fruitIntakeRecords) {
        const row: Record<string, string | number> = {
          ownerCode: record.ownerCode,
          lotCode: record.lotCode,
        };
        let rowTotal = 0;
        for (const inst of record.installments) {
          row[inst.month] = inst.amount;
          subtotals[inst.month] = (subtotals[inst.month] || 0) + inst.amount;
          rowTotal += inst.amount;
        }
        row['total'] = rowTotal;
        grandTotal += rowTotal;
        schedSheet.addRow(row);
      }

      // Subtotal row
      const subRow: Record<string, string | number> = { ownerCode: '', lotCode: 'SUBTOTAL' };
      for (const m of sortedMonths) subRow[m] = subtotals[m];
      subRow['total'] = grandTotal;
      const subtotalExcelRow = schedSheet.addRow(subRow);
      subtotalExcelRow.font = { bold: true };

      // Format currency
      for (const m of sortedMonths) {
        schedSheet.getColumn(m).numFmt = '$#,##0.00';
      }
      schedSheet.getColumn('total').numFmt = '$#,##0.00';

      // Highlight billing month column if provided
      if (billingMonth && sortedMonths.includes(billingMonth)) {
        const colIdx = sortedMonths.indexOf(billingMonth) + 3; // +1 for 1-indexed, +2 for ownerCode & lotCode
        schedSheet.getColumn(colIdx).eachCell((cell, rowNumber) => {
          if (rowNumber > 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE2EFDA' },
            };
          }
        });
      }
    }
  }

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
