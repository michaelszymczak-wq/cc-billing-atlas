import React, { useState, useMemo } from 'react';
import { ActionRow } from '../api/client';

interface ResultsTableProps {
  rows: ActionRow[];
}

export default function ResultsTable({ rows }: ResultsTableProps) {
  const [sortField, setSortField] = useState<keyof ActionRow>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterType, setFilterType] = useState('');

  const ownerCodes = useMemo(() => [...new Set(rows.map((r) => r.ownerCode))].sort(), [rows]);
  const actionTypes = useMemo(() => [...new Set(rows.map((r) => r.actionType))].sort(), [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (filterOwner) result = result.filter((r) => r.ownerCode === filterOwner);
    if (filterType) result = result.filter((r) => r.actionType === filterType);
    return result;
  }, [rows, filterOwner, filterType]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: keyof ActionRow) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const columns: { key: keyof ActionRow; label: string }[] = [
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionId', label: 'Action ID' },
    { key: 'lotCodes', label: 'Lot Codes' },
    { key: 'performer', label: 'Performer' },
    { key: 'date', label: 'Date' },
    { key: 'ownerCode', label: 'Owner' },
    { key: 'analysisOrNotes', label: 'Analysis/Notes' },
    { key: 'quantity', label: 'Qty' },
    { key: 'rate', label: 'Rate' },
    { key: 'setupFee', label: 'Setup Fee' },
    { key: 'total', label: 'Total' },
    { key: 'matchedRuleLabel', label: 'Rule Matched' },
  ];

  function rowBgColor(row: ActionRow): string {
    if (row.error) return 'bg-red-50';
    if (row.matched) return 'bg-green-50';
    return 'bg-yellow-50';
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Owners</option>
          {ownerCodes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Types</option>
          {actionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">
          Showing {sorted.length} of {rows.length} rows
        </span>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-200 select-none whitespace-nowrap"
                >
                  {col.label}
                  {sortField === col.key && (sortDir === 'asc' ? ' \u25B2' : ' \u25BC')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={`${row.actionId}-${i}`} className={`border-t ${rowBgColor(row)} hover:brightness-95 ${row.matchedRuleLabel.includes('(rectified)') ? 'italic' : ''}`}>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.actionType}</td>
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
                <td className="px-3 py-1.5 max-w-[180px] truncate" title={row.lotCodes}>{row.lotCodes}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.performer}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{row.date}</td>
                <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate" title={row.analysisOrNotes}>{row.analysisOrNotes}</td>
                <td className="px-3 py-1.5 text-right">{row.quantity ? row.quantity.toFixed(1) : ''}</td>
                <td className="px-3 py-1.5 text-right">${row.rate.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">${row.setupFee.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">${row.total.toFixed(2)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {row.matched ? (
                    <span className="text-xs text-green-700">{row.matchedRuleLabel}</span>
                  ) : (
                    <span className="text-xs text-amber-600">{'\u26A0'} No match</span>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                  No actions to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
