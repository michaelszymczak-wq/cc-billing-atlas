import React, { useState, useEffect } from 'react';
import {
  getSettings, saveSettings, saveBarrelSnapshots, BarrelSnapshots,
  FruitIntakeSettings, saveFruitIntakeSettings,
} from '../api/client';

interface SettingsPanelProps {
  onSettingsSaved: () => void;
}

export default function SettingsPanel({ onSettingsSaved }: SettingsPanelProps) {
  const [token, setToken] = useState('');
  const [wineryId, setWineryId] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [barrelSnapshots, setBarrelSnapshots] = useState<BarrelSnapshots>({ snap1Day: 1, snap2Day: 15, snap3Day: 'last', barrelRate: 0, puncheonRate: 0, tirageRate: 0 });
  const [bulkStorageRate, setBulkStorageRate] = useState<number>(0);
  const [bulkStorageMinimum, setBulkStorageMinimum] = useState<number>(0);
  const [snapStatus, setSnapStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [fruitSettings, setFruitSettings] = useState<FruitIntakeSettings>({
    actionTypeKey: 'FRUITINTAKE',
    vintageLookback: 3,
    apiPageDelaySeconds: 5,
    programs: [],
    minProcessingFee: 1000,
    defaultContractMonths: 9,
    smallLotFee: 1000,
    smallLotThresholdTons: 2.0,
  });
  const [fruitStatus, setFruitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    getSettings()
      .then((s) => {
        setToken(s.token);
        setWineryId(s.wineryId);
        setHasToken(s.hasToken);
        if (s.barrelSnapshots) setBarrelSnapshots(s.barrelSnapshots);
        if (s.bulkStorageRate !== undefined) setBulkStorageRate(s.bulkStorageRate);
        if (s.bulkStorageMinimum !== undefined) setBulkStorageMinimum(s.bulkStorageMinimum);
        if (s.fruitIntakeSettings) setFruitSettings(s.fruitIntakeSettings);
      })
      .catch(() => {
        // Settings not found yet
      });
  }, []);

  const handleSave = async () => {
    setStatus('saving');
    setErrorMsg('');
    try {
      await saveSettings({ token, wineryId });
      setStatus('success');
      setHasToken(true);
      onSettingsSaved();
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure your API credentials. These are stored locally on your machine.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Token saved (enter new to replace)' : 'Enter your InnoVint access token'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Winery ID
          </label>
          <input
            type="text"
            value={wineryId}
            onChange={(e) => setWineryId(e.target.value)}
            placeholder="e.g. 12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>

        {status === 'success' && (
          <p className="text-sm text-green-600">Settings saved successfully.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
      </div>

      {/* Bulk Storage Rate */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Bulk Storage Rate</h3>
        <p className="text-sm text-gray-500 mb-4">
          Rate per gallon charged for bulk wine storage. Applied to 3-snapshot billing.
        </p>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($/gal)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={bulkStorageRate}
            onChange={(e) => setBulkStorageRate(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Minimum charge ($)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={bulkStorageMinimum}
            onChange={(e) => setBulkStorageMinimum(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            onClick={async () => {
              setStatus('saving');
              try {
                await saveSettings({ bulkStorageRate, bulkStorageMinimum });
                setStatus('success');
                setTimeout(() => setStatus('idle'), 2000);
              } catch {
                setStatus('error');
                setErrorMsg('Failed to save bulk storage rate');
              }
            }}
            disabled={status === 'saving'}
            className="mt-2 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {status === 'saving' ? 'Saving...' : 'Save Bulk Storage Rate'}
          </button>
        </div>
      </div>

      {/* Barrel Inventory Snapshots */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Barrel Inventory Snapshots</h3>
        <p className="text-sm text-gray-500 mb-4">
          Three vessel inventory exports are taken per month to calculate average empty barrel counts.
          Set the day-of-month for each snapshot.
        </p>
        <div className="space-y-3 max-w-xs">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 1 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap1Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap1Day: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 2 Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={barrelSnapshots.snap2Day}
              onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, snap2Day: parseInt(e.target.value) || 15 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Snapshot 3 Day</label>
            <select
              value={barrelSnapshots.snap3Day === 'last' ? 'last' : String(barrelSnapshots.snap3Day)}
              onChange={(e) => setBarrelSnapshots((prev) => ({
                ...prev,
                snap3Day: e.target.value === 'last' ? 'last' : parseInt(e.target.value),
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="last">Last day of month</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <p className="text-sm font-medium text-gray-700 mt-4 mb-2">Empty Barrel Rates ($/barrel/month)</p>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Barrel (Standard)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={barrelSnapshots.barrelRate}
                onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, barrelRate: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Barrel (Puncheon)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={barrelSnapshots.puncheonRate}
                onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, puncheonRate: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tirage</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={barrelSnapshots.tirageRate}
                onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, tirageRate: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={barrelSnapshots.skipCurrentYearBarrels ?? false}
                onChange={(e) => setBarrelSnapshots((prev) => ({ ...prev, skipCurrentYearBarrels: e.target.checked }))}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              Skip barrels whose "Year First Used" equals the billing year
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">
              When enabled, barrels first used in the current billing year are excluded from empty barrel charges.
            </p>
          </div>
          <button
            onClick={async () => {
              setSnapStatus('saving');
              try {
                await saveBarrelSnapshots(barrelSnapshots);
                setSnapStatus('success');
                setTimeout(() => setSnapStatus('idle'), 2000);
              } catch {
                setSnapStatus('error');
              }
            }}
            disabled={snapStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {snapStatus === 'saving' ? 'Saving...' : 'Save Snapshot Settings'}
          </button>
          {snapStatus === 'success' && <p className="text-sm text-green-600">Snapshot settings saved.</p>}
          {snapStatus === 'error' && <p className="text-sm text-red-600">Failed to save snapshot settings.</p>}
        </div>
      </div>

      {/* Fruit Intake Settings */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h3 className="text-base font-semibold mb-2">Fruit Intake</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure fruit intake API settings and contract length rules.
        </p>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type Key</label>
            <input
              type="text"
              value={fruitSettings.actionTypeKey}
              onChange={(e) => setFruitSettings((p) => ({ ...p, actionTypeKey: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vintage Lookback</label>
              <input
                type="number"
                min={1}
                max={5}
                value={fruitSettings.vintageLookback}
                onChange={(e) => setFruitSettings((p) => ({ ...p, vintageLookback: parseInt(e.target.value) || 3 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Page Delay (s)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={fruitSettings.apiPageDelaySeconds}
                onChange={(e) => setFruitSettings((p) => ({ ...p, apiPageDelaySeconds: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Programs */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Programs (rate per ton by lot tag)</p>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_120px_auto] gap-2 text-xs font-medium text-gray-500 uppercase">
                <span>Name</span>
                <span>Description</span>
                <span>Rate/Ton ($)</span>
                <span></span>
              </div>
              {(fruitSettings.programs || []).map((prog, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2">
                  <input
                    type="text"
                    value={prog.name}
                    onChange={(e) => {
                      const programs = [...(fruitSettings.programs || [])];
                      programs[idx] = { ...programs[idx], name: e.target.value };
                      setFruitSettings((p) => ({ ...p, programs }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="e.g. Program #1"
                  />
                  <input
                    type="text"
                    value={prog.description}
                    onChange={(e) => {
                      const programs = [...(fruitSettings.programs || [])];
                      programs[idx] = { ...programs[idx], description: e.target.value };
                      setFruitSettings((p) => ({ ...p, programs }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="e.g. Red Wine"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={prog.ratePerTon}
                    onChange={(e) => {
                      const programs = [...(fruitSettings.programs || [])];
                      programs[idx] = { ...programs[idx], ratePerTon: parseFloat(e.target.value) || 0 };
                      setFruitSettings((p) => ({ ...p, programs }));
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    onClick={() => {
                      const programs = (fruitSettings.programs || []).filter((_, i) => i !== idx);
                      setFruitSettings((p) => ({ ...p, programs }));
                    }}
                    className="px-2 text-red-500 hover:text-red-700 text-sm"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  setFruitSettings((p) => ({
                    ...p,
                    programs: [...(p.programs || []), { id, name: '', description: '', ratePerTon: 0 }],
                  }));
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Program
              </button>
            </div>
          </div>

          {/* Min Processing Fee & Default Contract Months */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Processing Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={fruitSettings.minProcessingFee ?? 1000}
                onChange={(e) => setFruitSettings((p) => ({ ...p, minProcessingFee: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Contract Length (months)</label>
              <input
                type="number"
                min={1}
                value={fruitSettings.defaultContractMonths ?? 9}
                onChange={(e) => setFruitSettings((p) => ({ ...p, defaultContractMonths: parseInt(e.target.value) || 9 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Small Lot Fee */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Small Lot Fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={fruitSettings.smallLotFee ?? 1000}
                onChange={(e) => setFruitSettings((p) => ({ ...p, smallLotFee: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Small Lot Threshold (tons)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={fruitSettings.smallLotThresholdTons ?? 2.0}
                onChange={(e) => setFruitSettings((p) => ({ ...p, smallLotThresholdTons: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <button
            onClick={async () => {
              setFruitStatus('saving');
              try {
                await saveFruitIntakeSettings(fruitSettings);
                setFruitStatus('success');
                setTimeout(() => setFruitStatus('idle'), 2000);
              } catch {
                setFruitStatus('error');
              }
            }}
            disabled={fruitStatus === 'saving'}
            className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {fruitStatus === 'saving' ? 'Saving...' : 'Save Fruit Intake Settings'}
          </button>
          {fruitStatus === 'success' && <p className="text-sm text-green-600">Fruit intake settings saved.</p>}
          {fruitStatus === 'error' && <p className="text-sm text-red-600">Failed to save fruit intake settings.</p>}
        </div>
      </div>
    </div>
  );
}
