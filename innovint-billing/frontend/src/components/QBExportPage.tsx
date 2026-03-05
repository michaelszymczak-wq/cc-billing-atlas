import React, { useState, useEffect } from 'react';
import {
  AppConfig, QBPreviewResponse, QBExportRecord, QBExportSettings,
  getQBPreview, downloadQBCSV, getQBExportHistory, saveQBCustomerMap,
} from '../api/client';
import { BillingRunState } from './BillingControls';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const SOURCE_LABELS: Record<string, string> = {
  actions: 'Actions',
  barrel: 'Barrel Inv.',
  bulk: 'Bulk Inv.',
  fruitIntake: 'Fruit Intake',
  addOns: 'Add-Ons',
};

interface QBExportPageProps {
  config: AppConfig;
  billingState: BillingRunState | null;
  onConfigChange?: (updater: (prev: AppConfig) => AppConfig) => void;
}

export default function QBExportPage({ config, billingState, onConfigChange }: QBExportPageProps) {
  const [month, setMonth] = useState(config.lastUsedMonth);
  const [year, setYear] = useState(config.lastUsedYear);
  const [excludedText, setExcludedText] = useState(
    (config.qbExportSettings?.excludedCustomers || ['ELE']).join(', ')
  );
  const [enabledSources, setEnabledSources] = useState<QBExportSettings['enabledSources']>(
    config.qbExportSettings?.enabledSources || { actions: true, barrel: true, bulk: true, fruitIntake: true, addOns: true }
  );
  const [preview, setPreview] = useState<QBPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<QBExportRecord[]>(config.qbExportHistory || []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [qbCustomerMap, setQbCustomerMap] = useState<Record<string, string>>(config.qbCustomerMap || {});
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapDirty, setMapDirty] = useState(false);
  const [newMapCode, setNewMapCode] = useState('');
  const [newMapName, setNewMapName] = useState('');

  const hasSession = !!(billingState?.sessionId && billingState.results);

  useEffect(() => {
    getQBExportHistory().then(setHistory).catch(() => {});
  }, []);

  const getExcludedList = () =>
    excludedText.split(',').map(s => s.trim()).filter(Boolean);

  const handleGeneratePreview = async () => {
    if (!billingState?.sessionId) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await getQBPreview({
        sessionId: billingState.sessionId,
        month,
        year,
        excludedCustomers: getExcludedList(),
        enabledSources,
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
      const { blob, filename } = await downloadQBCSV({
        sessionId: billingState.sessionId,
        month,
        year,
        excludedCustomers: getExcludedList(),
        enabledSources,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Refresh history
      const h = await getQBExportHistory();
      setHistory(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    if (!preview) return;
    // Build CSV text from preview
    const headers = 'AR Account,Customer:Job,Date,Sales Tax,Number,Class,Item,Description,Quantity,Rate,Amount,Tax Code';
    const lines = [headers];
    for (const customer of preview.customers) {
      const allItems = [
        ...customer.sources.actions.items,
        ...customer.sources.barrel.items,
        ...customer.sources.bulk.items,
        ...customer.sources.fruitIntake.items,
        ...customer.sources.addOns.items,
      ];
      for (const item of allItems) {
        const esc = (v: string | number) => {
          const s = String(v);
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        lines.push([
          esc(item.arAccount), esc(item.customerJob), esc(item.date), esc(item.salesTax),
          esc(item.number), esc(item.class), esc(item.item), esc(item.description),
          esc(item.quantity), esc(item.rate), esc(item.amount), esc(item.taxCode),
        ].join(','));
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\r\n') + '\r\n');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const toggleSource = (key: keyof typeof enabledSources) => {
    setEnabledSources(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMapUpdate = (code: string, name: string) => {
    setQbCustomerMap(prev => ({ ...prev, [code]: name }));
    setMapDirty(true);
  };

  const handleMapDelete = (code: string) => {
    setQbCustomerMap(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setMapDirty(true);
  };

  const handleMapAdd = () => {
    const code = newMapCode.trim().toUpperCase();
    const name = newMapName.trim();
    if (!code || !name) return;
    setQbCustomerMap(prev => ({ ...prev, [code]: name }));
    setNewMapCode('');
    setNewMapName('');
    setMapDirty(true);
  };

  const handleMapSave = async () => {
    setMapSaving(true);
    try {
      await saveQBCustomerMap(qbCustomerMap);
      setMapDirty(false);
      onConfigChange?.(prev => ({ ...prev, qbCustomerMap }));
    } catch {
      setError('Failed to save QB customer map');
    } finally {
      setMapSaving(false);
    }
  };

  const handleMapImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const imported: Record<string, string> = {};
      for (const line of lines) {
        // Parse CSV: handle quoted fields
        const match = line.match(/^"?([^",]+)"?\s*,\s*"?(.*?)"?\s*$/);
        if (match) {
          const code = match[1].trim().toUpperCase();
          const name = match[2].trim();
          if (code && name) imported[code] = name;
        }
      }
      if (Object.keys(imported).length === 0) {
        setError('No valid mappings found in CSV. Expected two columns: Code, QB Customer Name');
        return;
      }
      setQbCustomerMap(prev => ({ ...prev, ...imported }));
      setMapDirty(true);
      setError('');
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  // Auto-populate known owner codes from preview that aren't already mapped
  const unmappedCodes = preview
    ? preview.customers.map(c => c.ownerCode).filter(code => !qbCustomerMap[code])
    : [];

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">QuickBooks Export</h2>
      <p className="text-sm text-gray-500 mb-6">Export billing data as CSV for QuickBooks import</p>

      {/* Warning banner */}
      {!hasSession && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-6">
          <p className="font-medium">No billing session available</p>
          <p className="text-sm mt-1">Run billing first from the Billing page, then return here to export.</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Sources</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABELS) as Array<keyof typeof SOURCE_LABELS>).map(key => (
              <label key={key} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledSources[key as keyof typeof enabledSources]}
                  onChange={() => toggleSource(key as keyof typeof enabledSources)}
                  className="rounded border-gray-300"
                />
                {SOURCE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleGeneratePreview}
          disabled={!hasSession || loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </button>
      </div>

      {/* QB Customer Name Mapping */}
      <div className="mb-8 border-t pt-4">
        <button
          onClick={() => setMapOpen(!mapOpen)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-3"
        >
          <svg
            className={`w-4 h-4 transition-transform ${mapOpen ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          QB Customer Mapping ({Object.keys(qbCustomerMap).length})
        </button>

        {mapOpen && (
          <div className="max-w-lg space-y-3">
            <p className="text-xs text-gray-500">
              Map owner codes to QuickBooks customer names. Unmapped codes use the raw owner code.
            </p>

            {/* Existing mappings */}
            {Object.entries(qbCustomerMap).sort(([a], [b]) => a.localeCompare(b)).map(([code, name]) => (
              <div key={code} className="flex items-center gap-2">
                <span className="w-20 text-sm font-mono font-medium text-gray-700 shrink-0">{code}</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => handleMapUpdate(code, e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={() => handleMapDelete(code)}
                  className="text-red-400 hover:text-red-600 text-sm px-1"
                  title="Remove mapping"
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Add new mapping */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMapCode}
                onChange={e => setNewMapCode(e.target.value.toUpperCase())}
                placeholder="Code"
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm font-mono shrink-0"
              />
              <input
                type="text"
                value={newMapName}
                onChange={e => setNewMapName(e.target.value)}
                placeholder="QB Customer Name"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') handleMapAdd(); }}
              />
              <button
                onClick={handleMapAdd}
                disabled={!newMapCode.trim() || !newMapName.trim()}
                className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm border hover:bg-gray-200 disabled:opacity-40"
              >
                Add
              </button>
            </div>

            {/* Quick-add unmapped codes from preview */}
            {unmappedCodes.length > 0 && (
              <div className="text-xs text-gray-500">
                <span>Unmapped codes from preview: </span>
                {unmappedCodes.map(code => (
                  <button
                    key={code}
                    onClick={() => { setNewMapCode(code); setMapOpen(true); }}
                    className="inline-block bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1 mb-1 hover:bg-gray-200 font-mono"
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}

            {/* Save & Import buttons */}
            <div className="flex gap-2">
            <button
              onClick={handleMapSave}
              disabled={!mapDirty || mapSaving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mapSaving ? 'Saving...' : mapDirty ? 'Save Mapping' : 'Saved'}
            </button>
            <label className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm font-medium border hover:bg-gray-200 cursor-pointer">
              Import CSV
              <input type="file" accept=".csv,.txt" onChange={handleMapImportCSV} className="hidden" />
            </label>
            </div>
            <p className="text-xs text-gray-400">CSV format: Code, QB Customer Name (one per line)</p>
          </div>
        )}
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
              <p className="text-2xl font-bold text-blue-600">{preview.lineItemCount}</p>
              <p className="text-xs text-gray-500">Line Items</p>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{preview.customers.length}</p>
              <p className="text-xs text-gray-500">Customers</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
            <button
              onClick={handleCopy}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200 border"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Customer</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Actions</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Barrel</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Bulk</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Fruit</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Add-Ons</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.customers.map(c => (
                  <tr
                    key={c.ownerCode}
                    className={`border-b hover:bg-gray-50 ${c.total === 0 ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium">
                      {c.ownerCode}
                      {qbCustomerMap[c.ownerCode] && (
                        <span className="text-gray-400 font-normal ml-1 text-xs">({qbCustomerMap[c.ownerCode]})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{c.sources.actions.subtotal ? fmt(c.sources.actions.subtotal) : '-'}</td>
                    <td className="px-3 py-2 text-right">{c.sources.barrel.subtotal ? fmt(c.sources.barrel.subtotal) : '-'}</td>
                    <td className="px-3 py-2 text-right">{c.sources.bulk.subtotal ? fmt(c.sources.bulk.subtotal) : '-'}</td>
                    <td className="px-3 py-2 text-right">{c.sources.fruitIntake.subtotal ? fmt(c.sources.fruitIntake.subtotal) : '-'}</td>
                    <td className="px-3 py-2 text-right">{c.sources.addOns.subtotal ? fmt(c.sources.addOns.subtotal) : '-'}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(c.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.sources.actions.subtotal, 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.sources.barrel.subtotal, 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.sources.bulk.subtotal, 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.sources.fruitIntake.subtotal, 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.customers.reduce((s, c) => s + c.sources.addOns.subtotal, 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(preview.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {preview.customers.map(c => (
              <div
                key={c.ownerCode}
                className={`border rounded-lg p-3 ${c.total === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">
                    {c.ownerCode}
                    {qbCustomerMap[c.ownerCode] && (
                      <span className="text-gray-400 font-normal ml-1 text-xs">({qbCustomerMap[c.ownerCode]})</span>
                    )}
                  </span>
                  <span className="font-bold text-sm">{fmt(c.total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  {c.sources.actions.subtotal > 0 && <div>Actions: {fmt(c.sources.actions.subtotal)}</div>}
                  {c.sources.barrel.subtotal > 0 && <div>Barrel: {fmt(c.sources.barrel.subtotal)}</div>}
                  {c.sources.bulk.subtotal > 0 && <div>Bulk: {fmt(c.sources.bulk.subtotal)}</div>}
                  {c.sources.fruitIntake.subtotal > 0 && <div>Fruit: {fmt(c.sources.fruitIntake.subtotal)}</div>}
                  {c.sources.addOns.subtotal > 0 && <div>Add-Ons: {fmt(c.sources.addOns.subtotal)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export History */}
      {history.length > 0 && (
        <div className="border-t pt-4">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-3"
          >
            <svg
              className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Export History ({history.length})
          </button>

          {historyOpen && (
            <>
              {/* Desktop history table */}
              <div className="hidden md:block">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Period</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Customers</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Items</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{new Date(h.exportedAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{h.month} {h.year}</td>
                        <td className="px-3 py-2 text-right">{h.customerCount}</td>
                        <td className="px-3 py-2 text-right">{h.lineItemCount}</td>
                        <td className="px-3 py-2 text-right">{fmt(h.totalAmount)}</td>
                        <td className="px-3 py-2 text-gray-500">{h.filename}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile history cards */}
              <div className="md:hidden space-y-2">
                {history.map(h => (
                  <div key={h.id} className="border rounded-lg p-3 bg-white text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{h.month} {h.year}</span>
                      <span className="font-bold">{fmt(h.totalAmount)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.exportedAt).toLocaleDateString()} · {h.customerCount} customers · {h.lineItemCount} items
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
