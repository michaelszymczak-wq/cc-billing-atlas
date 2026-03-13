import React, { useState, useEffect, useCallback } from 'react';
import SettingsPanel from './components/SettingsPanel';
import BillingControls, { BillingRunState, defaultBillingRunState } from './components/BillingControls';
import RateTableManager from './components/RateTableManager';
import FruitIntakePage from './components/FruitIntakePage';
import BillableAddOnsPage from './components/BillableAddOnsPage';
import CustomersPage from './components/CustomersPage';
import InvoiceExportPage from './components/InvoiceExportPage';
import LoginPage from './components/LoginPage';
import UserManagement from './components/UserManagement';
import { getSettings, RateRule, AppConfig, CustomerRecord, setTokenGetter } from './api/client';
import { useAuth, UserRole } from './auth/AuthContext';

type Page = 'billing' | 'rate-table' | 'fruit-intake' | 'add-ons' | 'customers' | 'invoices' | 'settings' | 'users';

export default function App() {
  const { user, role, loading: authLoading, error: authError, logout, getToken } = useAuth();
  const [page, setPage] = useState<Page>('billing');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [hasSettings, setHasSettings] = useState(false);
  const [billingState, setBillingState] = useState<BillingRunState | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Wire token getter for API client
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Redirect cellar users to add-ons
  useEffect(() => {
    if (role === 'cellar' && page !== 'add-ons') {
      setPage('add-ons');
    }
  }, [role, page]);

  const loadConfig = useCallback(() => {
    if (!user || !role) return;
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
  }, [user, role]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Show loading spinner during auth init
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user || !role) {
    return <LoginPage />;
  }

  const handleRulesChange = (rules: RateRule[]) => {
    setConfig((prev) => prev ? { ...prev, rateRules: rules } : prev);
  };

  const handleCustomersChange = (customers: CustomerRecord[]) => {
    setConfig((prev) => prev ? { ...prev, customers } : prev);
  };

  const navigateTo = (p: Page) => {
    setPage(p);
    setMobileMenuOpen(false);
  };

  const canSee = (p: Page): boolean => {
    if (role === 'cellar') return p === 'add-ons';
    if (p === 'users') return role === 'admin';
    return true;
  };

  const navItems = (
    <>
      {canSee('billing') && (
        <NavItem label="Billing" active={page === 'billing'} onClick={() => navigateTo('billing')} />
      )}
      {canSee('rate-table') && (
        <NavItem
          label="Rate Table"
          active={page === 'rate-table'}
          onClick={() => navigateTo('rate-table')}
          badge={config?.rateRules.length ? String(config.rateRules.length) : undefined}
        />
      )}
      {canSee('fruit-intake') && (
        <NavItem
          label="Fruit Intake"
          active={page === 'fruit-intake'}
          onClick={() => navigateTo('fruit-intake')}
        />
      )}
      <NavItem
        label="Add-Ons"
        active={page === 'add-ons'}
        onClick={() => navigateTo('add-ons')}
      />
      {canSee('customers') && (
        <NavItem
          label="Customers"
          active={page === 'customers'}
          onClick={() => navigateTo('customers')}
          badge={config?.customers.length ? String(config.customers.length) : undefined}
        />
      )}
      {canSee('invoices') && (
        <NavItem
          label="Invoices"
          active={page === 'invoices'}
          onClick={() => navigateTo('invoices')}
        />
      )}
      {canSee('settings') && (
        <NavItem
          label="Settings"
          active={page === 'settings'}
          onClick={() => navigateTo('settings')}
          badge={!hasSettings ? '!' : undefined}
        />
      )}
      {canSee('users') && (
        <NavItem
          label="Users"
          active={page === 'users'}
          onClick={() => navigateTo('users')}
        />
      )}
    </>
  );

  const userFooter = (
    <div className="px-4 py-3 border-t border-indigo-700">
      <p className="text-xs text-indigo-300 truncate">{user.email}</p>
      <button
        onClick={logout}
        className="mt-1 text-xs text-indigo-400 hover:text-white transition-colors"
      >
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-indigo-900 text-white flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Opal Moon</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded hover:bg-indigo-800"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile slide-out menu */}
      <nav className={`md:hidden fixed top-[52px] left-0 bottom-0 z-20 w-64 bg-indigo-900 text-white flex flex-col transform transition-transform duration-200 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 py-4">
          {navItems}
        </div>
        {userFooter}
      </nav>

      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 bg-indigo-900 text-white flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-indigo-700">
          <h1 className="text-lg font-bold tracking-tight">Opal Moon</h1>
          <p className="text-xs text-indigo-300">Billing</p>
        </div>
        <div className="flex-1 py-4">
          {navItems}
        </div>
        {userFooter}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-8 md:pt-8">
        {page === 'settings' && canSee('settings') && (
          <SettingsPanel onSettingsSaved={loadConfig} />
        )}
        {page === 'billing' && canSee('billing') && config && billingState && (
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
        {page === 'rate-table' && canSee('rate-table') && config && (
          <RateTableManager
            rules={config.rateRules}
            onRulesChange={handleRulesChange}
          />
        )}
        {page === 'fruit-intake' && canSee('fruit-intake') && config && (
          <FruitIntakePage
            customerMap={Object.fromEntries(
              (config.customers || []).filter(c => c.ownerName && c.code).map(c => [c.ownerName, c.code])
            )}
          />
        )}
        {page === 'add-ons' && config && (
          <BillableAddOnsPage
            rateRules={config.rateRules}
            ownerCodes={(config.customers || []).map(c => c.code).filter(Boolean).sort()}
            role={role}
          />
        )}
        {page === 'customers' && canSee('customers') && config && (
          <CustomersPage
            customers={config.customers || []}
            onCustomersChange={handleCustomersChange}
          />
        )}
        {page === 'invoices' && canSee('invoices') && config && (
          <InvoiceExportPage config={config} billingState={billingState} />
        )}
        {page === 'users' && canSee('users') && (
          <UserManagement />
        )}
        {!config && page !== 'users' && (
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
          ? 'bg-indigo-800 text-white border-l-2 border-violet-400'
          : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white border-l-2 border-transparent'
      }`}
    >
      <span>{label}</span>
      {badge && (
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${badge === '!' ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
          {badge}
        </span>
      )}
    </button>
  );
}
