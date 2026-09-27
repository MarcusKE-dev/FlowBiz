// src/lib/region/phone.js
//
// A TYPED PHONE NUMBER AS E.164 DIGITS, using the business's country to
// read the national forms people actually type.
//
// E.164 is "+<country code><national number>", at most 15 digits. wa.me
// wants those digits without the plus, and that is what these functions
// return: digits only, country code first.
//
// This is deliberately not a full numbering-plan validator (that is
// libphonenumber, ~150 KB of metadata in a bundle that has to load on a
// shop's phone over a slow connection). It answers the question WhatsApp
// links and customer records actually ask — "which international number
// did the person mean?" — with three rules:
//
//   1. A number written internationally (+44…, 0044…) is taken as given.
//   2. A number starting with the country's trunk prefix (0 in Kenya and
//      the UK, 1 in the US) has it replaced by the country code.
//   3. A bare national number of the country's usual length gets the
//      country code in front.
//
// Anything else that is plausibly a full international number (10–15
// digits) is accepted as one rather than refusing a foreign customer —
// the behaviour Kenyan shops already relied on.

import { getActiveRegion } from './region.js';

const MIN_E164 = 8;
const MAX_E164 = 15;
const MIN_LOOSE_INTERNATIONAL = 10;

/**
 * Digits of the E.164 form of `raw` for a business in `region`, or null.
 *
 * Kenya (the default region):
 *   0741104469      -> 254741104469
 *   +254 741 104469 -> 254741104469
 *   741104469       -> 254741104469
 * United States:
 *   (415) 555-2671  -> 14155552671
 *   1 415 555 2671  -> 14155552671
 * United Kingdom:
 *   07911 123456    -> 447911123456
 */
export function toE164Digits(raw, { region = getActiveRegion() } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const international = /^(\+|00)/.test(text);
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;

  if (international) {
    if (text.startsWith('00')) digits = digits.slice(2);
    return digits.length >= MIN_E164 && digits.length <= MAX_E164 ? digits : null;
  }

  const cc = region.phoneCountryCode || '';
  const lengths = region.phoneNationalLengths || [];
  const trunk = region.phoneTrunkPrefix || '';

  // Already carries this country's code, at a length the country uses.
  if (cc && digits.startsWith(cc) && lengths.includes(digits.length - cc.length)) {
    return digits;
  }

  // Trunk prefix standing in for the country code.
  if (trunk && digits.startsWith(trunk) && lengths.includes(digits.length - trunk.length)) {
    return cc + digits.slice(trunk.length);
  }

  // The national number alone.
  if (cc && lengths.includes(digits.length)) {
    return cc + digits;
  }

  if (digits.length >= MIN_LOOSE_INTERNATIONAL && digits.length <= MAX_E164) {
    return digits;
  }
  return null;
}

/** "+254741104469", or null. */
export function toE164(raw, options) {
  const digits = toE164Digits(raw, options);
  return digits ? `+${digits}` : null;
}

export function isPlausiblePhone(raw, options) {
  return toE164Digits(raw, options) !== null;
}

/** A hint for the phone input's placeholder: "+254 7XX XXX XXX" style. */
export function phonePlaceholder({ region = getActiveRegion() } = {}) {
  const length = region.phoneNationalLengths?.[0] || 9;
  return `+${region.phoneCountryCode} ${'X'.repeat(Math.min(length, 12))}`;
}
