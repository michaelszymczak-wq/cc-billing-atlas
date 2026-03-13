import React, { useState, useEffect, useCallback } from 'react';
import {
  getBillableAddOns, addBillableAddOn, deleteBillableAddOn, clearBillableAddOnsByMonth,
  BillableAddOn, RateRule,
} from '../api/client';
import { UserRole } from '../auth/AuthContext';

interface BillableAddOnsPageProps {
  rateRules: RateRule[];
  ownerCodes: string[];
  role: UserRole;
}

interface NewRow {
  date: string;
  rateRuleId: string;
  quantity: string;
  ownerCode: string;
  notes: string;
}

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getPreviousMonth(): { yearMonth: string; label: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
  return { yearMonth, label };
}

export default function BillableAddOnsPage({ rateRules, ownerCodes, role }: BillableAddOnsPageProps) {
  const [addOns, setAddOns] = useState<BillableAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<NewRow | null>(null);

  const canDelete = role !== 'cellar';

  const load = useCallback(() => {
    setLoading(true);
    getBillableAddOns()
      .then(setAddOns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const enabledRules = rateRules
    .filter((r) => r.enabled)
    .sort((a, b) => a.label.localeCompare(b.label));

  const selectedRule = newRow ? enabledRules.find((r) => r.id === newRow.rateRuleId) : undefined;
  const qty = newRow ? parseFloat(newRow.quantity) || 0 : 0;
  const computedTotal = selectedRule ? Math.round(selectedRule.rate * qty * 100) / 100 : 0;

  const handleAdd = () => {
    setNewRow({ date: todayStr(), rateRuleId: '', quantity: '', ownerCode: ownerCodes[0] || '', notes: '' });
  };

  const handleCancel = () => {
    setNewRow(null);
  };

  const handleSave = async () => {
    if (!newRow || !selectedRule) return;
    setAdding(true);
    try {
      const updated = await addBillableAddOn({
        date: newRow.date,
        rateRuleId: selectedRule.id,
        rateRuleLabel: selectedRule.label,
        quantity: Math.round(qty * 1000) / 1000,
        ownerCode: newRow.ownerCode,
        rate: selectedRule.rate,
        billingUnit: selectedRule.billingUnit,
        totalCost: computedTotal,
        notes: newRow.notes,
      });
      setAddOns(updated);
      setNewRow(null);
    } catch {
      // keep form open on error
    } finally {
      setAdding(false);
    }
  };

  const prevMonth = getPreviousMonth();
  const prevMonthCount = addOns.filter((a) => a.date.startsWith(prevMonth.yearMonth)).length;

  const handleClearMonth = async () => {
    if (!window.confirm(`Clear ${prevMonthCount} add-on(s) from ${prevMonth.label}?`)) return;
    try {
      const updated = await clearBillableAddOnsByMonth(prevMonth.yearMonth);
      setAddOns(updated);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const updated = await deleteBillableAddOn(id);
      setAddOns(updated);
    } catch {
      // ignore
    }
  };

  const thClass = 'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
  const tdClass = 'px-3 py-2 text-sm text-gray-700 whitespace-nowrap';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Billable Add-Ons</h2>
        {!newRow && (
          <div className="flex gap-2">
            {canDelete && (
              <button
                onClick={handleClearMonth}
                disabled={prevMonthCount === 0}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear {prevMonth.label} ({prevMonthCount})
              </button>
            )}
            <button
              onClick={handleAdd}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-violet-600 text-white text-sm rounded hover:bg-violet-700"
            >
              Add Row
            </button>
          </div>
        )}
      </div>

      {/* New row form — stacked card on mobile, inline table row on desktop */}
      {newRow && (
        <div className="mb-4 border border-violet-200 bg-violet-50 rounded-lg p-4 md:hidden">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date</label>
              <input
                type="date"
                value={newRow.date}
                onChange={(e) => setNewRow({ ...newRow, date: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Item</label>
              <select
                value={newRow.rateRuleId}
                onChange={(e) => setNewRow({ ...newRow, rateRuleId: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">-- Select --</option>
                {enabledRules.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Qty</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newRow.quantity}
                  onChange={(e) => setNewRow({ ...newRow, quantity: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Owner</label>
                <select
                  value={newRow.ownerCode}
                  onChange={(e) => setNewRow({ ...newRow, ownerCode: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {ownerCodes.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            </div>
            {selectedRule && (
              <div className="grid grid-cols-3 gap-3 bg-white rounded p-2 text-sm">
                <div>
                  <span className="block text-xs text-gray-400">Rate</span>
                  <span className="font-medium">${selectedRule.rate.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400">Units</span>
                  <span>{selectedRule.billingUnit}</span>
                </div>
                <div>
                  <span className="block text-xs text-gray-400">Total</span>
                  <span className="font-bold">{qty > 0 ? `$${computedTotal.toFixed(2)}` : '—'}</span>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
              <input
                type="text"
                value={newRow.notes}
                onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                placeholder="Optional notes..."
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!selectedRule || qty <= 0 || adding}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {adding ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Item</th>
                  <th className={thClass}>Qty</th>
                  <th className={thClass}>Owner</th>
                  <th className={thClass}>Rate</th>
                  <th className={thClass}>Units</th>
                  <th className={thClass}>Total</th>
                  <th className={thClass}>Notes</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {newRow && (
                  <tr className="bg-violet-50">
                    <td className={tdClass}>
                      <input
                        type="date"
                        value={newRow.date}
                        onChange={(e) => setNewRow({ ...newRow, date: e.target.value })}
                        className="border rounded px-2 py-1 text-sm w-36"
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        value={newRow.rateRuleId}
                        onChange={(e) => setNewRow({ ...newRow, rateRuleId: e.target.value })}
                        className="border rounded px-2 py-1 text-sm w-48"
                      >
                        <option value="">-- Select --</option>
                        {enabledRules.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={newRow.quantity}
                        onChange={(e) => setNewRow({ ...newRow, quantity: e.target.value })}
                        className="border rounded px-2 py-1 text-sm w-20"
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        value={newRow.ownerCode}
                        onChange={(e) => setNewRow({ ...newRow, ownerCode: e.target.value })}
                        className="border rounded px-2 py-1 text-sm w-32"
                      >
                        {ownerCodes.map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass + ' text-gray-500'}>
                      {selectedRule ? `$${selectedRule.rate.toFixed(2)}` : '—'}
                    </td>
                    <td className={tdClass + ' text-gray-500'}>
                      {selectedRule ? selectedRule.billingUnit : '—'}
                    </td>
                    <td className={tdClass + ' font-medium'}>
                      {selectedRule && qty > 0 ? `$${computedTotal.toFixed(2)}` : '—'}
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={newRow.notes}
                        onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                        placeholder="Notes..."
                        className="border rounded px-2 py-1 text-sm w-40"
                      />
                    </td>
                    <td className={tdClass}>
                      <div className="flex gap-1">
                        <button
                          onClick={handleSave}
                          disabled={!selectedRule || qty <= 0 || adding}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {addOns.length === 0 && !newRow && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">
                      No add-on charges yet. Click "Add Row" to get started.
                    </td>
                  </tr>
                )}
                {addOns.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className={tdClass}>{a.date}</td>
                    <td className={tdClass}>{a.rateRuleLabel}</td>
                    <td className={tdClass}>{a.quantity}</td>
                    <td className={tdClass}>{a.ownerCode}</td>
                    <td className={tdClass}>${a.rate.toFixed(2)}</td>
                    <td className={tdClass}>{a.billingUnit}</td>
                    <td className={tdClass + ' font-medium'}>${a.totalCost.toFixed(2)}</td>
                    <td className={tdClass}>{a.notes}</td>
                    <td className={tdClass}>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold"
                          title="Delete"
                        >
                          X
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards — visible only on mobile */}
          <div className="md:hidden space-y-3">
            {addOns.length === 0 && !newRow && (
              <p className="text-center text-sm text-gray-400 py-6">
                No add-on charges yet. Tap "Add Row" to get started.
              </p>
            )}
            {addOns.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.rateRuleLabel}</p>
                    <p className="text-xs text-gray-500">{a.date} &middot; {a.ownerCode}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">${a.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{a.quantity} &times; ${a.rate.toFixed(2)}/{a.billingUnit.replace('per ', '')}</p>
                  </div>
                </div>
                {a.notes && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{a.notes}</p>
                )}
                {canDelete && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
