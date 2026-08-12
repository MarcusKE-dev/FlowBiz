import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = ['Groceries', 'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
const DEFAULTS = { 
  shopName: 'FlowBiz', 
  cashierCanRecordExpenses: true, 
  categories: DEFAULT_CATEGORIES,
  phone: '',
  email: '',
  address: '',
  logoUrl: ''
};

export function useSettings() {
  const { businessId } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading]   = useState(true);

useEffect(() => {
    if (!businessId) { setSettings(DEFAULTS); setLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'businessSettings', businessId),
      // BUG FIX (Issue 19): businessId was never included in the returned
      // settings object, so documentService.js's sendWhatsAppDocument was
      // always sending businessId: undefined to the server.
      snap => { setSettings(snap.exists() ? { ...DEFAULTS, ...snap.data(), businessId } : { ...DEFAULTS, businessId }); setLoading(false); },
      () => { setSettings({ ...DEFAULTS, businessId }); setLoading(false); }
    );
    return unsub;
  }, [businessId]);

  return { settings, loading };
}