import React, { useState, useMemo } from 'react';
import { ActionRow, AuditRow, RateRule } from '../api/client';

interface AuditTableProps {
  rows: AuditRow[];
  rateRules: RateRule[];
  allOwnerCodes: string[];
  onRectify: (auditIndex: number, actionRow: ActionRow) => void;
}

interface RowEdit {
  ownerCode: string;
  ruleId: string;
  totalOverride: string;
}

export default function AuditTable({ rows, rateRules, allOwnerCodes, onRectify }: AuditTableProps) {
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});

  const enabledRules = useMemo(
    () => rateRules.filter((r) => r.enabled).sort((a, b) => a.label.localeCompare(b.label)),
    [rateRules]
  );

  function getEdit(idx: number, row: AuditRow): RowEdit {
    return edits[idx] || { ownerCode: row.ownerCode, ruleId: '', totalOverride: '' };
  }

  function updateEdit(idx: number, row: AuditRow, partial: Partial<RowEdit>) {
    const current = getEdit(idx, row);
    setEdits((prev) => ({ ...prev, [idx]: { ...current, ...partial } }));
  }

  function computeTotal(rule: RateRule): number {
    const qty = 1;
    return Math.round((qty * rule.rate + rule.setupFee) * 100) / 100;
  }

  function handleRectify(idx: number, row: AuditRow) {
    const edit = getEdit(idx, row);
    const rule = enabledRules.find((r) => r.id === edit.ruleId);
    if (!rule) return;

    const calculated = computeTotal(rule);
    const total = edit.totalOverride !== '' ? parseFloat(edit.totalOverride) || 0 : calculated;

    const actionRow: ActionRow = {
      actionType: row.actionType,
      actionId: row.actionId,
      lotCodes: row.lotCodes,
      performer: row.performer,
      date: row.date,
      ownerCode: edit.ownerCode || row.ownerCode,
      analysisOrNotes: row.analysisOrNotes,
      hours: 0,
      rate: rule.rate,
      setupFee: rule.setupFee,
      total,
      matched: true,
      matchedRuleLabel: `${rule.label} (rectified)`,
      quantity: 1,
    };

    onRectify(idx, actionRow);
    // Remove from edits
    setEdits((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-red-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action Type</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action ID</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Lot Codes</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Performer</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Analysis/Notes</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Assign Rule</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const edit = getEdit(i, row);
            const selectedRule = enabledRules.find((r) => r.id === edit.ruleId);
            const calculated = selectedRule ? computeTotal(selectedRule) : 0;
            const displayTotal = edit.totalOverride !== '' ? edit.totalOverride : (selectedRule ? calculated.toFixed(2) : '');

            return (
              <tr key={`${row.actionId}-${i}`} className="border-t hover:bg-red-50/30">
                <td className="px-3 py-1.5">{row.actionType}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-mono text-xs">
                  <a
                    href={`https://cellar.innovint.us/#/wineries/2159258/activity/action/${row.actionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-800 underline"
                  >
                    {row.actionId.slice(0, 12)}
                  </a>
                </td>
                <td className="px-3 py-1.5 max-w-[150px] truncate" title={row.lotCodes}>{row.lotCodes}</td>
                <td className="px-3 py-1.5">{row.performer}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.date}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={edit.ownerCode}
                    onChange={(e) => updateEdit(i, row, { ownerCode: e.target.value })}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs font-mono"
                  >
                    <option value={row.ownerCode}>{row.ownerCode}</option>
                    {allOwnerCodes
                      .filter((c) => c !== row.ownerCode)
                      .map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5 max-w-[180px] truncate" title={row.analysisOrNotes}>{row.analysisOrNotes}</td>
                <td className="px-3 py-1.5 text-red-600 text-xs">{row.reason}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={edit.ruleId}
                    onChange={(e) => updateEdit(i, row, { ruleId: e.target.value, totalOverride: '' })}
                    className="w-48 px-1 py-0.5 border border-gray-300 rounded text-xs"
                  >
                    <option value="">-- Select rule --</option>
                    {enabledRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} (${r.rate}/{r.billingUnit})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  {selectedRule && (
                    <input
                      type="text"
                      value={displayTotal}
                      onChange={(e) => updateEdit(i, row, { totalOverride: e.target.value })}
                      className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs text-right font-mono"
                      placeholder={calculated.toFixed(2)}
                    />
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    onClick={() => handleRectify(i, row)}
                    disabled={!selectedRule}
                    className="px-2 py-0.5 bg-violet-600 text-white rounded text-xs hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Rectify
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                No unmatched actions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
