import React, { useState } from 'react';
import { CustomerRecord, saveCustomers } from '../api/client';

interface CustomersPageProps {
  customers: CustomerRecord[];
  onCustomersChange: (customers: CustomerRecord[]) => void;
  unmappedOwners?: string[];
}

function emptyRecord(): CustomerRecord {
  return { ownerName: '', code: '', displayName: '', address: '', phone: '', email: '' };
}

export default function CustomersPage({ customers, onCustomersChange, unmappedOwners = [] }: CustomersPageProps) {
  const [rows, setRows] = useState<CustomerRecord[]>(() => {
    const list = [...customers];
    // Add unmapped owners not already present
    for (const owner of unmappedOwners) {
      if (!list.some(c => c.ownerName === owner)) {
        list.push({ ...emptyRecord(), ownerName: owner });
      }
    }
    return list.length > 0 ? list : [emptyRecord()];
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [dirty, setDirty] = useState(false);

  const updateRow = (idx: number, field: keyof CustomerRecord, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRecord()]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setStatus('saving');
    // Filter out completely empty rows
    const toSave = rows.filter(r => r.ownerName.trim() || r.code.trim() || r.displayName.trim());
    try {
      await saveCustomers(toSave);
      setStatus('success');
      setDirty(false);
      onCustomersChange(toSave);
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const imported: CustomerRecord[] = [];
      for (const line of lines) {
        const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2) {
          imported.push({
            ownerName: parts[0] || '',
            code: parts[1] || '',
            displayName: parts[2] || '',
            address: parts[3] || '',
            phone: parts[4] || '',
            email: parts[5] || '',
          });
        }
      }
      if (imported.length === 0) return;
      setRows(prev => [...prev, ...imported]);
      setDirty(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const unmappedSet = new Set(unmappedOwners);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Customers</h2>
      <p className="text-sm text-gray-500 mb-6">Manage customer mappings, display names, and contact info for invoices</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Owner Name</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Code</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Display Name</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Address</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Phone</th>
              <th className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">Email</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isUnmapped = unmappedSet.has(row.ownerName) && !row.code.trim();
              return (
                <tr key={idx} className={`border-b ${isUnmapped ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.ownerName}
                      onChange={e => updateRow(idx, 'ownerName', e.target.value)}
                      placeholder="InnoVint owner"
                      className={`w-full px-2 py-1 border rounded text-sm ${isUnmapped ? 'border-amber-400' : 'border-gray-300'}`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.code}
                      onChange={e => updateRow(idx, 'code', e.target.value.toUpperCase())}
                      placeholder="ABC"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.displayName}
                      onChange={e => updateRow(idx, 'displayName', e.target.value)}
                      placeholder="Invoice name"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.address}
                      onChange={e => updateRow(idx, 'address', e.target.value)}
                      placeholder="Address"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.phone}
                      onChange={e => updateRow(idx, 'phone', e.target.value)}
                      placeholder="Phone"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.email}
                      onChange={e => updateRow(idx, 'email', e.target.value)}
                      placeholder="Email"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-red-400 hover:text-red-600 text-sm px-1"
                      title="Remove"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={addRow}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          + Add Row
        </button>
        <label className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
          Import CSV
          <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
        </label>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-1.5 bg-violet-600 text-white rounded-md text-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving...' : dirty ? 'Save Customers' : 'Saved'}
        </button>
        {status === 'success' && <span className="text-sm text-green-600">Saved.</span>}
        {status === 'error' && <span className="text-sm text-red-600">Failed to save.</span>}
      </div>

      <p className="text-xs text-gray-400 mt-2">CSV format: Owner Name, Code, Display Name, Address, Phone, Email</p>
    </div>
  );
}
