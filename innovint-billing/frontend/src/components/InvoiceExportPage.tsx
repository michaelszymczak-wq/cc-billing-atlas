import React, { useState } from 'react';
import {
  AppConfig, InvoicePreviewResponse, InvoiceSections,
  getInvoicePreview, downloadInvoiceZip,
} from '../api/client';
import { BillingRunState } from './BillingControls';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface InvoiceExportPageProps {
  config: AppConfig;
  billingState: BillingRunState | null;
}

export default function InvoiceExportPage({ config, billingState }: InvoiceExportPageProps) {
  const [month, setMonth] = useState(config.lastUsedMonth);
  const [year, setYear] = useState(config.lastUsedYear);
  const [excludedText, setExcludedText] = useState('AWC');
  const [sections, setSections] = useState<InvoiceSections>({
    actions: true,
    bulkStorage: true,
    barrelStorage: true,
    addOns: true,
    fruitIntake: true,
  });
  const [preview, setPreview] = useState<InvoicePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const hasSession = !!(billingState?.sessionId && billingState.results);

  const getExcludedList = () =>
    excludedText.split(',').map(s => s.trim()).filter(Boolean);

  const handleGeneratePreview = async () => {
    if (!billingState?.sessionId) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await getInvoicePreview({
        sessionId: billingState.sessionId,
        month,
        year,
        excludedCustomers: getExcludedList(),
        sections,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!billingState?.sessionId) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadInvoiceZip({
        sessionId: billingState.sessionId,
        month,
        year,
        excludedCustomers: getExcludedList(),
        sections,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Invoices</h2>
      <p className="text-sm text-gray-500 mb-6">Generate per-customer PDF invoices and download as ZIP</p>

      {!hasSession && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6">
          <p className="font-medium">No billing session available</p>
          <p className="text-sm mt-1">Run billing first from the Billing page, then return here to generate invoices.</p>
        </div>
      )}

      {/* Controls */}
      <div className="max-w-md space-y-4 mb-8">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || year)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excluded Customers</label>
          <input
            type="text"
            value={excludedText}
            onChange={e => setExcludedText(e.target.value)}
            placeholder="e.g. ELE, TEST"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated owner codes to exclude</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Include on Invoices</label>
          <div className="space-y-1.5">
            {([
              ['actions', 'Winery Services'],
              ['bulkStorage', 'Bulk Storage'],
              ['barrelStorage', 'Barrel Storage'],
              ['addOns', 'Add-Ons'],
              ['fruitIntake', 'Fruit Intake'],
            ] as [keyof InvoiceSections, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sections[key] !== false}
                  onChange={e => setSections(s => ({ ...s, [key]: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleGeneratePreview}
          disabled={!hasSession || loading}
          className="w-full bg-violet-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div className="mb-8">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{fmt(preview.grandTotal)}</p>
              <p className="text-xs text-gray-500">Grand Total</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-violet-600">{preview.invoiceCount}</p>
              <p className="text-xs text-gray-500">Invoices</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{preview.customers.length}</p>
              <p className="text-xs text-gray-500">Customers</p>
            </div>
          </div>

          {/* Download button */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download All Invoices (ZIP)'}
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
                  {sections.actions !== false && <th className="text-right px-3 py-2 font-medium text-gray-600">Winery Services</th>}
                  {sections.bulkStorage !== false && <th className="text-right px-3 py-2 font-medium text-gray-600">Bulk Storage</th>}
                  {sections.barrelStorage !== false && <th className="text-right px-3 py-2 font-medium text-gray-600">Barrel Storage</th>}
                  {sections.addOns !== false && <th className="text-right px-3 py-2 font-medium text-gray-600">Add-Ons</th>}
                  {sections.fruitIntake !== false && <th className="text-right px-3 py-2 font-medium text-gray-600">Fruit Intake</th>}
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.customers.map(c => (
                  <tr key={c.ownerCode} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">
                      {c.ownerCode}
                      {c.customerName !== c.ownerCode && (
                        <span className="text-gray-400 font-normal ml-1 text-xs">({c.customerName})</span>
                      )}
                    </td>
                    {sections.actions !== false && <td className="px-3 py-2 text-right">{c.categoryTotals.actions ? fmt(c.categoryTotals.actions) : '-'}</td>}
                    {sections.bulkStorage !== false && <td className="px-3 py-2 text-right">{c.categoryTotals.bulkStorage ? fmt(c.categoryTotals.bulkStorage) : '-'}</td>}
                    {sections.barrelStorage !== false && <td className="px-3 py-2 text-right">{c.categoryTotals.barrelStorage ? fmt(c.categoryTotals.barrelStorage) : '-'}</td>}
                    {sections.addOns !== false && <td className="px-3 py-2 text-right">{c.categoryTotals.addOns ? fmt(c.categoryTotals.addOns) : '-'}</td>}
                    {sections.fruitIntake !== false && <td className="px-3 py-2 text-right">{c.categoryTotals.fruitIntake ? fmt(c.categoryTotals.fruitIntake) : '-'}</td>}
                    <td className="px-3 py-2 text-right font-bold">{fmt(c.combinedTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="px-3 py-2">Total</td>
                  {sections.actions !== false && <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.categoryTotals.actions, 0))}</td>}
                  {sections.bulkStorage !== false && <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.categoryTotals.bulkStorage, 0))}</td>}
                  {sections.barrelStorage !== false && <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.categoryTotals.barrelStorage, 0))}</td>}
                  {sections.addOns !== false && <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.categoryTotals.addOns, 0))}</td>}
                  {sections.fruitIntake !== false && <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.categoryTotals.fruitIntake, 0))}</td>}
                  <td className="px-3 py-2 text-right">{fmt(preview.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {preview.customers.map(c => (
              <div key={c.ownerCode} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">
                    {c.ownerCode}
                    {c.customerName !== c.ownerCode && (
                      <span className="text-gray-400 font-normal ml-1 text-xs">({c.customerName})</span>
                    )}
                  </span>
                  <span className="font-bold text-sm">{fmt(c.combinedTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  {sections.actions !== false && c.categoryTotals.actions > 0 && <div>Winery: {fmt(c.categoryTotals.actions)}</div>}
                  {sections.bulkStorage !== false && c.categoryTotals.bulkStorage > 0 && <div>Bulk: {fmt(c.categoryTotals.bulkStorage)}</div>}
                  {sections.barrelStorage !== false && c.categoryTotals.barrelStorage > 0 && <div>Barrel: {fmt(c.categoryTotals.barrelStorage)}</div>}
                  {sections.addOns !== false && c.categoryTotals.addOns > 0 && <div>Add-Ons: {fmt(c.categoryTotals.addOns)}</div>}
                  {sections.fruitIntake !== false && c.categoryTotals.fruitIntake > 0 && <div>Fruit: {fmt(c.categoryTotals.fruitIntake)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
