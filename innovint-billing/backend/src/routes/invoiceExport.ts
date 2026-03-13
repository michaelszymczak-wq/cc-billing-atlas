import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import { sessions } from './actions';
import { loadSettings } from '../persistence';
import { loadSessionResult } from '../persistence';
import { buildInvoicePreview } from '../services/invoiceDataBuilder';
import { generateInvoicePDF } from '../services/pdfInvoiceGenerator';

const router = Router();

async function loadSession(sessionId: string) {
  let session = sessions.get(sessionId);
  if (!session?.billingResult) {
    const stored = await loadSessionResult(sessionId);
    if (stored?.billingResult) {
      sessions.set(sessionId, stored);
      session = stored;
    }
  }
  return session;
}

// POST /preview — generate invoice preview data
router.post('/preview', async (req: Request, res: Response) => {
  const { sessionId, month, year, excludedCustomers } = req.body as {
    sessionId: string;
    month: string;
    year: number;
    excludedCustomers?: string[];
  };

  const session = await loadSession(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
    return;
  }

  const settings = await loadSettings();
  const excluded = excludedCustomers ?? [];
  const fruitRecords = settings.fruitIntake?.records || [];
  const addOns = settings.billableAddOns || [];

  const preview = buildInvoicePreview(
    session.billingResult.actions,
    session.billingResult.barrelInventory,
    session.billingResult.bulkInventory,
    fruitRecords,
    addOns,
    month,
    year,
    excluded,
    settings.customers
  );

  res.json(preview);
});

// POST /download — generate PDFs and stream as ZIP
router.post('/download', async (req: Request, res: Response) => {
  const { sessionId, month, year, excludedCustomers } = req.body as {
    sessionId: string;
    month: string;
    year: number;
    excludedCustomers?: string[];
  };

  const session = await loadSession(sessionId);
  if (!session?.billingResult) {
    res.status(404).json({ error: 'No billing results found for this session. Run billing first.' });
    return;
  }

  const settings = await loadSettings();
  const excluded = excludedCustomers ?? [];
  const fruitRecords = settings.fruitIntake?.records || [];
  const addOns = settings.billableAddOns || [];

  const preview = buildInvoicePreview(
    session.billingResult.actions,
    session.billingResult.barrelInventory,
    session.billingResult.bulkInventory,
    fruitRecords,
    addOns,
    month,
    year,
    excluded,
    settings.customers
  );

  const monthShort = month.substring(0, 3);
  const filename = `Invoices_${monthShort}-${year}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.status(500).json({ error: 'Failed to create ZIP archive' });
  });
  archive.pipe(res);

  for (const customer of preview.customers) {
    const invoices = [customer.wineryServices, customer.fruitIntake].filter(Boolean) as import('../types').CustomerInvoice[];
    for (const invoice of invoices) {
      const pdfBuffer = await generateInvoicePDF(invoice);
      const safeName = invoice.customerName.replace(/[^a-zA-Z0-9_\- ]/g, '');
      const typeSuffix = invoice.invoiceType === 'winery-services' ? 'Winery-Services' : 'Fruit-Intake';
      const pdfFilename = `${safeName}_${typeSuffix}_${invoice.invoiceNumber}.pdf`;
      archive.append(pdfBuffer, { name: pdfFilename });
    }
  }

  await archive.finalize();
});

export default router;
