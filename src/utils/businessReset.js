// src/utils/businessReset.js
import { collection, query, where, getDocs, writeBatch, doc, setDoc, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const RESET_COLLECTIONS = [
  'products', 'sales', 'customers', 'suppliers', 'creditSales', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'barcodeIndex', 'refunds',
  'debtPaymentReceipts', 'sharedDocuments', 'staffInvites', 'sessions',
];

const DEFAULT_CATEGORIES = [
'Beverages', 'Hardware', 'Household',
  'Personal Care', 'Stationery', 'Airtime/Float', 'Other'
];

async function deleteTenantCollection(name, businessId, chunkSize = 400) {
  let totalDeleted = 0;
  while (true) {
    const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(chunkSize)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;
    if (snap.docs.length < chunkSize) break;
  }
  return totalDeleted;
}

export async function resetBusinessData(businessId, ownerUid) {
  if (!businessId) throw new Error('resetBusinessData() called with no businessId');
  const results = {};
  const failures = [];

  for (const name of RESET_COLLECTIONS) {
    try {
      results[name] = await deleteTenantCollection(name, businessId);
    } catch (err) {
      console.error(`[Reset] Collection ${name} cleanup FAILED:`, err);
      results[name] = 0;
      failures.push(`${name} (${err.message || 'unknown error'})`);
    }
  }

  try {
    const cashiersSnap = await getDocs(query(
      collection(db, 'users'), where('businessId', '==', businessId), where('role', '==', 'cashier')
    ));
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : null;

    for (const cashierDoc of cashiersSnap.docs) {
      const cashierUid = cashierDoc.id;
      if (idToken) {
        try {
          const res = await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ targetUid: cashierUid }),
          });
          if (!res.ok) failures.push(`cashier auth delete for ${cashierUid} (status ${res.status})`);
        } catch (authErr) {
          failures.push(`cashier auth delete for ${cashierUid} (${authErr.message})`);
        }
      }
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', cashierUid));
        await batch.commit();
      } catch (docErr) {
        failures.push(`cashier profile delete for ${cashierUid} (${docErr.message})`);
      }
    }
  } catch (cashierErr) {
    failures.push(`cashier cleanup (${cashierErr.message})`);
  }

  try {
    await setDoc(doc(db, 'businessSettings', businessId), {
      shopName: 'FlowBiz Store', phone: '', email: '', address: '', logoUrl: '',
      cashierCanRecordExpenses: true, categories: DEFAULT_CATEGORIES, receiptPaperWidth: 80,
      resetAt: new Date(), resetBy: ownerUid || null,
    }, { merge: true });
    results.businessSettings = 1;
  } catch (settingsErr) {
    failures.push(`businessSettings reset (${settingsErr.message})`);
  }

  results.performedBy = ownerUid || null;

  if (failures.length > 0) {
    const err = new Error(`Reset finished, but some data may not have been fully cleared: ${failures.join('; ')}`);
    err.partialResults = results;
    throw err;
  }

  return results;
}