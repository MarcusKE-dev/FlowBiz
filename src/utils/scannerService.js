// src/utils/scannerService.js
//
// Central place all code-matching logic lives, so camera scans, hardware
// scanner input, and manual search-box typing all resolve to the exact
// same product via the exact same rule. Nothing about sales, purchases,
// or stock take needed to change — this just answers "what product is
// this code?" and hands the answer to whichever existing workflow asked.

export function normalizeCode(raw) {
  return String(raw || '').trim();
}

// Matches a scanned/typed code against a product's manufacturer barcode
// OR its internal FlowBiz code (FB-000001). Barcode match is exact
// (manufacturer barcodes are numeric strings); internal code match is
// case-insensitive (FB-000001 vs fb-000001 should both work when typed).
export function findProductByCode(products, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const lower = code.toLowerCase();
  return (
    (products || []).find(
      (p) =>
        (p.barcode && p.barcode === code) ||
        (p.internalCode && p.internalCode.toLowerCase() === lower)
    ) || null
  );
}

// FUTURE-READY: additional scan payload "kinds" (a QR code pointing at a
// product some other way, a warehouse location label, a price label) can
// be added here as their own small resolver, dispatched on a `kind` field
// embedded in the scanned payload — without ScannerModal or any page that
// uses it needing to change. Today every scan is just a product code.
export function parseScanPayload(rawText) {
  return { kind: 'product-code', code: normalizeCode(rawText) };
}