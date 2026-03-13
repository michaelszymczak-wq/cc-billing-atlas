import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';
import { CustomerInvoice } from '../types';

const COMPANY_NAME = 'Opal Moon Crush';
const COMPANY_EMAIL = 'jmarcum@atlaswineco.com';
const COMPANY_PHONE = '(707) 365-8900';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

const COLORS = {
  primary: '#4338CA',      // indigo-700
  headerBg: '#1E1B4B',    // indigo-950
  lightGray: '#F3F4F6',
  darkText: '#111827',
  grayText: '#6B7280',
  white: '#FFFFFF',
};

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateInvoicePDF(invoice: CustomerInvoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 612 - 100; // letter width minus margins

    // ─── Header ───
    const headerY = 50;

    // Logo (if exists)
    let logoLoaded = false;
    try {
      if (fs.existsSync(LOGO_PATH)) {
        const stats = fs.statSync(LOGO_PATH);
        if (stats.size > 100) { // skip placeholder
          doc.image(LOGO_PATH, 50, headerY, { width: 60 });
          logoLoaded = true;
        }
      }
    } catch {
      // skip logo
    }

    const textStartX = logoLoaded ? 120 : 50;

    // Company info - left side
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.darkText)
      .text(COMPANY_NAME, textStartX, headerY);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
      .text(COMPANY_EMAIL, textStartX, headerY + 18)
      .text(COMPANY_PHONE, textStartX, headerY + 30);

    // Invoice number & date - right side
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
      .text('Invoice #', 400, headerY, { width: 162, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.darkText)
      .text(invoice.invoiceNumber, 400, headerY + 12, { width: 162, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
      .text('Issue Date', 400, headerY + 28, { width: 162, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkText)
      .text(invoice.issueDate, 400, headerY + 40, { width: 162, align: 'right' });

    // ─── Colored bar ───
    const barY = headerY + 65;
    doc.rect(50, barY, pageWidth, 4).fill(COLORS.primary);

    // ─── Title ───
    let currentY = barY + 20;
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.darkText)
      .text(invoice.title, 50, currentY);
    currentY += 26;

    if (invoice.subtitle) {
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.grayText)
        .text(invoice.subtitle, 50, currentY);
      currentY += 18;
    }

    // ─── Customer ───
    currentY += 10;
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
      .text('Customer', 50, currentY);
    currentY += 12;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.darkText)
      .text(invoice.customerName, 50, currentY);
    currentY += 16;

    // Contact info (if present)
    if (invoice.customerAddress) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
        .text(invoice.customerAddress, 50, currentY);
      currentY += 12;
    }
    if (invoice.customerPhone) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
        .text(invoice.customerPhone, 50, currentY);
      currentY += 12;
    }
    if (invoice.customerEmail) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.grayText)
        .text(invoice.customerEmail, 50, currentY);
      currentY += 12;
    }
    currentY += 9;

    // ─── Items table ───
    const colX = {
      item: 50,
      qty: 310,
      price: 390,
      amount: 470,
    };
    const colWidths = {
      item: 250,
      qty: 70,
      price: 70,
      amount: 92,
    };

    // Table header
    const headerHeight = 28;
    doc.rect(50, currentY, pageWidth, headerHeight).fill(COLORS.headerBg);
    const headerTextY = currentY + 8;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
    doc.text('Items', colX.item + 8, headerTextY, { width: colWidths.item });
    const isFruitIntake = invoice.invoiceType === 'fruit-intake';
    doc.text(isFruitIntake ? 'Tons' : 'Quantity', colX.qty, headerTextY, { width: colWidths.qty, align: 'right' });
    doc.text(isFruitIntake ? 'Contract Total' : 'Price', colX.price, headerTextY, { width: colWidths.price, align: 'right' });
    doc.text(isFruitIntake ? 'Installment Amt' : 'Amount', colX.amount, headerTextY, { width: colWidths.amount, align: 'right' });
    currentY += headerHeight;

    // Table rows (exclude merchant fee from line items display — show separately)
    const displayItems = invoice.lineItems.filter(li => li.description !== 'Merchant Fee (3%)');
    const merchantFeeItem = invoice.lineItems.find(li => li.description === 'Merchant Fee (3%)');

    for (let i = 0; i < displayItems.length; i++) {
      const item = displayItems[i];
      const rowHeight = 24;
      const bgColor = i % 2 === 0 ? COLORS.white : COLORS.lightGray;
      doc.rect(50, currentY, pageWidth, rowHeight).fill(bgColor);
      const rowTextY = currentY + 7;
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.darkText);
      doc.text(item.description, colX.item + 8, rowTextY, { width: colWidths.item - 8 });
      doc.text(fmtNum(item.quantity), colX.qty, rowTextY, { width: colWidths.qty, align: 'right' });
      doc.text(fmt(item.price), colX.price, rowTextY, { width: colWidths.price, align: 'right' });
      doc.text(fmt(item.amount), colX.amount, rowTextY, { width: colWidths.amount, align: 'right' });
      currentY += rowHeight;
    }

    // Bottom border
    doc.moveTo(50, currentY).lineTo(50 + pageWidth, currentY).strokeColor('#E5E7EB').lineWidth(1).stroke();
    currentY += 12;

    // ─── Subtotal ───
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.grayText)
      .text('Subtotal', colX.price - 40, currentY, { width: 110, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkText)
      .text(fmt(invoice.subtotal), colX.amount, currentY, { width: colWidths.amount, align: 'right' });
    currentY += 18;

    // ─── Merchant Fee ───
    if (merchantFeeItem) {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.grayText)
        .text('Merchant Fee (3%)', colX.price - 40, currentY, { width: 110, align: 'right' });
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.darkText)
        .text(fmt(merchantFeeItem.amount), colX.amount, currentY, { width: colWidths.amount, align: 'right' });
      currentY += 18;
    }

    // ─── Total Due ───
    currentY += 4;
    doc.rect(colX.price - 50, currentY, pageWidth - (colX.price - 50) + 50, 30).fill(COLORS.lightGray);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.darkText)
      .text('Total Due', colX.price - 40, currentY + 8, { width: 110, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.primary)
      .text(fmt(invoice.totalDue), colX.amount, currentY + 7, { width: colWidths.amount, align: 'right' });

    doc.end();
  });
}
