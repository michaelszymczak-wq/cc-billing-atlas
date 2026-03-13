import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { RateRule, saveRateRules, getSettings, generateRuleId } from '../api/client';
import RuleEditorModal from './RuleEditorModal';

const ACTION_TYPE_COLORS: Record<string, string> = {
  ANALYSIS: 'bg-blue-100 text-blue-700',
  CUSTOM: 'bg-purple-100 text-purple-700',
  STEAM: 'bg-orange-100 text-orange-700',
  ADDITION: 'bg-green-100 text-green-700',
  FILTER: 'bg-cyan-100 text-cyan-700',
  PROCESSFRUITTOVOLUME: 'bg-teal-100 text-teal-700',
  PROCESSFRUITTOWEIGHT: 'bg-teal-100 text-teal-700',
};

function getTypeBadgeClass(actionType: string): string {
  return ACTION_TYPE_COLORS[actionType.toUpperCase()] || 'bg-gray-100 text-gray-700';
}

interface RateTableManagerProps {
  rules: RateRule[];
  onRulesChange: (rules: RateRule[]) => void;
}

export default function RateTableManager({ rules, onRulesChange }: RateTableManagerProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showDisabled, setShowDisabled] = useState(true);
  const [editingRule, setEditingRule] = useState<RateRule | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importedRules, setImportedRules] = useState<RateRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const actionTypes = useMemo(() => {
    const types = new Set(rules.map((r) => r.actionType));
    return [...types].sort();
  }, [rules]);

  const filtered = useMemo(() => {
    let result = rules;
    if (!showDisabled) result = result.filter((r) => r.enabled);
    if (filterType) result = result.filter((r) => r.actionType === filterType);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.actionType.toLowerCase().includes(q) ||
        r.variation.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rules, search, filterType, showDisabled]);

  // Duplicate detection
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dups = new Set<string>();
    for (const r of rules) {
      if (!r.enabled) continue;
      const key = `${r.actionType.toUpperCase().trim()}|${r.variation.toUpperCase().trim()}|${(r.vesselType || '').toUpperCase().trim()}|${r.bottlesPerCase || ''}|${(r.analysisSource || '').toUpperCase().trim()}`;
      if (seen.has(key)) dups.add(key);
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return dups;
  }, [rules]);

  const isDuplicate = (r: RateRule) => {
    const key = `${r.actionType.toUpperCase().trim()}|${r.variation.toUpperCase().trim()}|${(r.vesselType || '').toUpperCase().trim()}|${r.bottlesPerCase || ''}|${(r.analysisSource || '').toUpperCase().trim()}`;
    return r.enabled && duplicates.has(key);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const persistRules = useCallback(async (newRules: RateRule[]) => {
    onRulesChange(newRules);
    setSaving(true);
    try {
      await saveRateRules(newRules);
    } catch {
      showToast('Failed to save rules');
    }
    setSaving(false);
  }, [onRulesChange]);

  // ─── CRUD ───

  const handleAddNew = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  const handleEdit = (rule: RateRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleSave = async (rule: RateRule) => {
    const exists = rules.findIndex((r) => r.id === rule.id);
    let newRules: RateRule[];
    if (exists >= 0) {
      newRules = [...rules];
      newRules[exists] = rule;
    } else {
      newRules = [...rules, rule];
    }
    await persistRules(newRules);
    setShowModal(false);
    showToast('Rule saved');
  };

  const handleSaveAndAdd = async (rule: RateRule) => {
    const exists = rules.findIndex((r) => r.id === rule.id);
    let newRules: RateRule[];
    if (exists >= 0) {
      newRules = [...rules];
      newRules[exists] = rule;
    } else {
      newRules = [...rules, rule];
    }
    await persistRules(newRules);
    setEditingRule(null);
    showToast('Rule saved');
    // Modal stays open with blank form
  };

  const handleDuplicate = async (rule: RateRule) => {
    const copy: RateRule = { ...rule, id: generateRuleId(), label: `${rule.label} (copy)` };
    await persistRules([...rules, copy]);
    showToast('Rule duplicated');
  };

  const handleDelete = async (id: string) => {
    await persistRules(rules.filter((r) => r.id !== id));
    showToast('Rule deleted');
  };

  const handleToggleEnabled = async (id: string) => {
    const newRules = rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
    await persistRules(newRules);
  };

  const handleInlineEdit = async (id: string, field: 'rate' | 'setupFee', value: number) => {
    const newRules = rules.map((r) => r.id === id ? { ...r, [field]: value } : r);
    await persistRules(newRules);
  };

  // ─── Drag & Drop ───

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newRules = [...rules];
    const [moved] = newRules.splice(dragIndex, 1);
    newRules.splice(index, 0, moved);
    onRulesChange(newRules);
    setDragIndex(index);
  };

  const handleDragEnd = async () => {
    setDragIndex(null);
    await persistRules(rules);
  };

  // ─── CSV Import ───

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as string[][];
        let startRow = 0;
        if (rows.length > 0 && rows[0][0] && isNaN(Number(rows[0][0]))) {
          startRow = 1; // skip header
        }
        const parsed: RateRule[] = [];
        for (let i = startRow; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length < 2) continue;
          const enabledStr = (r[9] || 'true').toLowerCase().trim();
          const maxQtyStr = (r[7] || '').trim();
          const setupFeeModeStr = (r[10] || '').trim().toLowerCase();
          const excludeTaxStr = (r[13] || '').trim();
          const vesselTypeStr = (r[14] || '').trim();
          const analysisSourceStr = (r[15] || '').trim();
          parsed.push({
            id: generateRuleId(),
            actionType: (r[0] || '').trim(),
            variation: (r[1] || '').trim(),
            label: (r[2] || '').trim() || `${(r[0] || '').trim()} \u2013 ${(r[1] || '').trim()}`.trim(),
            billingUnit: (r[3] || 'flat fee').trim(),
            rate: parseFloat(r[4] || '0') || 0,
            setupFee: parseFloat(r[5] || '0') || 0,
            minQty: parseFloat(r[6] || '0') || 0,
            maxQty: maxQtyStr === '' || maxQtyStr.toLowerCase() === 'infinity' ? Infinity : (parseFloat(maxQtyStr) || 0),
            notes: (r[8] || '').trim(),
            enabled: ['1', 'true', 'yes'].includes(enabledStr),
            setupFeeMode: setupFeeModeStr === 'spread_daily' ? 'spread_daily' : 'per_action',
            minDollar: parseFloat(r[11] || '0') || 0,
            freeFirstPerLot: ['1', 'true', 'yes'].includes((r[12] || '').trim().toLowerCase()),
            excludeTaxClasses: excludeTaxStr ? excludeTaxStr.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
            vesselType: vesselTypeStr || undefined,
            analysisSource: analysisSourceStr || undefined,
            excludeAllInclusive: ['1', 'true', 'yes'].includes((r[16] || '').trim().toLowerCase()) || undefined,
          });
        }
        setImportedRules(parsed);
        setShowImportPreview(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  };

  const handleImportMerge = async () => {
    const merged = [...rules];
    for (const imp of importedRules) {
      const existIdx = merged.findIndex((r) =>
        r.actionType.toUpperCase().trim() === imp.actionType.toUpperCase().trim() &&
        r.variation.toUpperCase().trim() === imp.variation.toUpperCase().trim()
      );
      if (existIdx >= 0) {
        merged[existIdx] = { ...merged[existIdx], ...imp, id: merged[existIdx].id };
      } else {
        merged.push(imp);
      }
    }
    await persistRules(merged);
    setShowImportPreview(false);
    showToast(`Imported ${importedRules.length} rules`);
  };

  const handleImportReplace = async () => {
    await persistRules(importedRules);
    setShowImportPreview(false);
    showToast(`Replaced with ${importedRules.length} rules`);
  };

  // ─── CSV Export ───

  const handleExportCsv = () => {
    const header = 'actionType,variation,label,billingUnit,rate,setupFee,minQty,maxQty,notes,enabled,setupFeeMode,minDollar,freeFirstPerLot,excludeTaxClasses,vesselType,analysisSource,excludeAllInclusive';
    const rows = rules.map((r) =>
      [r.actionType, r.variation, r.label, r.billingUnit, r.rate, r.setupFee, r.minQty,
       r.maxQty === Infinity ? '' : r.maxQty, r.notes.replace(/,/g, ';'), r.enabled ? '1' : '0',
       r.setupFeeMode || 'per_action', r.minDollar || 0, r.freeFirstPerLot ? '1' : '0',
       (r.excludeTaxClasses || []).join('|'), r.vesselType || '', r.analysisSource || '',
       r.excludeAllInclusive ? '1' : '0'].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-rules.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Rate Table</h2>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-800 text-white rounded-md text-sm shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleAddNew} className="px-3 py-1.5 bg-violet-600 text-white rounded-md text-sm hover:bg-violet-700">
          + Add Rule
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
          Import CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
        <button onClick={handleExportCsv} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50" disabled={rules.length === 0}>
          Export CSV
        </button>
        <div className="flex-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules..."
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-48"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Types</option>
          {actionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} className="rounded border-gray-300" />
          Show disabled
        </label>
      </div>

      {/* Rules count */}
      <p className="text-xs text-gray-500">
        {filtered.length} of {rules.length} rules
        {rules.filter((r) => r.enabled).length !== rules.length && ` (${rules.filter((r) => r.enabled).length} enabled)`}
      </p>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-500 w-8">#</th>
              <th className="px-2 py-2 text-center font-medium text-gray-500 w-14">On</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Action Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Variation</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Label</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Unit</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Rate</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Setup Fee</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Min ($)</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Material</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Notes</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule, idx) => {
              const origIdx = rules.indexOf(rule);
              const noValue = rule.rate === 0 && rule.setupFee === 0;
              const isFruit = rule.actionType === 'PROCESSFRUITTOVOLUME' || rule.actionType === 'PROCESSFRUITTOWEIGHT';
              return (
                <tr
                  key={rule.id}
                  draggable
                  onDragStart={() => handleDragStart(origIdx)}
                  onDragOver={(e) => handleDragOver(e, origIdx)}
                  onDragEnd={handleDragEnd}
                  className={`border-t cursor-grab active:cursor-grabbing ${!rule.enabled ? 'opacity-50' : ''} ${isDuplicate(rule) ? 'bg-amber-50' : 'hover:bg-gray-50'} ${noValue ? 'border-l-4 border-l-yellow-400' : ''}`}
                >
                  <td className="px-2 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => handleToggleEnabled(rule.id)}
                      className={`w-8 h-4 rounded-full relative transition-colors ${rule.enabled ? 'bg-violet-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClass(rule.actionType)}`}>
                      {rule.actionType}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-700 max-w-[200px]" title={rule.variation}>
                    <span className="truncate">{rule.variation || '\u2014'}</span>
                    {rule.vesselType && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded font-medium">{rule.vesselType}</span>
                    )}
                    {rule.analysisSource && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-medium">
                        {{ 'IN-HOUSE': 'In House', 'ETS_MANUAL': 'ETS', 'MY_ENOLOGIST': 'MyEnol' }[rule.analysisSource] || rule.analysisSource}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-medium max-w-[200px] truncate" title={rule.label}>{rule.label}</td>
                  <td className="px-3 py-1.5 text-gray-500 text-xs">{rule.billingUnit}</td>
                  <td className="px-3 py-1.5 text-right">
                    <InlineNumberCell value={rule.rate} onChange={(v) => handleInlineEdit(rule.id, 'rate', v)} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <InlineNumberCell value={rule.setupFee} onChange={(v) => handleInlineEdit(rule.id, 'setupFee', v)} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{(rule.minDollar && rule.minDollar > 0) ? `$${rule.minDollar.toFixed(2)}` : ''}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{(rule.materialRate && rule.materialRate > 0) ? `$${rule.materialRate.toFixed(3)}` : ''}</td>
                  <td className="px-3 py-1.5 text-gray-400 text-xs max-w-[100px] truncate" title={rule.notes}>{rule.notes}</td>
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(rule)} className="p-1 hover:bg-gray-200 rounded" title="Edit">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDuplicate(rule)} className="p-1 hover:bg-gray-200 rounded" title="Duplicate">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1 hover:bg-red-100 rounded" title="Delete">
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-12 text-center text-gray-400">
                  {rules.length === 0
                    ? 'No rate rules yet. Click "+ Add Rule" to create one.'
                    : 'No rules match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Duplicate warning */}
      {duplicates.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-md text-sm">
          Duplicate rules detected \u2014 only the first enabled match per action type + variation will be used.
        </div>
      )}

      {/* Rule Editor Modal */}
      {showModal && (
        <RuleEditorModal
          rule={editingRule}
          onSave={handleSave}
          onSaveAndAdd={handleSaveAndAdd}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Import CSV</h3>
            <p className="text-sm text-gray-600">
              {importedRules.length} rules found.
              {rules.length > 0 && ` You currently have ${rules.length} rules.`}
            </p>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-xs">
              {importedRules.slice(0, 10).map((r, i) => (
                <div key={i} className="py-0.5">{r.actionType} | {r.variation || '(any)'} | ${r.rate.toFixed(2)}</div>
              ))}
              {importedRules.length > 10 && <div className="text-gray-400">...and {importedRules.length - 10} more</div>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImportPreview(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              {rules.length > 0 && (
                <button onClick={handleImportMerge} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700">
                  Merge
                </button>
              )}
              <button onClick={handleImportReplace} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600">
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline editable $ cell ───

function InlineNumberCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const startEdit = () => {
    setText(value.toFixed(2));
    setEditing(true);
  };

  const commitEdit = () => {
    const num = parseFloat(text) || 0;
    if (num !== value) onChange(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        className="w-20 px-1 py-0 border border-violet-400 rounded text-right text-sm"
      />
    );
  }

  return (
    <span onClick={startEdit} className="cursor-pointer hover:text-violet-600" title="Click to edit">
      ${value.toFixed(2)}
    </span>
  );
}
