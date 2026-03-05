import React, { useState, useEffect, useCallback } from 'react';
import SettingsPanel from './components/SettingsPanel';
import BillingControls, { BillingRunState, defaultBillingRunState } from './components/BillingControls';
import RateTableManager from './components/RateTableManager';
import FruitIntakePage from './components/FruitIntakePage';
import BillableAddOnsPage from './components/BillableAddOnsPage';
import { getSettings, RateRule, AppConfig } from './api/client';

type Page = 'billing' | 'rate-table' | 'fruit-intake' | 'add-ons' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('billing');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [hasSettings, setHasSettings] = useState(false);
  const [billingState, setBillingState] = useState<BillingRunState | null>(null);

  const loadConfig = useCallback(() => {
    getSettings()
      .then((c) => {
        setConfig(c);
        setHasSettings(c.hasToken && !!c.wineryId);
        setBillingState((prev) =>
          prev ? prev : defaultBillingRunState(c.lastUsedMonth, c.lastUsedYear)
        );
      })
      .catch(() => {
        setHasSettings(false);
      });
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleRulesChange = (rules: RateRule[]) => {
    setConfig((prev) => prev ? { ...prev, rateRules: rules } : prev);
  };

  const handleCustomerMapChange = (map: Record<string, string>) => {
    setConfig((prev) => prev ? { ...prev, customerMap: map } : prev);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-56 bg-slate-800 text-white flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-tight">InnoVint</h1>
          <p className="text-xs text-slate-400">Billing Engine</p>
        </div>
        <div className="flex-1 py-4">
          <NavItem label="Billing" active={page === 'billing'} onClick={() => setPage('billing')} />
          <NavItem
            label="Rate Table"
            active={page === 'rate-table'}
            onClick={() => setPage('rate-table')}
            badge={config?.rateRules.length ? String(config.rateRules.length) : undefined}
          />
          <NavItem
            label="Fruit Intake"
            active={page === 'fruit-intake'}
            onClick={() => setPage('fruit-intake')}
          />
          <NavItem
            label="Add-Ons"
            active={page === 'add-ons'}
            onClick={() => setPage('add-ons')}
          />
          <NavItem
            label="Settings"
            active={page === 'settings'}
            onClick={() => setPage('settings')}
            badge={!hasSettings ? '!' : undefined}
          />
        </div>
        <div className="px-4 py-3 border-t border-slate-700">
          <p className="text-xs text-slate-500">v1.0.0</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        {page === 'settings' && (
          <SettingsPanel onSettingsSaved={loadConfig} />
        )}
        {page === 'billing' && config && billingState && (
          <BillingControls
            hasSettings={hasSettings}
            rateRules={config.rateRules}
            billingState={billingState}
            onBillingStateChange={(updater) =>
              setBillingState((prev) => {
                if (!prev) return prev;
                return typeof updater === 'function' ? updater(prev) : updater;
              })
            }
            onNavigate={(p) => setPage(p as Page)}
          />
        )}
        {page === 'rate-table' && config && (
          <RateTableManager
            rules={config.rateRules}
            onRulesChange={handleRulesChange}
          />
        )}
        {page === 'fruit-intake' && config && (
          <FruitIntakePage
            customerMap={config.customerMap || {}}
            onCustomerMapChange={handleCustomerMapChange}
          />
        )}
        {page === 'add-ons' && config && (
          <BillableAddOnsPage
            rateRules={config.rateRules}
            ownerCodes={[...new Set(Object.values(config.customerMap || {}))].sort()}
          />
        )}
        {!config && (
          <div className="text-gray-400 text-sm">Loading configuration...</div>
        )}
      </main>
    </div>
  );
}

function NavItem({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
        active
          ? 'bg-slate-700 text-white border-l-2 border-blue-400'
          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white border-l-2 border-transparent'
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${badge === '!' ? 'bg-amber-500' : 'bg-slate-600'} text-white`}>
          {badge}
        </span>
      )}
    </button>
  );
}
