import React, { useMemo, useState } from 'react';
import { FruitIntakeRecord } from '../api/client';

interface InstallmentScheduleProps {
  records: FruitIntakeRecord[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonthKey(key: string): { monthIdx: number; year: number } {
  const [month, yearStr] = key.split(' ');
  return { monthIdx: MONTH_NAMES.indexOf(month), year: parseInt(yearStr, 10) };
}

export default function InstallmentSchedule({ records }: InstallmentScheduleProps) {
  const [copiedMonth, setCopiedMonth] = useState<string | null>(null);

  const months = useMemo(() => {
    const allMonths = new Set<string>();
    for (const r of records) {
      for (const inst of r.installments) {
        allMonths.add(inst.month);
      }
    }
    return Array.from(allMonths).sort((a, b) => {
      const pa = parseMonthKey(a);
      const pb = parseMonthKey(b);
      if (pa.year !== pb.year) return pa.year - pb.year;
      return pa.monthIdx - pb.monthIdx;
    });
  }, [records]);

  // Build lookup: recordId → { month → amount }
  const recordAmounts = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of records) {
      const monthMap: Record<string, number> = {};
      for (const inst of r.installments) {
        monthMap[inst.month] = (monthMap[inst.month] || 0) + inst.amount;
      }
      map.set(r.id, monthMap);
    }
    return map;
  }, [records]);

  // Subtotals per month
  const subtotals = useMemo(() => {
    const subs: Record<string, number> = {};
    for (const m of months) subs[m] = 0;
    for (const [, monthMap] of recordAmounts) {
      for (const [m, amt] of Object.entries(monthMap)) {
        subs[m] = (subs[m] || 0) + amt;
      }
    }
    return subs;
  }, [months, recordAmounts]);

  const copyMonth = (month: string) => {
    const lines: string[] = [];
    for (const r of records) {
      const amt = recordAmounts.get(r.id)?.[month];
      if (amt && amt > 0) {
        lines.push(`${r.ownerCode}\t${amt.toFixed(2)}`);
      }
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedMonth(month);
      setTimeout(() => setCopiedMonth(null), 2000);
    });
  };

  if (months.length === 0) {
    return <p className="text-sm text-gray-500">No installment data available.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Code</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-[60px] bg-gray-50 z-10">Lot Code</th>
            {months.map((m) => (
              <th key={m} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                <button
                  onClick={() => copyMonth(m)}
                  className="hover:text-violet-600"
                  title={`Copy ${m} data to clipboard`}
                >
                  {m.replace(/(\w+)\s/, (_, name: string) => name.substring(0, 3) + ' ')}
                  {copiedMonth === m && ' (copied)'}
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {records.map((r) => {
            const monthMap = recordAmounts.get(r.id) || {};
            const rowTotal = Object.values(monthMap).reduce((s, v) => s + v, 0);
            return (
              <tr key={r.id}>
                <td className="px-3 py-1.5 font-mono sticky left-0 bg-white z-10">{r.ownerCode}</td>
                <td className="px-3 py-1.5 font-mono sticky left-[60px] bg-white z-10">{r.lotCode}</td>
                {months.map((m) => (
                  <td key={m} className="px-3 py-1.5 text-right">
                    {monthMap[m] ? `$${monthMap[m].toFixed(2)}` : ''}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right font-semibold">${rowTotal.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Subtotal row */}
          <tr className="bg-gray-100 font-bold">
            <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10"></td>
            <td className="px-3 py-2 sticky left-[60px] bg-gray-100 z-10">SUBTOTAL</td>
            {months.map((m) => (
              <td key={m} className="px-3 py-2 text-right">
                ${subtotals[m].toFixed(2)}
              </td>
            ))}
            <td className="px-3 py-2 text-right">
              ${Object.values(subtotals).reduce((s, v) => s + v, 0).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
