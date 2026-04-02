import React, { useState, useEffect } from 'react';
import { RateRule, generateRuleId } from '../api/client';

const ACTION_TYPES = [
  'ANALYSIS', 'BOTTLE', 'CUSTOM', 'STEAM', 'ADDITION', 'FILTER',
  'BOND_TO_BOND_TRANSFER_IN', 'BOND_TO_BOND_TRANSFER_OUT',
  'PROCESSFRUITTOVOLUME', 'PROCESSFRUITTOWEIGHT',
  'BOTTLING', 'FILTRATION', 'RACKING', 'BLENDING', 'TOPPING', 'SAMPLING',
  'STORAGE', 'FRUITINTAKE',
];

const BOTTLE_FORMATS = [
  '100 mL Bottle', '10L Keg', '16 oz Bottle', '16G Keg', '19.2oz Can',
  '19.5L Keg', '2 x 4 lt Pack', '2 x 5 lt Pack', '4 x 4 lt Pack', '50L Keg',
  'Bag/Pouch: 1.5L', 'Bag/Pouch: 3L', 'Bag/Pouch: 5L', 'Balthazar',
  'Bomber', 'Bordeaux Jeroboam', 'Burgundy Jeroboam', 'Chopine', 'Clavelin',
  'Cornelius Keg', 'Demi', 'Dolium Keg', 'EU Std 70ct', 'Fifth', 'Full Keg',
  'Goliath', 'Growler', 'Half Bottle', 'Half/Slim Quarter Keg', 'Imperial',
  'Import Carbonation Keg', 'Import Keg', 'Jennie', 'Jeroboam', 'Jug',
  'Keg: 7.9 gal', 'Liter', 'Longneck', 'Magnum', 'Marie Jeanne',
  'Martell bottle', 'Melchior', 'Melchizedek', 'Methuselah', 'Microstar Keg',
  'Midas', 'Mini Liquor Bottle', 'Nebuchadnezzar', 'PET Plastic Keg',
  'Piccolo', 'Poco Vino', 'Pony/Quarter Barrel Keg', 'Pounder (can)',
  'Primat', 'Quarter', 'Rehoboam', 'Salmanazar', 'Sanke', 'Sixtel Keg',
  'Sleek (can)', 'Slim Brite (can)', 'Solomon', 'Sovereign', 'Standard',
  'Standard (can)', 'Standard Brite (can)', 'Standard European (can)',
  'Stubby', 'Tenth', 'Torpedo Ball Lock Keg', 'Torpedo/Sixth Barrel Keg',
  'Uni Keg', 'Woozy',
];

const TAX_CLASSES = [
  'FERMENTING_JUICE',
  'SWEETENING_JUICE',
  'LESS_THAN_14',
  '14_TO_21',
  'LESS_THAN_16',
  '16_TO_21',
  '21_TO_24',
  'ARTIFICIALLY_CARBONATED',
  'SPARKLING',
  'SPARKLING_BULK_PROCESSED',
  'HARD_CIDER',
  'BRANDY_OR_DISTILLED_SPIRIT',
  'VERMOUTH',
  'NON_LESS_THAN_14',
  'NON_14_TO_21',
  'DISTILLED_MATERIAL',
  'VINEGAR_STOCK',
  'CONCENTRATE',
  'DISTILLED_AT_160_OR_UNDER',
  'DISTILLED_AT_OVER_160',
];

const BILLING_UNITS = [
  'per hour', 'per barrel', 'per lot', 'per analysis', 'per case',
  'per kg', 'per gallon', 'flat fee', 'per vessel', 'per additive unit', 'per ton',
];

function defaultRule(): RateRule {
  return {
    id: generateRuleId(),
    actionType: '',
    variation: '',
    label: '',
    billingUnit: 'flat fee',
    rate: 0,
    setupFee: 0,
    minQty: 0,
    maxQty: Infinity,
    notes: '',
    enabled: true,
    setupFeeMode: 'per_action',
    minDollar: 0,
    freeFirstPerLot: false,
  };
}

function variationHint(actionType: string): string {
  switch (actionType) {
    case 'ANALYSIS': return 'Analysis panel or test name (e.g. "Full Chemistry", "SO2")';
    case 'CUSTOM': return 'Custom action name to match (leave blank to match all CUSTOM)';
    case 'STEAM': return 'Leave blank \u2014 STEAM billing is always per-barrel count';
    case 'FILTER': return 'Leave blank — billed by drain volume (gallons)';
    case 'ADDITION': return 'Additive product name (e.g. "SO2", "Tartaric Acid")';
    case 'BOTTLE': return 'Bottle format name (e.g. "Standard", "Magnum")';
    case 'PROCESSFRUITTOVOLUME':
    case 'PROCESSFRUITTOWEIGHT': return 'Leave blank \u2014 use Min/Max Qty for range';
    case 'STORAGE': return 'Vessel type: TANK (per gallon), BARREL (per barrel), or KEG (per keg)';
    case 'FRUITINTAKE': return 'Color or COLOR|VARIETAL (e.g. "RED", "WHITE|CHARDONNAY")';
    default: return 'Subtype or variation to match';
  }
}

interface RuleEditorModalProps {
  rule: RateRule | null;
  onSave: (rule: RateRule) => void;
  onSaveAndAdd: (rule: RateRule) => void;
  onClose: () => void;
}

export default function RuleEditorModal({ rule, onSave, onSaveAndAdd, onClose }: RuleEditorModalProps) {
  const [form, setForm] = useState<RateRule>(rule || defaultRule());
  const [labelManual, setLabelManual] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (rule) {
      setForm(rule);
      setLabelManual(true);
    } else {
      setForm(defaultRule());
      setLabelManual(false);
    }
  }, [rule]);

  // Auto-populate label
  useEffect(() => {
    if (!labelManual) {
      const parts = [form.actionType, form.variation].filter(Boolean);
      if (form.actionType === 'ADDITION' && form.vesselType) {
        parts.push(form.vesselType);
      }
      if (form.actionType === 'ANALYSIS' && form.analysisSource) {
        const sourceLabels: Record<string, string> = { 'IN-HOUSE': 'In House', 'ETS_MANUAL': 'ETS Manual', 'MY_ENOLOGIST': 'MyEnologist' };
        parts.push(sourceLabels[form.analysisSource] || form.analysisSource);
      }
      if (form.actionType === 'BOTTLE' && form.bottlesPerCase) {
        parts.push(`(${form.bottlesPerCase} btl/case)`);
      }
      setForm((f) => ({ ...f, label: parts.join(' \u2013 ') || '' }));
    }
  }, [form.actionType, form.variation, form.analysisSource, form.vesselType, form.bottlesPerCase, labelManual]);

  const update = (field: keyof RateRule, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    const warns: string[] = [];
    if (!form.actionType.trim()) errs.push('Action Type is required');
    if (form.rate < 0) errs.push('Rate must be >= 0');
    if (form.setupFee < 0) errs.push('Setup Fee must be >= 0');
    const isFruit = form.actionType === 'PROCESSFRUITTOVOLUME' || form.actionType === 'PROCESSFRUITTOWEIGHT';
    if (isFruit && form.minQty >= form.maxQty && form.maxQty !== Infinity) {
      errs.push('Min Qty must be less than Max Qty');
    }
    if (form.rate === 0 && form.setupFee === 0 && !(form.materialRate && form.materialRate > 0)) {
      warns.push('This rule will always bill $0');
    }
    setErrors(errs);
    setWarnings(warns);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(form);
  };

  const handleSaveAndAdd = () => {
    if (validate()) onSaveAndAdd(form);
  };

  const isFruitType = form.actionType === 'PROCESSFRUITTOVOLUME' || form.actionType === 'PROCESSFRUITTOWEIGHT';

  // Live preview
  const isAddition = form.actionType === 'ADDITION';
  const sampleQty = 3;
  const sampleVessels = 10;
  const rawTotal = isAddition
    ? (sampleVessels * form.rate) + (sampleQty * (form.materialRate || 0)) + form.setupFee
    : sampleQty * form.rate + form.setupFee;
  const minDollar = form.minDollar || 0;
  const previewTotal = Math.max(rawTotal, minDollar);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{rule ? 'Edit Rule' : 'Add Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: Form */}
          <div className="flex-1 p-6 space-y-5">
            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type *</label>
              <input
                list="action-types"
                value={form.actionType}
                onChange={(e) => update('actionType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Select or type..."
              />
              <datalist id="action-types">
                {ACTION_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>

            {/* Variation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Variation / Subtype</label>
              {form.actionType === 'BOTTLE' ? (
                <select
                  value={form.variation}
                  onChange={(e) => update('variation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">-- All formats (catch-all) --</option>
                  {BOTTLE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <input
                  value={form.variation}
                  onChange={(e) => update('variation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={variationHint(form.actionType)}
                />
              )}
              <p className="text-xs text-gray-400 mt-1">{variationHint(form.actionType)}</p>
            </div>

            {/* Source Lab (ANALYSIS only) */}
            {form.actionType === 'ANALYSIS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Lab</label>
                <select
                  value={form.analysisSource || ''}
                  onChange={(e) => update('analysisSource', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Any (match all sources)</option>
                  <option value="IN-HOUSE">In House</option>
                  <option value="ETS_MANUAL">ETS Manual</option>
                  <option value="MY_ENOLOGIST">MyEnologist</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Optionally restrict this rule to a specific lab source</p>
              </div>
            )}

            {/* Vessel Type (ADDITION only) */}
            {form.actionType === 'ADDITION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vessel Type</label>
                <select
                  value={form.vesselType || ''}
                  onChange={(e) => update('vesselType', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Any (match all vessel types)</option>
                  <option value="BARREL">BARREL</option>
                  <option value="BIN">BIN</option>
                  <option value="CARBOY">CARBOY</option>
                  <option value="EGG">EGG</option>
                  <option value="KEG">KEG</option>
                  <option value="STEEL_DRUM">STEEL DRUM</option>
                  <option value="TANK">TANK</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Optionally restrict this rule to a specific vessel type</p>
              </div>
            )}

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                value={form.label}
                onChange={(e) => { update('label', e.target.value); setLabelManual(true); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Auto-generated from type + variation"
              />
            </div>

            {/* Billing Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Unit</label>
              <select
                value={form.billingUnit}
                onChange={(e) => update('billingUnit', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Rate + Setup Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.actionType === 'ADDITION' ? 'Rate per Vessel ($)' : 'Rate ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => update('rate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                {form.actionType === 'ADDITION' && (
                  <p className="text-xs text-gray-400 mt-1">Labor charge per vessel (e.g. $2.00)</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setup Fee ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.setupFee}
                  onChange={(e) => update('setupFee', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">One-time fee added per action</p>
              </div>
            </div>

            {/* Bottles Per Case (BOTTLE only) */}
            {form.actionType === 'BOTTLE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bottles Per Case</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.bottlesPerCase || ''}
                  onChange={(e) => update('bottlesPerCase', e.target.value === '' ? undefined : (parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="e.g. 12, 6, 1 (leave blank to match any)"
                />
                <p className="text-xs text-gray-400 mt-1">Match actions with this specific case format. Leave blank to match any bottles-per-case.</p>
              </div>
            )}

            {/* Material Rate (ADDITION only) */}
            {form.actionType === 'ADDITION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Rate ($/unit)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.materialRate || 0}
                  onChange={(e) => update('materialRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Cost per unit of additive product (e.g. $/mL). Total = (vessels x rate) + (quantity x material rate)</p>
              </div>
            )}

            {/* Exclude Tax Classes (ADDITION only) */}
            {form.actionType === 'ADDITION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exclude Tax Classes</label>
                <p className="text-xs text-gray-400 mb-2">Actions on lots with these tax classes will be excluded ($0)</p>
                {(form.excludeTaxClasses?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.excludeTaxClasses!.map((tc) => (
                      <span key={tc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">
                        {tc}
                        <button
                          type="button"
                          onClick={() => update('excludeTaxClasses', form.excludeTaxClasses!.filter((t) => t !== tc))}
                          className="hover:text-red-900"
                        >&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
                  {TAX_CLASSES.map((tc) => (
                    <label key={tc} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                      <input
                        type="checkbox"
                        checked={form.excludeTaxClasses?.includes(tc) || false}
                        onChange={(e) => {
                          const current = form.excludeTaxClasses || [];
                          if (e.target.checked) {
                            update('excludeTaxClasses', [...current, tc]);
                          } else {
                            update('excludeTaxClasses', current.filter((t) => t !== tc));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      {tc}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Exclude All-Inclusive */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.excludeAllInclusive || false}
                  onChange={(e) => update('excludeAllInclusive', e.target.checked || undefined)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Out of Program only</span>
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-6">Only lots tagged "OOP" will be charged; all-inclusive lots matched at $0</p>
            </div>

            {/* Setup Fee Mode (only when setupFee > 0) */}
            {form.setupFee > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setup Fee Mode</label>
                <select
                  value={form.setupFeeMode || 'per_action'}
                  onChange={(e) => update('setupFeeMode', e.target.value as 'per_action' | 'spread_daily')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="per_action">Per action (default)</option>
                  <option value="spread_daily">Spread daily by volume</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {(form.setupFeeMode || 'per_action') === 'spread_daily'
                    ? 'One setup fee per day, split proportionally by drain volume across all matching actions'
                    : 'Setup fee added to each action individually'}
                </p>
              </div>
            )}

            {/* Minimum Dollar Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minDollar || 0}
                onChange={(e) => update('minDollar', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">If the calculated total is below this amount, charge this minimum instead</p>
            </div>

            {/* Min/Max Qty (fruit processing only) */}
            {isFruitType && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Tonnage</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.minQty}
                    onChange={(e) => update('minQty', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Tonnage</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.maxQty === Infinity ? '' : form.maxQty}
                    onChange={(e) => update('maxQty', e.target.value === '' ? Infinity : (parseFloat(e.target.value) || 0))}
                    placeholder="\u221E"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}

            {/* Free first per lot */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.freeFirstPerLot || false}
                onChange={(e) => update('freeFirstPerLot', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">First occurrence per lot is free</span>
            </label>
            {form.freeFirstPerLot && (
              <p className="text-xs text-gray-400 ml-6 -mt-3">The earliest action on each lot is $0; billing starts from the 2nd occurrence</p>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (internal)</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Enabled */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Enabled</span>
            </label>

            {/* Errors / Warnings */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-md text-sm">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}
          </div>

          {/* Right: Live Preview */}
          <div className="lg:w-72 bg-gray-50 p-6 border-t lg:border-t-0 lg:border-l rounded-br-lg">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Live Preview</p>
            <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
              <p className="text-sm text-gray-600">Sample calculation:</p>
              {isAddition ? (
                <>
                  <p className="text-sm font-mono">
                    {sampleVessels} {form.vesselType ? form.vesselType.toLowerCase() + 's' : 'vessels'} &times; ${form.rate.toFixed(2)}
                  </p>
                  {(form.materialRate || 0) > 0 && (
                    <p className="text-sm font-mono">
                      + {sampleQty} units &times; ${(form.materialRate || 0).toFixed(3)} material
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm font-mono">
                  {sampleQty} units &times; ${form.rate.toFixed(2)}
                </p>
              )}
              {form.setupFee > 0 && (
                <p className="text-sm font-mono">
                  + ${form.setupFee.toFixed(2)} setup
                  {(form.setupFeeMode || 'per_action') === 'spread_daily' && (
                    <span className="text-xs text-gray-500"> (spread daily)</span>
                  )}
                </p>
              )}
              {minDollar > 0 && rawTotal < minDollar && (
                <p className="text-xs text-amber-600 font-mono">min ${minDollar.toFixed(2)} applied</p>
              )}
              {form.freeFirstPerLot && (
                <p className="text-xs text-blue-600 font-mono">1st per lot = $0.00</p>
              )}
              <hr className="my-2" />
              <p className="text-lg font-bold text-violet-700">= ${previewTotal.toFixed(2)}</p>
            </div>
            {form.label && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Rule label:</p>
                <p className="text-sm font-medium">{form.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          {!rule && (
            <button onClick={handleSaveAndAdd} className="px-4 py-2 text-sm bg-white border border-violet-300 text-violet-600 rounded-md hover:bg-violet-50">
              Save & Add Another
            </button>
          )}
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
