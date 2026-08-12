import { collection, doc, writeBatch, updateDoc, deleteField, serverTimestamp, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export async function permanentlyDeleteProduct(productId, barcode, businessId) {
  if (!businessId) throw new Error('permanentlyDeleteProduct() called with no businessId');
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  const batch = writeBatch(db);
  if (trimmedBarcode) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists() && idxSnap.data().productId === productId) {
      batch.delete(idxRef);
    }
  }
  batch.delete(productRef);
  await batch.commit();
}

export async function cleanupOrphanedBarcodeIndexes(businessId) {
  if (!businessId) throw new Error('cleanupOrphanedBarcodeIndexes() called with no businessId');
  const snap = await getDocs(query(collection(db, 'barcodeIndex'), where('businessId', '==', businessId)));
  let removed = 0;
  for (const idxDoc of snap.docs) {
    const { productId } = idxDoc.data();
    if (!productId) continue;
    const productSnap = await getDoc(doc(db, 'products', productId));
    if (!productSnap.exists()) {
      await deleteDoc(idxDoc.ref);
      removed += 1;
    }
  }
  return { scanned: snap.docs.length, removed };
}

function barcodeIndexRef(businessId, barcode) {
  return doc(db, 'barcodeIndex', `${businessId}__${barcode}`);
}

// FIX: Offline-safe product creation using writeBatch and generated internalCode
export async function createProduct(data, businessId) {
  if (!businessId) throw new Error('createProduct() called with no businessId');
  const barcode = data.barcode ? String(data.barcode).trim() : null;
  const newProductRef = doc(collection(db, 'products'));

  // Offline-safe code generation
  const internalCode = `FB-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
  
  const batch = writeBatch(db);
  batch.set(newProductRef, {
    ...data,
    businessId,
    barcode: barcode || null,
    internalCode,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (barcode) {
    batch.set(barcodeIndexRef(businessId, barcode), { businessId, barcode, productId: newProductRef.id });
  }
  await batch.commit();

  return { id: newProductRef.id };
}

export async function updateProduct(productId, data, previousBarcode, businessId) {
  if (!businessId) throw new Error('updateProduct() called with no businessId');
  const nextBarcode = data.barcode ? String(data.barcode).trim() : null;
  const prevBarcode = previousBarcode ? String(previousBarcode).trim() : null;
  const productRef = doc(db, 'products', productId);

  const { stock, businessId: _ignored, ...updatePayload } = data;

  const batch = writeBatch(db);
  batch.update(productRef, { ...updatePayload, barcode: nextBarcode || null, updatedAt: serverTimestamp() });
  
  if (prevBarcode && prevBarcode !== nextBarcode) {
    batch.delete(barcodeIndexRef(businessId, prevBarcode));
  }
  if (nextBarcode && nextBarcode !== prevBarcode) {
    batch.set(barcodeIndexRef(businessId, nextBarcode), { businessId, barcode: nextBarcode, productId });
  }
  await batch.commit();
}

export async function softDeleteProduct(productId) {
  await updateDoc(doc(db, 'products', productId), { deleted: true, deletedAt: serverTimestamp() });
}

export async function restoreProduct(productId) {
  await updateDoc(doc(db, 'products', productId), { deleted: false, deletedAt: deleteField() });
}