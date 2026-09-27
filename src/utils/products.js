import { collection, doc, writeBatch, updateDoc, deleteField, serverTimestamp, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { raceWithTimeout } from './offlineWrite';
import { PRODUCT_IMAGES, productImageDocId, forgetProductImage } from './productImages';

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

  // The photo lives in its own document, so a permanent delete has to
  // take it too or it is orphaned forever. Existence is checked first
  // for the same reason the barcode index above is: the delete rule
  // reads `resource.data.businessId`, which does not exist for a
  // document that was never there, and that denial would reject the
  // whole batch — including the product delete the user asked for.
  const imageRef = doc(db, PRODUCT_IMAGES, productImageDocId(businessId, productId));
  const imageSnap = await getDoc(imageRef);
  if (imageSnap.exists()) batch.delete(imageRef);

  batch.delete(productRef);
  await batch.commit();
  forgetProductImage(businessId, productId);
}

export async function createProduct(data, businessId) {
  if (!businessId) throw new Error('createProduct() called with no businessId');
  const barcode = data.barcode ? String(data.barcode).trim() : null;
  const newProductRef = doc(collection(db, 'products'));
  // Derived from the document's own random id rather than the clock. The
  // last six digits of the current second gave two products created in
  // the same second — an import, a fast owner, two tills — the SAME code,
  // and a scan of it sold whichever the catalogue listed first. The id is
  // minted on the device, so this stays unique offline too.
  const internalCode = internalCodeFor(newProductRef.id);

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

/** A product's internal scan code: FB- and eight characters of its id. */
export function internalCodeFor(productId) {
  const cleaned = String(productId || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `FB-${cleaned.slice(0, 8).padEnd(8, '0')}`;
}

export async function updateProduct(productId, data, previousBarcode, businessId) {
  if (!businessId) throw new Error('updateProduct() called with no businessId');
  const nextBarcode = data.barcode ? String(data.barcode).trim() : null;
  const prevBarcode = previousBarcode ? String(previousBarcode).trim() : null;
  const productRef = doc(db, 'products', productId);
  const { stock, variantStock, businessId: _ignored, ...updatePayload } = data;

  // QUANTITIES ARE NOT A CATALOGUE EDIT. `stock` was already dropped here;
  // `variantStock` was not, so saving a name change from an editor opened
  // before a sale wrote the editor's stale map back over it — the size
  // sold on another till reappeared on the shelf while the product total
  // still said it had gone. Each version is now written as increment(0):
  // a version that does not exist yet is created at zero, and one that
  // does is left exactly as the sales, purchases and counts left it.
  for (const variantId of Object.keys(variantStock || {})) {
    updatePayload[`variantStock.${variantId}`] = increment(0);
  }

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