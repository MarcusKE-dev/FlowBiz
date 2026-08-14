import { collection, doc, writeBatch, updateDoc, deleteField, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { raceWithTimeout } from './offlineWrite';

function barcodeIndexRef(businessId, barcode) {
  return doc(db, 'barcodeIndex', `${businessId}__${barcode}`);
}

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

export async function createProduct(data, businessId) {
  if (!businessId) throw new Error('createProduct() called with no businessId');
  const barcode = data.barcode ? String(data.barcode).trim() : null;
  const newProductRef = doc(collection(db, 'products'));
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

  const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
  if (error) throw error;

  return { id: newProductRef.id, queuedOffline };
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

  const { queuedOffline, error } = await raceWithTimeout(batch.commit(), 4000);
  if (error) throw error;

  return { queuedOffline };
}

// FIX: archiving now also removes the barcode from barcodeIndex —
// previously only a *permanent* delete did this, so an archived product
// silently kept its barcode "reserved" behind the scenes.
export async function softDeleteProduct(productId, barcode, businessId) {
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  const batch = writeBatch(db);
  batch.update(productRef, { deleted: true, deletedAt: serverTimestamp() });

  if (trimmedBarcode && businessId) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists() && idxSnap.data().productId === productId) {
      batch.delete(idxRef);
    }
  }

  await batch.commit();
}

// Restoring re-creates the barcode index entry — unless another product
// has since claimed that exact barcode while this one was archived, in
// which case we restore the product but clear its barcode rather than
// silently taking over the other product's index entry.
export async function restoreProduct(productId, barcode, businessId) {
  const productRef = doc(db, 'products', productId);
  const trimmedBarcode = barcode ? String(barcode).trim() : null;

  if (trimmedBarcode && businessId) {
    const idxRef = barcodeIndexRef(businessId, trimmedBarcode);
    const idxSnap = await getDoc(idxRef);
    if (idxSnap.exists()) {
      if (idxSnap.data().productId !== productId) {
        await updateDoc(productRef, { deleted: false, deletedAt: deleteField(), barcode: null });
        return { barcodeCleared: true };
      }
      // Already correctly indexed to this same product — nothing to do.
    } else {
      await setDoc(idxRef, { businessId, barcode: trimmedBarcode, productId });
    }
  }

  await updateDoc(productRef, { deleted: false, deletedAt: deleteField() });
  return { barcodeCleared: false };
}