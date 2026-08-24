import { doc, writeBatch, getDocs, query, collection, where, limit } from 'firebase/firestore';
import { db } from '../firebase';

// Ordered so anything another collection references (customers,
// suppliers, products) is written before the records that reference it.
export const IMPORT_COLLECTIONS = [
  'customers', 'suppliers', 'products', 'sales', 'creditSales', 'purchases',
  'expenses', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'refunds', 'debtPaymentReceipts',
];

function isoToDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function reviveDoc(data) {
  const revived = {};
  Object.entries(data).forEach(([k, v]) => { revived[k] = isoToDate(v); });
  return revived;
}

export async function readExportZip(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('flowbiz-export.json');
  if (!manifestFile) throw new Error("That doesn't look like a FlowBiz export — flowbiz-export.json wasn't found in the zip.");
  const text = await manifestFile.async('string');
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new Error('flowbiz-export.json is not valid — the file may be corrupted.');
  }
  if (!manifest.collections || typeof manifest.collections !== 'object') {
    throw new Error("That doesn't look like a FlowBiz export — missing expected data.");
  }
  return manifest;
}

// Which of the collections about to be imported already have ANY
// document for this business — used to warn before merging into
// non-empty data, since a document sharing the exact same ID as one you
// already have will be silently overwritten.
export async function checkExistingData(businessId, manifest) {
  const nonEmpty = [];
  for (const name of IMPORT_COLLECTIONS) {
    if (!manifest.collections[name]?.length) continue;
    const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId), limit(1)));
    if (!snap.empty) nonEmpty.push(name);
  }
  return nonEmpty;
}

function resolveTargetId(name, originalId, businessId) {
  if (name === 'dailySessions') {
    const dateMatch = originalId.match(/(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) return `${businessId}_${dateMatch[1]}`;
  }
  return originalId;
}

export async function importBusinessData(businessId, manifest, { onProgress } = {}) {
  if (!businessId) throw new Error('importBusinessData() called with no businessId');

  const results = {};
  const barcodeEntries = [];

  for (let i = 0; i < IMPORT_COLLECTIONS.length; i++) {
    const name = IMPORT_COLLECTIONS[i];
    const docs = manifest.collections[name] || [];
    onProgress?.(name, i, IMPORT_COLLECTIONS.length);
    if (docs.length === 0) { results[name] = 0; continue; }

    let written = 0;
    for (let start = 0; start < docs.length; start += 400) {
      const chunk = docs.slice(start, start + 400);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        const { id, ...rest } = d;
        if (!id) return;
        const revived = reviveDoc(rest);
        revived.businessId = businessId;
        const targetId = resolveTargetId(name, id, businessId);
        batch.set(doc(db, name, targetId), revived);
        if (name === 'products' && revived.barcode) {
          barcodeEntries.push({ businessId, barcode: revived.barcode, productId: targetId });
        }
      });
      await batch.commit();
      written += chunk.length;
    }
    results[name] = written;
  }

  for (let start = 0; start < barcodeEntries.length; start += 400) {
    const chunk = barcodeEntries.slice(start, start + 400);
    const batch = writeBatch(db);
    chunk.forEach((entry) => {
      batch.set(doc(db, 'barcodeIndex', `${businessId}__${entry.barcode}`), entry);
    });
    await batch.commit();
  }

  return results;
}