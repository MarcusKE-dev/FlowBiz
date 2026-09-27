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
  return findProductsByCode(products, rawCode)[0] || null;
}

/**
 * EVERY product a code matches, manufacturer barcodes first. More than one
 * means two products claim the same code — a barcode entered twice on two
 * devices, or an old clock-derived internal code — and a till must not
 * guess which one to sell, because guessing wrong sells and deducts the
 * wrong stock. Archived products never match.
 */
export function findProductsByCode(products, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return [];
  const lower = code.toLowerCase();
  const live = (products || []).filter((p) => p && !p.deleted);
  const byBarcode = live.filter((p) => p.barcode && p.barcode === code);
  const byInternal = live.filter((p) => p.internalCode && p.internalCode.toLowerCase() === lower && !byBarcode.includes(p));
  return [...byBarcode, ...byInternal];
}

/** The message a till shows when a scan is ambiguous, or null. */
export function ambiguousScanMessage(products, rawCode) {
  const matches = findProductsByCode(products, rawCode);
  if (matches.length < 2) return null;
  const names = matches.slice(0, 3).map((p) => p.name).join(', ');
  return `${normalizeCode(rawCode)} belongs to more than one product (${names}). Give each its own code in Products before selling it.`;
}

// The barcode-uniqueness ADVISORY behind the product form's warning.
//
// A different question from findProductByCode above. That one asks "which
// product is this code?"; this one asks "would saving this barcode collide
// with a product that already has it?" — and the answer has to exclude
// products that are not really collisions:
//
//   the product being EDITED   its own barcode is not a clash with itself
//   the product just CREATED   see below
//
// The second exclusion is not a nicety, it is the whole reason this
// function exists. `allProducts` is a live Firestore listener, and
// Firestore applies a write to the local cache the instant commit() is
// called — long before the server acknowledges it. So in the window
// between pressing Save and the save completing, which is seconds on a
// phone with a weak signal, the new product is ALREADY in the list the
// form checks against, and the form warns that the product it is
// creating clashes with itself. The save was always correct; the warning
// was always false. Scanning a genuinely new barcode and being told it
// already exists is the symptom.
export function findBarcodeClash(products, rawBarcode, { excludeIds = [] } = {}) {
  const barcode = normalizeCode(rawBarcode);
  if (!barcode) return null;
  const excluded = new Set(excludeIds.filter(Boolean));
  return (
    (products || []).find(
      (p) =>
        !excluded.has(p.id)
        && !p.deleted
        && typeof p.barcode === 'string'
        && p.barcode.trim() === barcode
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

// ── Continuous scanning preference ──────────────────────────────────
//
// Deliberately a per-device localStorage flag, not a Firestore field:
// the phone at the counter and the owner's laptop want different things,
// and a shop with two phones should be able to set them differently. It
// is a display preference, so nothing here touches the data model.
const CONTINUOUS_SCAN_KEY = 'flowbiz_continuous_scan';

export function isContinuousScanEnabled() {
  try {
    // Default on — the continuous flow is the better one, and the
    // setting exists to opt out of it.
    return localStorage.getItem(CONTINUOUS_SCAN_KEY) !== 'false';
  } catch {
    return true; // storage unavailable (private mode) — keep the default
  }
}

export function setContinuousScanEnabled(enabled) {
  try {
    localStorage.setItem(CONTINUOUS_SCAN_KEY, enabled ? 'true' : 'false');
  } catch { /* storage unavailable — the session keeps its in-memory value */ }
}
