// src/utils/businessReset.js
import { collection, query, where, getDocs, writeBatch, doc, setDoc, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

// Every tenant-scoped collection, because a reset that leaves some behind
// is worse than no reset: the leftovers point at products that no longer
// exist. `orders`, `productions` and `productBatches` were missing, so a
// restaurant kept its open tickets, a bakery its production runs and a
// pharmacy its batch and expiry ledger through a "delete everything".
// Keep in step with EXPORT_COLLECTIONS and IMPORT_COLLECTIONS.
const RESET_COLLECTIONS = [
  'products', 'sales', 'customers', 'suppliers', 'creditSales', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'barcodeIndex', 'refunds', 'productImages',
  'debtPaymentReceipts', 'sharedDocuments', 'staffInvites', 'sessions',
  'orders', 'productions', 'productBatches',
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
      // Clearing the list, not replacing it with a shop's: with no stored
      // categories the industry layer hands the business its own trade's
      // starting list again, so a pharmacy resets to pharmacy categories
      // rather than to a general shop's. The business type itself is
      // untouched — a reset empties a business, it does not re-found it.
      cashierCanRecordExpenses: true, receiptPaperWidth: 80,
      // Clearing BOTH halves of the category model: the legacy full list
      // and the diff-against-the-trade that replaced it. With nothing
      // stored the industry layer hands the business its own trade's
      // starting list again.
      categories: null, customCategories: [], hiddenCategories: [], categoryOrder: [],
      // The expense list is stored the same way and is cleared the same
      // way, so a reset business is offered FlowBiz's own list again.
      customExpenseCategories: [], hiddenExpenseCategories: [], expenseCategoryOrder: [],
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