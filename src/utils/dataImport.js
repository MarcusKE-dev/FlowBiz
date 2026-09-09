import { doc, writeBatch, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const IMPORT_COLLECTIONS = [
  'businessSettings',
  'customers', 'suppliers', 'products', 'sales', 'creditSales', 'purchases',
  'expenses', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'refunds', 'debtPaymentReceipts', 'sharedDocuments', 'staffInvites',
  // Restored after `products`, which they point at. See the note on
  // EXPORT_COLLECTIONS: these three must stay in step with the export and
  // the reset lists.
  'orders', 'orderLines', 'productions', 'productBatches', 'waste',
  // Restored last, so every product exists before its photo lands.
  'productImages',
];

// Product photos are base64, ~62KB each. A 350-document batch of them
// would be ~21MB and blow Firestore's ~10MB write-request limit, so
// they go in much smaller chunks. Everything else keeps the old size.
const DEFAULT_CHUNK = 350;
const CHUNK_SIZES = { productImages: 40 };

function isoToDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function reviveValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return isoToDate(value);
  if (Array.isArray(value)) return value.map(reviveValue);
  if (typeof value === 'object' && !(value instanceof Date)) {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = reviveValue(v);
    }
    return obj;
  }
  return value;
}

function reviveDoc(data) {
  const revived = {};
  Object.entries(data).forEach(([k, v]) => { revived[k] = reviveValue(v); });
  return revived;
}

export async function readExportZip(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('flowbiz-export.json');
  if (!manifestFile) throw new Error("That doesn't look like a FlowBiz export. flowbiz-export.json was not found in the zip.");
  const text = await manifestFile.async('string');
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error('flowbiz-export.json is not valid. The file may be corrupted.');
  }
  if (!manifest.collections || typeof manifest.collections !== 'object') {
    throw new Error("That doesn't look like a valid FlowBiz export. Collection data is missing.");
  }
  return manifest;
}

export async function checkExistingData(businessId, manifest) {
  if (!businessId) throw new Error('checkExistingData requires a businessId');
  const nonEmpty = [];
  for (const name of IMPORT_COLLECTIONS) {
    if (!manifest.collections[name]?.length) continue;
    try {
      if (name === 'businessSettings') {
        const snap = await getDocs(query(collection(db, name), where('__name__', '==', businessId), limit(1)));
        if (!snap.empty) nonEmpty.push(name);
      } else {
        const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(1)));
        if (!snap.empty) nonEmpty.push(name);
      }
    } catch {
      // Continue checking remaining collections
    }
  }
  return nonEmpty;
}

function resolveTargetId(name, originalId, businessId, manifestBusinessId, revived) {
  if (name === 'businessSettings') return businessId;
  // A photo's id is `{businessId}__{productId}` and its productId has
  // already been remapped by the caller, so it is rebuilt rather than
  // string-patched — the generic prefix swap below would produce an id
  // no product points at, leaving a silent orphan.
  if (name === 'productImages') {
    const productId = revived?.productId
      || resolveTargetId('products', originalId.split('__').slice(1).join('__'), businessId, manifestBusinessId);
    return `${businessId}__${productId}`;
  }
  if (name === 'dailySessions') {
    const dateMatch = originalId.match(/(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) return `${businessId}_${dateMatch[1]}`;
  }
  if (manifestBusinessId && manifestBusinessId !== businessId) {
    if (originalId.startsWith(`${manifestBusinessId}_`)) {
      return originalId.replace(`${manifestBusinessId}_`, `${businessId}_`);
    }
    return `${businessId}_${originalId}`;
  }
  return originalId;
}

export async function importBusinessData(businessId, manifest, { onProgress } = {}) {
  if (!businessId) throw new Error('importBusinessData() called with no businessId');

  const results = {};
  const barcodeEntries = [];
  const manifestBusinessId = manifest.businessId || null;
  const isCrossTenant = Boolean(manifestBusinessId && manifestBusinessId !== businessId);

  for (let i = 0; i < IMPORT_COLLECTIONS.length; i++) {
    const name = IMPORT_COLLECTIONS[i];
    const docs = manifest.collections[name] || [];
    onProgress?.(name, i, IMPORT_COLLECTIONS.length);
    if (docs.length === 0) { results[name] = 0; continue; }

    let written = 0;
    const chunkSize = CHUNK_SIZES[name] || DEFAULT_CHUNK;
    for (let start = 0; start < docs.length; start += chunkSize) {
      const chunk = docs.slice(start, start + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        const { id, ...rest } = d;
        if (!id) return;
        const revived = reviveDoc(rest);
        revived.businessId = businessId;

        // Remap cross-references if restoring across different business IDs
        if (isCrossTenant) {
          if (revived.productId) revived.productId = resolveTargetId('products', revived.productId, businessId, manifestBusinessId);
          if (revived.supplierId) revived.supplierId = resolveTargetId('suppliers', revived.supplierId, businessId, manifestBusinessId);
          if (revived.customerId) revived.customerId = resolveTargetId('customers', revived.customerId, businessId, manifestBusinessId);
          if (revived.creditSaleId) revived.creditSaleId = resolveTargetId('creditSales', revived.creditSaleId, businessId, manifestBusinessId);
          if (Array.isArray(revived.items)) {
            revived.items = revived.items.map((item) => ({
              ...item,
              productId: item.productId ? resolveTargetId('products', item.productId, businessId, manifestBusinessId) : item.productId,
            }));
          }
        }

        const targetId = resolveTargetId(name, id, businessId, manifestBusinessId, revived);
        batch.set(doc(db, name, targetId), revived);

        if (name === 'products' && revived.barcode && String(revived.barcode).trim()) {
          barcodeEntries.push({ businessId, barcode: String(revived.barcode).trim(), productId: targetId });
        }
      });
      await batch.commit();
      written += chunk.length;
    }
    results[name] = written;
  }

  for (let start = 0; start < barcodeEntries.length; start += 350) {
    const chunk = barcodeEntries.slice(start, start + 350);
    const batch = writeBatch(db);
    chunk.forEach((entry) => {
      batch.set(doc(db, 'barcodeIndex', `${businessId}__${entry.barcode}`), entry);
    });
    await batch.commit();
  }

  return results;
}