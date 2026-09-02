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
import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const DEFAULT_CATEGORIES = [
  'Beverages',
  'Hardware',
  'Household',
  'Personal Care',
  'Stationery',
  'Airtime/Float',
  'Other',
];

const DEFAULTS = {
  shopName: 'FlowBiz',
  cashierCanRecordExpenses: true,
  categories: DEFAULT_CATEGORIES,
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
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
          const data = snap.data();
          const rawCategories = Array.isArray(data.categories) ? data.categories : DEFAULT_CATEGORIES;
          const cleanedCategories = rawCategories.filter(
            (c) => c && c.trim().toLowerCase() !== 'groceries'
          );
          setSettings({
            ...DEFAULTS,
            ...data,
            categories: cleanedCategories.length > 0 ? cleanedCategories : DEFAULT_CATEGORIES,
            businessId,
          });
        } else {
          setSettings({ ...DEFAULTS, businessId });
          // Self-heal: a business with no settings doc yet should still
          // have a persisted category list the next time anything reads
          // or writes it, same as ProductFormModal used to do on its own.
          setDoc(ref, { categories: DEFAULT_CATEGORIES }, { merge: true }).catch(() => {});
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

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
