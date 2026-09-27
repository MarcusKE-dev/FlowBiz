// src/components/ui/format.js
//
// Presentation-only money helpers for screens that render the currency
// marker separately from the digits (muted "KES" or "$" beside the
// figure). They read the open business's region; see lib/region/money.js.
// No arithmetic happens here.

export { currencyMarker, formatAmount as amountOnly } from '../../lib/region/money.js';
