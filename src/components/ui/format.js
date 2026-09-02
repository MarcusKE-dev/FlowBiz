// src/components/ui/format.js
//
// Presentation-only money helpers. All actual formatting still comes
// from utils/currency.js — this just splits the currency prefix off so
// it can be rendered smaller and muted, with the digits carrying the
// weight. No arithmetic happens here.

import { formatKES } from '../../utils/currency';

export const CURRENCY = 'KES';

// "KES 1,234.00" -> "1,234.00"
export function amountOnly(value) {
  return formatKES(value).replace(/^KES\s*/, '');
}
