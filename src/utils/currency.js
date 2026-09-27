// src/utils/currency.js
//
// Money formatting now lives in src/lib/region/money.js, which formats in
// the open business's own currency and locale. These names are kept so the
// hundred-odd call sites read the same; they are the region formatters.
//
// formatPdfMoney is the one to use inside jsPDF: the built-in PDF fonts
// cannot draw most currency symbols (₦, ₹, ₱, ₩…), so a PDF always prints
// the ISO code — "NGN 1,234.00" — which every font can.

import { formatMoney, formatMoneyCompact } from '../lib/region/money.js';

export { formatMoney, formatMoneyCompact };

export function formatPdfMoney(amount, options = {}) {
  return formatMoney(amount, { ...options, display: 'code' });
}

// FIX (multi-product cart): quantity × unit price, summed across several
// cart lines, can accumulate binary floating-point noise (e.g.
// 0.1 + 0.2 = 0.30000000000000004). Every money total the cart computes —
// a line total, the cart grand total, aggregated COGS/profit written to
// Firestore — is rounded through this before being displayed or saved.
export function roundMoney(amount) {
  const v = Number(amount);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
