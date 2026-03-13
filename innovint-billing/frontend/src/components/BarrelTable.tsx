import React, { useMemo } from 'react';
import { BarrelBillingRow } from '../api/client';

interface BarrelTableProps {
  rows: BarrelBillingRow[];
}

export default function BarrelTable({ rows }: BarrelTableProps) {
  const totalCharge = useMemo(
    () => rows.reduce((sum, r) => sum + r.charge, 0),
    [rows]
  );

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snapshot 1</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snapshot 2</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snapshot 3</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Avg Barrels</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Rate</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Charge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.ownerCode}-${i}`} className="border-t hover:bg-gray-50">
              <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
              <td className="px-3 py-1.5 text-right">{row.snap1}</td>
              <td className="px-3 py-1.5 text-right">{row.snap2}</td>
              <td className="px-3 py-1.5 text-right">{row.snap3}</td>
              <td className="px-3 py-1.5 text-right">{row.avgBarrels.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right">${row.rate.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right font-semibold">${row.charge.toFixed(2)}</td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="border-t-2 border-violet-200 bg-violet-50 font-semibold">
              <td className="px-3 py-1.5" colSpan={6}>Total</td>
              <td className="px-3 py-1.5 text-right">${totalCharge.toFixed(2)}</td>
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                No barrel inventory data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
