// src/utils/productImages.js
//
// Product photos WITHOUT Firebase Storage — the app is on the Spark
// (free) plan, and Storage now requires Blaze.
//
// ── The shape ──────────────────────────────────────────────────────────
// A photo lives in its own Firestore document, NOT on the product:
//
//   productImages/{businessId}__{productId}
//     { businessId, productId, dataUrl, contentType,
//       width, height, bytes, updatedAt }
//
// and the product document carries only a 2-field pointer:
//
//   products/{productId}
//     { hasImage: true, imageUpdatedAt: <ms> }
//
// WHY A SIDECAR AND NOT A FIELD ON THE PRODUCT — this is the whole
// reason the file exists. `products` is read through a live
// onSnapshot over the entire collection (hooks/useFirestoreCollection),
// so a base64 field on the product would re-ship EVERY photo to EVERY
// device on every stock change — which is every single sale. A 60-product
// shop would push ~4MB down the wire each time a cashier rings up a
// Coke, and pin the same 4MB in the offline persistence cache. The
// sidecar is never in that snapshot; it is fetched once, per product,
// only when a thumbnail is actually rendered.
//
// This mirrors how the business logo already works (Settings writes a
// compressed data URL to businessSettings) — the difference is that
// there is one logo and there can be hundreds of products, so products
// get their own documents and a lazy read instead of riding along.
//
// ── The three sources a thumbnail can come from ────────────────────────
//   1. `product.imageUrl` — a plain URL, rendered directly, no fetch.
//      Demo/seed products use this to point at /product-photos/*.webp
//      in the public folder. A future R2 or Storage migration writes its
//      CDN URL into this same field and nothing else has to change.
//   2. `product.hasImage` — a sidecar document, fetched lazily here.
//   3. neither — the placeholder icon.
//
// ── Reads are close to free ────────────────────────────────────────────
// A module-level Map dedupes within a session, and reads go to the
// Firestore persistent cache FIRST (getDocFromCache), only falling
// through to the server when the cached copy is missing or its
// `updatedAt` is older than the product's `imageUpdatedAt`. So a shop
// that opens the counter every morning pays one read per photo, ever,
// until that photo is replaced.

import {
  doc, getDoc, getDocFromCache, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export const PRODUCT_IMAGES = 'productImages';

// A hard ceiling well under Firestore's 1 MiB document limit. The
// optimiser targets 45KB (~62KB base64); this only ever catches a
// pathological image that would not compress.
export const MAX_DATA_URL_CHARS = 250 * 1000;

export function productImageDocId(businessId, productId) {
  return `${businessId}__${productId}`;
}

function imageRef(businessId, productId) {
  return doc(db, PRODUCT_IMAGES, productImageDocId(businessId, productId));
}

// ── Reading ────────────────────────────────────────────────────────────

// key -> data URL string, or null for "checked, genuinely has none".
const memo = new Map();
// key -> in-flight promise, so ten thumbnails mounting at once make one read.
const inFlight = new Map();

function memoKey(businessId, productId, stamp) {
  return `${businessId}__${productId}@${stamp || 0}`;
}

/** A directly-renderable URL on the product, if it has one. */
export function staticImageUrl(product) {
  const url = product?.imageUrl;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Only forms a browser can render as-is. Anything else is ignored
  // rather than handed to an <img> that will 404 in the console.
  if (/^(https?:|data:|blob:|\/)/i.test(trimmed)) return trimmed;
  return null;
}

/** True when this product's photo needs a sidecar fetch. */
export function needsSidecarFetch(product) {
  return Boolean(product?.hasImage) && !staticImageUrl(product);
}

function stampOf(product) {
  const v = product?.imageUpdatedAt;
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

/**
 * Fetches a product's photo as a data URL. Returns null when there is
 * none, and null (not a throw) when the read fails — a missing thumbnail
 * must never take down the counter.
 *
 * @param {{id: string, businessId?: string, hasImage?: boolean, imageUpdatedAt?: number}} product
 * @param {string} [businessId] fallback when the product doc omits it
 * @returns {Promise<string|null>}
 */
export async function loadProductImage(product, businessId) {
  const bid = product?.businessId || businessId;
  const pid = product?.id;
  if (!bid || !pid || !product?.hasImage) return null;

  const stamp = stampOf(product);
  const key = memoKey(bid, pid, stamp);
  if (memo.has(key)) return memo.get(key);
  if (inFlight.has(key)) return inFlight.get(key);

  const task = (async () => {
    const ref = imageRef(bid, pid);
    let snap = null;

    // Cache first — free, instant, and works with no connection at all.
    try {
      const cached = await getDocFromCache(ref);
      if (cached.exists()) {
        const cachedStamp = Number(cached.data()?.stamp) || 0;
        // Only go to the server when the product says the photo changed
        // after the copy we hold.
        if (!stamp || cachedStamp >= stamp) snap = cached;
      }
    } catch {
      // Not in cache. Expected on a first load; fall through.
    }

    if (!snap) {
      try {
        snap = await getDoc(ref);
      } catch (err) {
        console.error('Product image could not be loaded:', err);
        return null;
      }
    }

    const dataUrl = snap.exists() ? (snap.data()?.dataUrl || null) : null;
    return typeof dataUrl === 'string' && dataUrl.startsWith('data:') ? dataUrl : null;
  })();

  inFlight.set(key, task);
  try {
    const result = await task;
    memo.set(key, result);
    return result;
  } finally {
    inFlight.delete(key);
  }
}

/** Drops memoised copies for one product — used after a save or remove. */
export function forgetProductImage(businessId, productId) {
  const prefix = `${businessId}__${productId}@`;
  for (const key of memo.keys()) {
    if (key.startsWith(prefix)) memo.delete(key);
  }
}

// ── Writing ────────────────────────────────────────────────────────────

/**
 * Writes the sidecar document AND the pointer fields on the product, in
 * that order — so a product never claims to have a photo that isn't
 * there yet. Returns the pointer fields it wrote, for the caller's
 * optimistic UI.
 *
 * @returns {Promise<{hasImage: true, imageUpdatedAt: number}>}
 */
export async function saveProductImage({
  businessId, productId, dataUrl, contentType, width, height,
}) {
  if (!businessId) throw new Error('saveProductImage() called with no businessId');
  if (!productId) throw new Error('saveProductImage() called with no productId');
  if (!dataUrl || !dataUrl.startsWith('data:')) throw new Error('saveProductImage() needs a data URL');
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error('That photo is too large to store. Try a smaller or more tightly cropped image.');
  }

  const stamp = Date.now();

  await setDoc(imageRef(businessId, productId), {
    businessId,
    productId,
    dataUrl,
    contentType: contentType || 'image/webp',
    width: width || null,
    height: height || null,
    bytes: dataUrl.length,
    // `stamp` is a plain number the cache-freshness check can read
    // immediately; `updatedAt` is the server's own clock for auditing.
    stamp,
    updatedAt: serverTimestamp(),
  });

  forgetProductImage(businessId, productId);
  memo.set(memoKey(businessId, productId, stamp), dataUrl);

  return { hasImage: true, imageUpdatedAt: stamp };
}

/**
 * Removes a product's photo. The sidecar delete is best-effort: if it
 * fails, the pointer fields are still cleared by the caller, so the
 * photo disappears from the UI and the orphan is swept by a business
 * reset. Losing the photo when the user asked to lose it is fine;
 * leaving it on screen after they removed it is not.
 */
export async function deleteProductImage(businessId, productId) {
  if (!businessId || !productId) return;
  forgetProductImage(businessId, productId);
  try {
    await deleteDoc(imageRef(businessId, productId));
  } catch (err) {
    console.error('Product image could not be deleted:', err);
  }
}

/** The pointer fields that clear a photo on the product document. */
export const CLEARED_IMAGE_FIELDS = { hasImage: false, imageUpdatedAt: null, imageUrl: null };
