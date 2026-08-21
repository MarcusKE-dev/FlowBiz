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
  'Groceries', 'Beverages', 'Hardware', 'Household',
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

  // 1. Delete all operational records across all store collections
  for (const name of RESET_COLLECTIONS) {
    try {
      results[name] = await deleteTenantCollection(name, businessId);
    } catch (err) {
      console.warn(`[Reset] Collection ${name} cleanup skipped:`, err.message);
      results[name] = 0;
    }
  }

  // 2. MODEL 2: Delete Cashier Accounts completely (Firestore + Auth API)
  try {
    const cashiersSnap = await getDocs(query(
      collection(db, 'users'),
      where('businessId', '==', businessId),
      where('role', '==', 'cashier')
    ));

    const idToken = auth.currentUser ? await auth.currentUser.getIdToken(true) : null;

    for (const cashierDoc of cashiersSnap.docs) {
      const cashierUid = cashierDoc.id;

      // Delete from Firebase Auth via Cloudflare Worker API
      if (idToken) {
        try {
          await fetch(`${FLOWBIZ_API_URL}/api/auth/delete-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ targetUid: cashierUid }),
          });
        } catch (authErr) {
          console.warn(`[Reset] Cashier auth delete error for ${cashierUid}:`, authErr);
        }
      }

      // Delete from Firestore users collection
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', cashierUid));
      await batch.commit();
    }
  } catch (cashierErr) {
    console.warn('[Reset] Cashier cleanup error:', cashierErr);
  }

  // 3. Reset business settings cleanly to defaults without deleting the doc
await setDoc(doc(db, 'businessSettings', businessId), {
  shopName: 'FlowBiz Store',
  phone: '',
  email: '',
  address: '',
  logoUrl: '',
  cashierCanRecordExpenses: true,
  categories: DEFAULT_CATEGORIES,
  receiptPaperWidth: 80,
  resetAt: new Date(),
  resetBy: ownerUid || null,
}, { merge: true });

  results.businessSettings = 1;
  results.performedBy = ownerUid || null;

  return results;
}