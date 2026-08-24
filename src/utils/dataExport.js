import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const EXPORT_COLLECTIONS = [
  'products', 'sales', 'creditSales', 'customers', 'suppliers', 'expenses',
  'purchases', 'dailySessions', 'repayments', 'supplierPayments',
  'stockAdjustments', 'refunds', 'debtPaymentReceipts', 'staffInvites',
];

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function flattenForCsv(docData) {
  const flat = {};
  Object.entries(docData).forEach(([key, value]) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      flat[key] = JSON.stringify(value);
    } else {
      flat[key] = value ?? '';
    }
  });
  return flat;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str; // formula-injection guard, same rule csvExport.js already uses
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => escapeCsvCell(row[h])).join(',')));
  return lines.join('\n');
}

export async function exportBusinessData(businessId, { onProgress } = {}) {
  if (!businessId) throw new Error('exportBusinessData() called with no businessId');

  const manifest = { exportedAt: new Date().toISOString(), businessId, collections: {} };
  const csvFiles = {};

  for (let i = 0; i < EXPORT_COLLECTIONS.length; i++) {
    const name = EXPORT_COLLECTIONS[i];
    onProgress?.(name, i, EXPORT_COLLECTIONS.length);

    const snap = await getDocs(query(collection(db, name), where('businessId', '==', businessId)));
    const docs = snap.docs.map((d) => {
      const jsonSafe = {};
      Object.entries(d.data()).forEach(([k, v]) => { jsonSafe[k] = timestampToIso(v); });
      return { id: d.id, ...jsonSafe };
    });

    manifest.collections[name] = docs;
    csvFiles[name] = rowsToCsv(docs.map((d) => {
      const { id, ...rest } = d;
      return { id, ...flattenForCsv(rest) };
    }));
  }

  return { manifest, csvFiles };
}

export async function buildExportZip(businessId, { onProgress } = {}) {
  const { manifest, csvFiles } = await exportBusinessData(businessId, { onProgress });
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  zip.file('flowbiz-export.json', JSON.stringify(manifest, null, 2));
  const csvFolder = zip.folder('csv');
  Object.entries(csvFiles).forEach(([name, csv]) => { if (csv) csvFolder.file(`${name}.csv`, csv); });

  return zip.generateAsync({ type: 'blob' });
}