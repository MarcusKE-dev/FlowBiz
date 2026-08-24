import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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

export function useSettings() {
  const { businessId } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'businessSettings', businessId),
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

  return { settings, loading };
}