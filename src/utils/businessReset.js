import { collection, query, where, getDocs, writeBatch, doc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';

// FIX: added 'staffInvites' — a Business Reset previously left old
// pending invite links valid indefinitely, even after everything else
// about the business had been wiped.
const RESET_COLLECTIONS = [
  'products', 'sales', 'customers', 'suppliers', 'creditSales', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'barcodeIndex', 'productCodeCounters', 'refunds',
  'staffInvites',
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
  }
  return totalDeleted;
}

export async function resetBusinessData(businessId, ownerUid) {
  if (!businessId) throw new Error('resetBusinessData() called with no businessId');
  const results = {};

  for (const name of RESET_COLLECTIONS) {
    results[name] = await deleteTenantCollection(name, businessId);
  }

  await deleteDoc(doc(db, 'businessSettings', businessId));
  results.businessSettings = 1;
  results.performedBy = ownerUid || null;

  return results;
}