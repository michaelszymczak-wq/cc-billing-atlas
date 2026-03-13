import React from 'react';
import { BulkBillingRow } from '../api/client';

interface BulkTableProps {
  rows: BulkBillingRow[];
}

export default function BulkTable({ rows }: BulkTableProps) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 1 (gal)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 2 (gal)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Snap 3 (gal)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Billing Vol</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Proration</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Rate</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.ownerCode}-${i}`} className="border-t hover:bg-gray-50">
              <td className="px-3 py-1.5 font-mono">{row.ownerCode}</td>
              <td className="px-3 py-1.5 text-right">{row.snap1Volume.toFixed(1)}</td>
              <td className="px-3 py-1.5 text-right">{row.snap2Volume.toFixed(1)}</td>
              <td className="px-3 py-1.5 text-right">{row.snap3Volume.toFixed(1)}</td>
              <td className="px-3 py-1.5 text-right">{row.billingVolume.toFixed(1)}</td>
              <td className="px-3 py-1.5 text-right">{(row.proration * 100).toFixed(0)}%</td>
              <td className="px-3 py-1.5 text-right">${row.rate.toFixed(2)}</td>
              <td className="px-3 py-1.5 text-right font-semibold">${row.totalCost.toFixed(2)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                No bulk inventory data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
