// src/lib/region/countries.js
//
// THE MARKETS FLOWBIZ KNOWS HOW TO DEFAULT FOR. A country here is a set
// of sensible starting values — currency, timezone, locale, dialling code
// and what the counter calls its non-cash tender — and nothing more. An
// owner can override every one of them in Settings; this table only
// decides what a new business in that country starts with.
//
// Kenya is one row, not the default of the product. The ONLY place Kenya
// is special is DEFAULT_COUNTRY_CODE, and it is special there for a
// compatibility reason, not a product one: every business created before
// regional settings existed is Kenyan, stores no region at all, and must
// keep behaving exactly as it did. See region.js.
//
// Codes are ISO 3166-1 alpha-2 (country) and ISO 4217 (currency);
// timezones are IANA names; locales are BCP 47 tags Intl understands.
//
// `nationalLengths` is the number of digits in a national significant
// number (what follows the country code), used only to recognise a
// number typed WITHOUT its country code. `trunk` is the national prefix
// that stands in for the country code when dialling domestically ('0' in
// most of the world, '1' in the North American plan, none in a few).
//
// `digitalTender` is what the counter labels the second tender. The
// stored value on every sale stays 'M-Pesa' — see tenderLabel() — so this
// is presentation, and changing it rewrites nothing.

/** Row order is display order after the handful pinned to the top. */
export const COUNTRIES = [
  // ── East Africa ─────────────────────────────────────────────────────
  { code: 'KE', name: 'Kenya', currency: 'KES', dialCode: '254', timezone: 'Africa/Nairobi', locale: 'en-KE', nationalLengths: [9], trunk: '0', digitalTender: 'M-Pesa' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', dialCode: '256', timezone: 'Africa/Kampala', locale: 'en-UG', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', dialCode: '255', timezone: 'Africa/Dar_es_Salaam', locale: 'en-TZ', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', dialCode: '250', timezone: 'Africa/Kigali', locale: 'en-RW', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'BI', name: 'Burundi', currency: 'BIF', dialCode: '257', timezone: 'Africa/Bujumbura', locale: 'fr-BI', nationalLengths: [8], trunk: '', digitalTender: 'Mobile money' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', dialCode: '251', timezone: 'Africa/Addis_Ababa', locale: 'en-ET', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'SO', name: 'Somalia', currency: 'USD', dialCode: '252', timezone: 'Africa/Mogadishu', locale: 'en-SO', nationalLengths: [7, 8, 9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'SS', name: 'South Sudan', currency: 'SSP', dialCode: '211', timezone: 'Africa/Juba', locale: 'en-SS', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'CD', name: 'DR Congo', currency: 'CDF', dialCode: '243', timezone: 'Africa/Kinshasa', locale: 'fr-CD', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money', timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'] },

  // ── Southern Africa ─────────────────────────────────────────────────
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', dialCode: '27', timezone: 'Africa/Johannesburg', locale: 'en-ZA', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', dialCode: '260', timezone: 'Africa/Lusaka', locale: 'en-ZM', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'ZW', name: 'Zimbabwe', currency: 'USD', dialCode: '263', timezone: 'Africa/Harare', locale: 'en-ZW', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', dialCode: '265', timezone: 'Africa/Blantyre', locale: 'en-MW', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', dialCode: '258', timezone: 'Africa/Maputo', locale: 'pt-MZ', nationalLengths: [9], trunk: '', digitalTender: 'Mobile money' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', dialCode: '267', timezone: 'Africa/Gaborone', locale: 'en-BW', nationalLengths: [7, 8], trunk: '', digitalTender: 'Card' },
  { code: 'NA', name: 'Namibia', currency: 'NAD', dialCode: '264', timezone: 'Africa/Windhoek', locale: 'en-NA', nationalLengths: [8, 9], trunk: '0', digitalTender: 'Card' },

  // ── West and North Africa ───────────────────────────────────────────
  { code: 'NG', name: 'Nigeria', currency: 'NGN', dialCode: '234', timezone: 'Africa/Lagos', locale: 'en-NG', nationalLengths: [10], trunk: '0', digitalTender: 'Transfer' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', dialCode: '233', timezone: 'Africa/Accra', locale: 'en-GH', nationalLengths: [9], trunk: '0', digitalTender: 'Mobile money' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', dialCode: '221', timezone: 'Africa/Dakar', locale: 'fr-SN', nationalLengths: [9], trunk: '', digitalTender: 'Mobile money' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', dialCode: '225', timezone: 'Africa/Abidjan', locale: 'fr-CI', nationalLengths: [10], trunk: '', digitalTender: 'Mobile money' },
  { code: 'CM', name: 'Cameroon', currency: 'XAF', dialCode: '237', timezone: 'Africa/Douala', locale: 'fr-CM', nationalLengths: [9], trunk: '', digitalTender: 'Mobile money' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', dialCode: '20', timezone: 'Africa/Cairo', locale: 'en-EG', nationalLengths: [9, 10], trunk: '0', digitalTender: 'Card' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', dialCode: '212', timezone: 'Africa/Casablanca', locale: 'fr-MA', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },

  // ── Americas ────────────────────────────────────────────────────────
  {
    code: 'US', name: 'United States', currency: 'USD', dialCode: '1', timezone: 'America/New_York', locale: 'en-US', nationalLengths: [10], trunk: '1', digitalTender: 'Card',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Puerto_Rico'],
  },
  {
    code: 'CA', name: 'Canada', currency: 'CAD', dialCode: '1', timezone: 'America/Toronto', locale: 'en-CA', nationalLengths: [10], trunk: '1', digitalTender: 'Card',
    timezones: ['America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver'],
  },
  {
    code: 'MX', name: 'Mexico', currency: 'MXN', dialCode: '52', timezone: 'America/Mexico_City', locale: 'es-MX', nationalLengths: [10], trunk: '', digitalTender: 'Card',
    timezones: ['America/Mexico_City', 'America/Cancun', 'America/Chihuahua', 'America/Hermosillo', 'America/Tijuana'],
  },
  {
    code: 'BR', name: 'Brazil', currency: 'BRL', dialCode: '55', timezone: 'America/Sao_Paulo', locale: 'pt-BR', nationalLengths: [10, 11], trunk: '0', digitalTender: 'Pix',
    timezones: ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Rio_Branco'],
  },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', dialCode: '1', timezone: 'America/Jamaica', locale: 'en-JM', nationalLengths: [10], trunk: '1', digitalTender: 'Card' },

  // ── Europe ──────────────────────────────────────────────────────────
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', dialCode: '44', timezone: 'Europe/London', locale: 'en-GB', nationalLengths: [10], trunk: '0', digitalTender: 'Card' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', dialCode: '353', timezone: 'Europe/Dublin', locale: 'en-IE', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'DE', name: 'Germany', currency: 'EUR', dialCode: '49', timezone: 'Europe/Berlin', locale: 'de-DE', nationalLengths: [10, 11], trunk: '0', digitalTender: 'Card' },
  { code: 'FR', name: 'France', currency: 'EUR', dialCode: '33', timezone: 'Europe/Paris', locale: 'fr-FR', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', dialCode: '31', timezone: 'Europe/Amsterdam', locale: 'nl-NL', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'ES', name: 'Spain', currency: 'EUR', dialCode: '34', timezone: 'Europe/Madrid', locale: 'es-ES', nationalLengths: [9], trunk: '', digitalTender: 'Card' },
  { code: 'IT', name: 'Italy', currency: 'EUR', dialCode: '39', timezone: 'Europe/Rome', locale: 'it-IT', nationalLengths: [9, 10], trunk: '', digitalTender: 'Card' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', dialCode: '351', timezone: 'Europe/Lisbon', locale: 'pt-PT', nationalLengths: [9], trunk: '', digitalTender: 'Card' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', dialCode: '41', timezone: 'Europe/Zurich', locale: 'de-CH', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', dialCode: '46', timezone: 'Europe/Stockholm', locale: 'sv-SE', nationalLengths: [7, 8, 9], trunk: '0', digitalTender: 'Card' },
  { code: 'NO', name: 'Norway', currency: 'NOK', dialCode: '47', timezone: 'Europe/Oslo', locale: 'nb-NO', nationalLengths: [8], trunk: '', digitalTender: 'Card' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', dialCode: '45', timezone: 'Europe/Copenhagen', locale: 'da-DK', nationalLengths: [8], trunk: '', digitalTender: 'Card' },
  { code: 'PL', name: 'Poland', currency: 'PLN', dialCode: '48', timezone: 'Europe/Warsaw', locale: 'pl-PL', nationalLengths: [9], trunk: '', digitalTender: 'Card' },

  // ── Middle East and Asia ────────────────────────────────────────────
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', dialCode: '971', timezone: 'Asia/Dubai', locale: 'en-AE', nationalLengths: [8, 9], trunk: '0', digitalTender: 'Card' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', dialCode: '966', timezone: 'Asia/Riyadh', locale: 'en-SA', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', dialCode: '974', timezone: 'Asia/Qatar', locale: 'en-QA', nationalLengths: [8], trunk: '', digitalTender: 'Card' },
  { code: 'IN', name: 'India', currency: 'INR', dialCode: '91', timezone: 'Asia/Kolkata', locale: 'en-IN', nationalLengths: [10], trunk: '0', digitalTender: 'UPI' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', dialCode: '92', timezone: 'Asia/Karachi', locale: 'en-PK', nationalLengths: [10], trunk: '0', digitalTender: 'Mobile wallet' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', dialCode: '880', timezone: 'Asia/Dhaka', locale: 'en-BD', nationalLengths: [10], trunk: '0', digitalTender: 'Mobile wallet' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', dialCode: '94', timezone: 'Asia/Colombo', locale: 'en-LK', nationalLengths: [9], trunk: '0', digitalTender: 'Card' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', dialCode: '63', timezone: 'Asia/Manila', locale: 'en-PH', nationalLengths: [10], trunk: '0', digitalTender: 'E-wallet' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', dialCode: '60', timezone: 'Asia/Kuala_Lumpur', locale: 'en-MY', nationalLengths: [9, 10], trunk: '0', digitalTender: 'E-wallet' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', dialCode: '65', timezone: 'Asia/Singapore', locale: 'en-SG', nationalLengths: [8], trunk: '', digitalTender: 'Card' },
  {
    code: 'ID', name: 'Indonesia', currency: 'IDR', dialCode: '62', timezone: 'Asia/Jakarta', locale: 'id-ID', nationalLengths: [9, 10, 11, 12], trunk: '0', digitalTender: 'E-wallet',
    timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  },
  { code: 'VN', name: 'Vietnam', currency: 'VND', dialCode: '84', timezone: 'Asia/Ho_Chi_Minh', locale: 'vi-VN', nationalLengths: [9, 10], trunk: '0', digitalTender: 'Transfer' },
  { code: 'JP', name: 'Japan', currency: 'JPY', dialCode: '81', timezone: 'Asia/Tokyo', locale: 'ja-JP', nationalLengths: [9, 10], trunk: '0', digitalTender: 'Card' },

  // ── Oceania ─────────────────────────────────────────────────────────
  {
    code: 'AU', name: 'Australia', currency: 'AUD', dialCode: '61', timezone: 'Australia/Sydney', locale: 'en-AU', nationalLengths: [9], trunk: '0', digitalTender: 'Card',
    timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Perth', 'Australia/Hobart'],
  },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', dialCode: '64', timezone: 'Pacific/Auckland', locale: 'en-NZ', nationalLengths: [8, 9, 10], trunk: '0', digitalTender: 'Card' },
];

/** The compatibility default. Read the file header before changing it. */
export const DEFAULT_COUNTRY_CODE = 'KE';

/** Shown first in the country picker, in this order. */
export const PINNED_COUNTRY_CODES = ['KE', 'UG', 'TZ', 'NG', 'ZA', 'US', 'GB'];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code) {
  return BY_CODE.get(String(code || '').toUpperCase()) || null;
}

/** Pinned markets first, the rest alphabetically by name. */
export function countriesForPicker() {
  const pinned = PINNED_COUNTRY_CODES.map(countryByCode).filter(Boolean);
  const rest = COUNTRIES
    .filter((c) => !PINNED_COUNTRY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

/** The timezones worth offering for a country, default first. */
export function timezonesForCountry(code) {
  const country = countryByCode(code);
  if (!country) return [];
  return country.timezones?.length ? country.timezones : [country.timezone];
}

/**
 * A FIRST GUESS at the country for the sign-up picker, from the device's
 * timezone. It only pre-selects a visible, editable field; the owner
 * confirms it. Nothing about a business — least of all its currency — is
 * ever decided from the device without that confirmation.
 */
export function guessCountryFromDevice() {
  let tz;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    tz = '';
  }
  for (const c of COUNTRIES) {
    if (c.timezone === tz || c.timezones?.includes(tz)) return c.code;
  }
  return DEFAULT_COUNTRY_CODE;
}
