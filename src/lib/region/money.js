// src/lib/region/money.js
//
// THE ONE PLACE AN AMOUNT BECOMES TEXT.
//
// Formatting only. Nothing here rounds a stored value, converts between
// currencies or touches arithmetic: roundMoney() in utils/currency.js is
// still the only rounding the accounting engine does, and it runs before
// a number is saved, never on the way to the screen.
//
// Two display styles:
//
//   code    "KES 1,234.00"   Kenya's long-standing look, and what every
//                            PDF uses, because jsPDF's built-in fonts
//                            cannot draw ₦, ₹, ₱ or most other symbols.
//   symbol  "$1,234.00"      Intl's own currency formatting, in the
//                            business's locale, symbol placement and all.
//
// The code style is built by hand (code, space, number) rather than asked
// of Intl, because Intl's own code style moves the minus sign in front of
// the code ("-KES 5.00") and every Kenyan receipt, test and export has
// always printed "KES -5.00". Kenyan output is byte-for-byte unchanged.

import { getActiveRegion } from './region.js';

const SPACES = /[\u00a0\u202f]/g;
const cache = new Map();

function formatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat('en', options);
    }
    cache.set(key, f);
  }
  return f;
}

function toNumber(amount) {
  const v = Number(amount);
  return Number.isFinite(v) ? v : 0;
}

function digitsFor(region) {
  return Number.isInteger(region.currencyDigits) ? region.currencyDigits : 2;
}

function displayFor(region, display) {
  if (display === 'code' || display === 'symbol') return display;
  return region.currencyDisplay || 'code';
}

/** The digits of an amount, grouped for the locale, no currency. "1,234.00" */
export function formatAmount(amount, { region = getActiveRegion(), decimals } = {}) {
  const digits = Number.isInteger(decimals) ? decimals : digitsFor(region);
  return formatter(region.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toNumber(amount)).replace(SPACES, ' ');
}

/**
 * An amount in the business's currency.
 *
 *   formatMoney(1234)                          "KES 1,234.00" (Kenya)
 *   formatMoney(1234)                          "$1,234.00"    (United States)
 *   formatMoney(1234, { display: 'code' })     "USD 1,234.00"
 */
export function formatMoney(amount, { region = getActiveRegion(), display, decimals } = {}) {
  const style = displayFor(region, display);
  const digits = Number.isInteger(decimals) ? decimals : digitsFor(region);
  if (style === 'code') {
    return `${region.currency} ${formatAmount(amount, { region, decimals: digits })}`;
  }
  return formatter(region.locale, {
    style: 'currency',
    currency: region.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toNumber(amount)).replace(SPACES, ' ');
}

/** Whole units, for chart labels and tight spaces. "KES 1,235" / "$1,235" */
export function formatMoneyCompact(amount, options = {}) {
  return formatMoney(Math.round(toNumber(amount)), { ...options, decimals: 0 });
}

const markerCache = new Map();

/**
 * What goes in front of the digits when a screen renders the currency
 * separately from the number (the muted "KES" beside a big figure).
 * "KES" in Kenya, "$" in the US, "£" in the UK, "USD" when asked for code.
 */
export function currencyMarker({ region = getActiveRegion(), display } = {}) {
  const style = displayFor(region, display);
  if (style === 'code') return region.currency;
  const key = `${region.locale}|${region.currency}`;
  if (markerCache.has(key)) return markerCache.get(key);
  let marker = region.currency;
  try {
    const parts = formatter(region.locale, {
      style: 'currency', currency: region.currency, currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    marker = parts.find((p) => p.type === 'currency')?.value || region.currency;
  } catch { /* the code is always a correct marker */ }
  markerCache.set(key, marker);
  return marker;
}

/** The ISO code, for input labels: "Amount (KES)", "Amount (USD)". */
export function currencyCode({ region = getActiveRegion() } = {}) {
  return region.currency;
}

/** A plain count, grouped for the locale. "12,480" */
export function formatCount(value, { region = getActiveRegion(), maximumFractionDigits = 0 } = {}) {
  return formatter(region.locale, { maximumFractionDigits }).format(toNumber(value)).replace(SPACES, ' ');
}
