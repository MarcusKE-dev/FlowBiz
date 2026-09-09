// cloudflare-worker/src/lib/industry.js
//
// The server's copy of the two lists the industry layer is validated
// against: which profiles exist, and which capabilities a business is
// permitted to override.
//
// It is a COPY on purpose. The Worker is a separate deployment artefact
// from the browser bundle and must be able to refuse a bad request without
// depending on anything the client shipped — a client that says
// `industryProfile: 'PHARMACY_ADMIN'` is refused here whatever its own
// table happens to contain today. `test/industryConfig.test.js` imports
// the browser module and asserts the two stay identical, so the copy
// cannot drift silently.
//
// Note what is NOT here: `orders` and `batches`. Those move only with the
// profile, so neither an owner nor an administrator can switch them on
// against a profile that does not have them.

export const INDUSTRY_PROFILE_IDS = [
  'GENERAL_RETAIL', 'SUPERMARKET', 'HARDWARE', 'BOUTIQUE', 'ELECTRONICS', 'WINES_AND_SPIRITS',
  'RESTAURANT', 'CAFE', 'FAST_FOOD', 'BAKERY', 'BAR',
  'SALON', 'BARBER', 'GENERAL_SERVICES',
  'PHARMACY',
];

export const OWNER_CONFIGURABLE_CAPABILITIES = [
  'units', 'variants', 'barcodeLabels', 'services',
  'tables', 'modifiers', 'diningModes', 'kitchen',
  // Where an item is made, when it is served, and what was thrown away.
  // See src/industry/capabilities.js — this list is the third copy and a
  // test in the client asserts the three never drift.
  'kitchenStations', 'courses', 'waste',
  'recipes', 'production', 'packSizes', 'ageRestriction', 'expiryAlerts',
];

export const DEFAULT_INDUSTRY_PROFILE = 'GENERAL_RETAIL';

export function isKnownIndustryProfile(value) {
  return typeof value === 'string' && INDUSTRY_PROFILE_IDS.includes(value);
}

/**
 * Reduce a submitted override map to what a business is allowed to have
 * said. Anything else — an unknown key, a non-boolean, a capability that
 * is not owner-configurable — is dropped rather than stored. Returns null
 * if the input is not a plain object, so a caller can tell "no overrides
 * submitted" from "an empty override map submitted".
 */
/**
 * The three words an owner may rename. Mirrors OVERRIDABLE_TERMS in
 * src/industry/config.js; the drift test asserts the two stay identical.
 */
export const OVERRIDABLE_TERMS = ['catalogue', 'catalogueItem', 'catalogueItemPlural'];
export const MAX_TERM_LENGTH = 24;
export const MAX_OVERRIDE_LIST = 20;

/**
 * Reduce a submitted term-override map to the three permitted words,
 * each a short plain string. Bounded here as well as on the client
 * because the client copy is a convenience and this is the enforcement.
 */
export function sanitizeTermOverrides(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of OVERRIDABLE_TERMS) {
    const value = raw[key];
    if (typeof value !== 'string') continue;
    const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

/**
 * A bounded list of short string ids — a unit list or a dashboard
 * ordering. Which ids are meaningful depends on the profile and is
 * resolved on read; what the server guarantees is that the stored value
 * is a short list of short strings with no duplicates.
 */
export function sanitizeIdList(raw) {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const cleaned = value.trim();
    if (!cleaned || cleaned.length > 40 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= MAX_OVERRIDE_LIST) break;
  }
  return out;
}

export function sanitizeCapabilityOverrides(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'boolean') continue;
    if (!OWNER_CONFIGURABLE_CAPABILITIES.includes(key)) continue;
    out[key] = value;
  }
  return out;
}
