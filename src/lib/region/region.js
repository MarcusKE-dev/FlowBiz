// src/lib/region/region.js
//
// WHERE A BUSINESS IS, AND WHAT THAT MEANS FOR HOW IT IS SHOWN.
//
// Stored on businessSettings/{businessId} as one map:
//
//   region: {
//     country,              ISO 3166-1 alpha-2, e.g. 'KE', 'US', 'GB'
//     currency,             ISO 4217, e.g. 'KES', 'USD', 'GBP'
//     locale,               BCP 47, e.g. 'en-KE', 'en-US'
//     timezone,             IANA, e.g. 'Africa/Nairobi', 'America/Chicago'
//     phoneCountryCode,     digits only, e.g. '254', '1', '44'
//     digitalTenderLabel,   optional: what the counter calls the non-cash tender
//   }
//
// THE MIGRATION IS THE DEFAULT. Every business that predates this map is
// Kenyan and stores nothing, so resolveRegion() of nothing is Kenya: KES,
// Africa/Nairobi, en-KE, +254, "M-Pesa". No document is rewritten, no
// backfill job runs, and a Kenyan shop sees byte-for-byte what it saw
// before. A partly-filled map is completed from its country's defaults,
// so an owner who only ever picks a country gets a coherent region.
//
// THE CURRENCY IS A LABEL ON NUMBERS, NEVER A CONVERSION. FlowBiz stores
// every amount as a plain number in the business's own currency. Nothing
// here, or anywhere, converts between currencies: changing a business's
// currency relabels its history rather than revaluing it, which is why
// Settings warns before allowing it.
//
// Pure: no React, no Firebase, no import.meta. The Worker imports this
// module directly (see cloudflare-worker/src/routes/publicDocument.js),
// exactly as it imports src/licensing/.

import { countryByCode, DEFAULT_COUNTRY_CODE } from './countries.js';

// ── Validators ────────────────────────────────────────────────────────

const ISO_CURRENCY = /^[A-Z]{3}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;
const DIAL_CODE = /^[1-9]\d{0,3}$/;

const currencyDigitsCache = new Map();

/**
 * Minor-unit digits Intl uses for a currency (KES 2, JPY 0, UGX 0), or
 * null for a code Intl does not recognise.
 */
export function currencyFractionDigits(currency) {
  if (!ISO_CURRENCY.test(String(currency || ''))) return null;
  if (currencyDigitsCache.has(currency)) return currencyDigitsCache.get(currency);
  let digits;
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    digits = null;
  }
  currencyDigitsCache.set(currency, digits);
  return digits;
}

/**
 * A currency FlowBiz can record in.
 *
 * THREE-DECIMAL CURRENCIES ARE REFUSED ON PURPOSE (KWD, BHD, OMR, JOD,
 * TND, LYD, IQD). Every money path in FlowBiz rounds through
 * roundMoney(), which is two decimal places, and changing that would be
 * changing the accounting engine. Refusing the handful of currencies it
 * would silently mis-round is the honest limitation; see
 * docs/INTERNATIONAL.md.
 */
export function isSupportedCurrency(currency) {
  const digits = currencyFractionDigits(currency);
  return digits !== null && digits <= 2;
}

/**
 * Every currency this runtime knows that FlowBiz can record in, as
 * { code, name }, sorted by code. Used by the Settings picker.
 */
export function supportedCurrencies(displayLocale = 'en') {
  let codes;
  try {
    codes = Intl.supportedValuesOf('currency');
  } catch {
    codes = [];
  }
  let names = null;
  try {
    names = new Intl.DisplayNames([displayLocale], { type: 'currency' });
  } catch {
    names = null;
  }
  return codes
    .filter(isSupportedCurrency)
    .map((code) => ({ code, name: names?.of(code) || code }));
}

/** Every IANA timezone this runtime knows. */
export function supportedTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

const tzCache = new Map();
export function isValidTimeZone(timezone) {
  if (typeof timezone !== 'string' || !timezone) return false;
  if (tzCache.has(timezone)) return tzCache.get(timezone);
  let ok;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    ok = true;
  } catch {
    ok = false;
  }
  tzCache.set(timezone, ok);
  return ok;
}

export function isValidLocale(locale) {
  if (typeof locale !== 'string' || !locale || locale.length > 35) return false;
  try {
    return Intl.getCanonicalLocales(locale).length === 1;
  } catch {
    return false;
  }
}

export function isValidCountryCode(code) {
  return ISO_COUNTRY.test(String(code || ''));
}

export function isValidDialCode(code) {
  return DIAL_CODE.test(String(code || ''));
}

// ── Resolution ────────────────────────────────────────────────────────

const MAX_TENDER_LABEL = 24;

function cleanTenderLabel(label) {
  const text = String(label ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, MAX_TENDER_LABEL) : '';
}

/**
 * A complete, valid region from whatever is stored — never throws, never
 * returns a partial object. Accepts the settings document itself or its
 * `region` map. Anything invalid falls back to the country's default, and
 * an unknown or missing country falls back to Kenya (see header).
 */
export function resolveRegion(input) {
  const raw = input && typeof input === 'object'
    ? (input.region && typeof input.region === 'object' ? input.region : input)
    : {};

  const country = countryByCode(raw.country) || countryByCode(DEFAULT_COUNTRY_CODE);

  const currency = isSupportedCurrency(raw.currency) ? raw.currency : country.currency;
  const timezone = isValidTimeZone(raw.timezone) ? raw.timezone : country.timezone;
  const locale = isValidLocale(raw.locale) ? raw.locale : country.locale;
  const phoneCountryCode = isValidDialCode(raw.phoneCountryCode) ? String(raw.phoneCountryCode) : country.dialCode;

  // The dialling defaults only describe the country's OWN numbering plan.
  // If the owner set a different dial code, the national-length and trunk
  // hints no longer apply and are dropped rather than misapplied.
  const sameDialPlan = phoneCountryCode === country.dialCode;

  return Object.freeze({
    country: country.code,
    countryName: country.name,
    currency,
    currencyDigits: currencyFractionDigits(currency),
    locale,
    timezone,
    phoneCountryCode,
    phoneNationalLengths: sameDialPlan ? country.nationalLengths : [],
    phoneTrunkPrefix: sameDialPlan ? country.trunk : '',
    digitalTenderLabel: cleanTenderLabel(raw.digitalTenderLabel) || country.digitalTender,
    // Kenya keeps its "KES 1,234.00" look. Everywhere else a symbol reads
    // better on a price tag, and Intl knows the symbol. Stored so an owner
    // could choose, but not yet exposed in Settings.
    currencyDisplay: raw.currencyDisplay === 'code' || raw.currencyDisplay === 'symbol'
      ? raw.currencyDisplay
      : (currency === 'KES' ? 'code' : 'symbol'),
  });
}

/**
 * The map to store for a business in `countryCode`, with every field
 * filled in from that country's defaults. What sign-up writes.
 */
export function defaultRegionFor(countryCode) {
  const country = countryByCode(countryCode) || countryByCode(DEFAULT_COUNTRY_CODE);
  return {
    country: country.code,
    currency: country.currency,
    locale: country.locale,
    timezone: country.timezone,
    phoneCountryCode: country.dialCode,
  };
}

/**
 * The storable form of a region an owner edited: only the fields the
 * rules accept, validated, with the tender label dropped when it is just
 * the country default (so a later change to the default reaches them).
 */
export function regionForStorage(input) {
  const resolved = resolveRegion(input);
  const out = {
    country: resolved.country,
    currency: resolved.currency,
    locale: resolved.locale,
    timezone: resolved.timezone,
    phoneCountryCode: resolved.phoneCountryCode,
  };
  const country = countryByCode(resolved.country);
  if (resolved.digitalTenderLabel && resolved.digitalTenderLabel !== country?.digitalTender) {
    out.digitalTenderLabel = resolved.digitalTenderLabel;
  }
  if (input?.currencyDisplay === 'code' || input?.currencyDisplay === 'symbol') {
    out.currencyDisplay = input.currencyDisplay;
  }
  return out;
}

export const DEFAULT_REGION = resolveRegion(null);

// ── The active region ─────────────────────────────────────────────────
//
// ONE BUSINESS IS OPEN AT A TIME, and a few hundred call sites format a
// number: receipts built in a util, a CSV row, a chart axis, a WhatsApp
// message. Threading a region argument through every one of them would
// have touched most of the product to say the same thing everywhere. So
// SettingsContext sets the open business's region here the moment its
// settings document arrives, and the formatters read it.
//
// Every formatter still takes an explicit region, and the admin console
// — which looks at many businesses at once — passes one. The active
// region is the default, not the only answer.

let activeRegion = DEFAULT_REGION;
const listeners = new Set();

export function getActiveRegion() {
  return activeRegion;
}

/** Returns true when the region actually changed. */
export function setActiveRegion(input) {
  const next = input && input.currencyDigits !== undefined && Object.isFrozen(input) ? input : resolveRegion(input);
  if (regionKey(next) === regionKey(activeRegion)) return false;
  activeRegion = next;
  for (const fn of listeners) {
    try { fn(activeRegion); } catch { /* a listener must not break the rest */ }
  }
  return true;
}

export function subscribeActiveRegion(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Identity of a region for change detection and React keys. */
export function regionKey(region) {
  const r = region || DEFAULT_REGION;
  return [r.country, r.currency, r.locale, r.timezone, r.phoneCountryCode, r.digitalTenderLabel, r.currencyDisplay].join('|');
}

// ── Tenders ───────────────────────────────────────────────────────────

/**
 * What the counter CALLS a tender. The stored method is unchanged: a sale
 * paid by card in London is still written `paymentMethod: 'M-Pesa'`,
 * because that string is the key every financial reader, every daily
 * session field (openingMpesaFloat, actualMpesaAtClose) and every report
 * in the product already splits on. Renaming the key would be a data
 * migration of every sale ever recorded for a label change. So the key is
 * internal, and this is the only thing that decides what a person reads.
 */
export function tenderLabel(method, region = activeRegion) {
  if (method === 'M-Pesa') return (region || DEFAULT_REGION).digitalTenderLabel || 'M-Pesa';
  return method;
}

/** True when the non-cash tender is literally M-Pesa (the transaction-code prompts). */
export function isMpesaRegion(region = activeRegion) {
  return (region || DEFAULT_REGION).digitalTenderLabel === 'M-Pesa';
}

/**
 * What the reference field for the non-cash tender is called. In Kenya it
 * is the M-Pesa confirmation code, and it is REQUIRED (a sale without one
 * cannot be matched to the till statement at close of day). Elsewhere it
 * is an optional reference — a card slip number, a transfer id — because a
 * card terminal gives the cashier nothing they must type.
 */
export function digitalReferenceLabel(region = activeRegion) {
  return isMpesaRegion(region) ? 'M-Pesa code' : `${tenderLabel('M-Pesa', region)} reference`;
}

export function digitalReferenceRequired(region = activeRegion) {
  return isMpesaRegion(region);
}

/** The toast when a required reference is missing. */
export function digitalReferenceMissingMessage(region = activeRegion) {
  return `Enter the ${digitalReferenceLabel(region)}.`;
}
