// src/utils/productImages.js
//
// Uploads an optimised product photo and hands back a download URL.
//
// IMPORTANT — the storage path is FLAT on purpose. storage.rules matches
//
//   match /businesses/{businessId}/{fileName}
//
// which is exactly ONE segment after the business id. A nested path like
// businesses/<id>/products/<file> has two segments, does not match the
// rule, and is denied. Do not "tidy" this into a products/ folder
// without changing storage.rules first.

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export function productImagePath(businessId, productId, extension = 'webp') {
  return `businesses/${businessId}/product_${productId}.${extension}`;
}

/**
 * @returns {Promise<string>} the download URL to store as `imageUrl`
 */
export async function uploadProductImage({ businessId, productId, blob, contentType, extension }) {
  if (!businessId) throw new Error('uploadProductImage() called with no businessId');
  if (!productId) throw new Error('uploadProductImage() called with no productId');
  if (!blob) throw new Error('uploadProductImage() called with no image');

  const path = productImagePath(businessId, productId, extension || 'webp');
  const storageRef = ref(storage, path);

  // Long cache: the filename is stable per product, and a replacement
  // overwrites it, so a new URL token is issued each time anyway.
  await uploadBytes(storageRef, blob, {
    contentType: contentType || 'image/webp',
    cacheControl: 'public, max-age=31536000',
  });

  return getDownloadURL(storageRef);
}
