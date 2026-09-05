// src/contexts/SettingsContext.jsx
//
// Single shared businessSettings/{businessId} listener for the whole app.
// Previously every consumer (Sidebar, BottomNav, MobileMoreDrawer, Counter,
// Customers, Expenses, Reports, SaleCompleteModal, DebtPaymentReceiptModal,
// ProductFormModal — up to 5+ mounted at once, since Sidebar/BottomNav are
// both always mounted in AppShell and merely CSS-hidden per breakpoint)
// called the useSettings() hook, and each call opened its own independent
// onSnapshot listener on the exact same document. This context opens that
// listener once per signed-in business and every consumer reads from it.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { resolveIndustryConfig } from '../industry/config';

const DEFAULTS = {
  shopName: 'FlowBiz',
  cashierCanRecordExpenses: true,
  // The business's OWN category list, exactly as stored, or null when it
  // has never saved one. It is deliberately not defaulted here: which
  // categories a business starts with depends on its trade, and that
  // question is answered once, in the industry layer, as
  // `industry.categories`. Nothing should read this field directly.
  categories: null,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
  // Industry configuration. Absent on every business that predates it,
  // which is exactly why the resolver treats absent as General Retail
  // with nothing switched on — see industry/config.js.
  industryProfile: null,
  capabilityOverrides: {},
  tables: [],
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { businessId } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, 'businessSettings', businessId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULTS, ...snap.data(), businessId });
        } else {
          // No document is a valid state, not a fault to heal: the
          // industry layer resolves a complete configuration — categories
          // included — from nothing at all, so there is nothing to write
          // and nothing to guess at on the business's behalf.
          setSettings({ ...DEFAULTS, businessId });
        }
        setLoading(false);
      },
      () => {
        setSettings({ ...DEFAULTS, businessId });
        setLoading(false);
      }
    );
    return unsub;
  }, [businessId]);

  // The effective industry configuration. Derived, never fetched: the
  // profile table is static code and the overrides ride on the settings
  // document this context already listens to, so exposing this costs
  // exactly zero additional Firestore reads and zero extra listeners.
  // Memoised on the settings snapshot so every consumer shares one object
  // and nothing re-renders because a resolver ran again.
  const industry = useMemo(() => resolveIndustryConfig(settings), [settings]);

  const value = useMemo(() => ({ settings, loading, industry }), [settings, loading, industry]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
