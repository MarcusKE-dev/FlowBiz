// src/industry/config.js
//
// Configuration precedence, in one place and one direction:
//
//     FlowBiz global defaults  (every capability off)
//   → Industry profile defaults
//   → Business overrides       (only where the capability allows one)
//   → Dependency enforcement
//   → Effective configuration
//
// Everything the application asks about industry behaviour comes out of
// resolveIndustryConfig(). There is no second path, no per-page lookup and
// no extra Firestore read: the input is the businessSettings document the
// app already keeps one shared listener on (SettingsContext), and the
// profile table it is resolved against is static code.
//
// Two properties this file must keep, because the rest of the project
// leans on them:
//
//   TOTALITY — it never throws and never returns a partial object. Garbage
//   input (an unknown profile, `capabilityOverrides: "yes"`, a null) has to
//   resolve to General Retail with everything off, because the input is a
//   Firestore document that an older client, a future client, or a hostile
//   one may have written.
//
//   PURITY — same input, same output, no I/O. That is what lets the
//   result be memoised once per settings snapshot and read by every
//   component for free.

import {
  CAPABILITIES, CAPABILITY_KEYS, GLOBAL_CAPABILITY_DEFAULTS,
  isKnownCapability, isOwnerConfigurable, isCapabilityInFamily,
} from './capabilities.js';
import { DEFAULT_PROFILE_ID, getProfile, isKnownProfile, baseTerms, CATEGORY_FILTER_COUNT } from './profiles.js';
import { DEFAULT_UNIT, UNITS } from './units.js';
import { resolveCategoryModel } from './categories.js';
import { resolveExpenseCategoryModel } from './expenseCategories.js';

/**
 * Reduce whatever is stored to the subset a business is actually allowed
 * to have said. Unknown keys, non-boolean values and capabilities that are
 * not owner-configurable are dropped — not rejected, dropped, so that one
 * bad key never invalidates a whole settings document.
 *
 * This is the client-side half of a rule enforced in three places: here,
 * in firestore.rules, and in the Worker's admin endpoint. The client copy
 * exists so the UI cannot offer something the server will refuse; it is
 * not, and must not be treated as, the enforcement.
 */
export function sanitizeCapabilityOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'boolean') continue;
    if (!isKnownCapability(key)) continue;
    if (!isOwnerConfigurable(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * The terms an owner may rename, and nothing else.
 *
 * A SMALL FIXED SET, deliberately. The full terms object is internal
 * vocabulary that other wording is written around — "Everything on the
 * menu, its price and what it uses" reads as a sentence, not a field —
 * and exposing all of it would turn a rename box into a way to make the
 * product incoherent. These three are the words an owner actually sees on
 * their own screen and can reasonably disagree with.
 *
 * Capability keys are never exposed here, or anywhere an owner can see.
 */
export const OVERRIDABLE_TERMS = ['catalogue', 'catalogueItem', 'catalogueItemPlural'];
export const MAX_TERM_LENGTH = 24;

/**
 * Clean a stored term-override map. Same rules as the capability
 * overrides: unknown keys dropped, non-strings dropped, everything
 * bounded — this is a document every device in the business reads and
 * renders, so nothing unbounded may enter it.
 */
export function sanitizeTermOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const key of OVERRIDABLE_TERMS) {
    const value = raw[key];
    if (typeof value !== 'string') continue;
    const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
    if (!cleaned) continue;
    out[key] = cleaned;
  }
  return out;
}

/**
 * CATEGORIES — resolved in categories.js, re-exported here so that
 * `industry/config` stays the one import the rest of the app needs.
 *
 * The rule is no longer "a stored list wins, always". A category list has
 * two halves — what the TRADE ships and what the BUSINESS added, removed
 * or rearranged — and only the second half is stored. See categories.js
 * for why storing the whole list was what made an industry's defaults
 * unreachable for every business created before the industry layer.
 */
export {
  resolveCategoryModel, sanitizeCategories, categoryWritePayload, resetCategoriesPayload,
  categoryKey, LEGACY_DEFAULT_CATEGORIES, MAX_CATEGORIES, MAX_CATEGORY_LENGTH,
} from './categories.js';

/**
 * EXPENSE CATEGORIES — the same two-part model, resolved in
 * expenseCategories.js and re-exported here so `industry/config` stays the
 * one import the rest of the app needs. Not per-trade: what a shop spends
 * money on does not depend on what it sells.
 */
export {
  resolveExpenseCategoryModel, expenseCategoryWritePayload, resetExpenseCategoriesPayload,
  isReservedExpenseCategory, DEFAULT_EXPENSE_CATEGORIES,
  MAX_EXPENSE_CATEGORIES, MAX_EXPENSE_CATEGORY_LENGTH,
} from './expenseCategories.js';

/**
 * Clean a stored unit-override list down to units the PROFILE actually
 * offers. An owner is choosing which of their trade's units to be shown
 * in the product form — they are not adding units the profile does not
 * have, because that is a change of trade, not a preference.
 *
 * The default unit is always present and always first: every product that
 * has never been given a unit is a piece, so removing it would leave
 * existing products showing a unit the form no longer offers.
 */
export function sanitizeUnitOverrides(raw, allowed) {
  if (!Array.isArray(raw)) return null;
  const permitted = new Set(allowed || []);
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    if (!UNITS[value] || !permitted.has(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  if (out.length === 0) return null;
  return out.includes(DEFAULT_UNIT) ? out : [DEFAULT_UNIT, ...out];
}

/**
 * Clean a stored dashboard ordering down to widgets the PROFILE offers.
 *
 * An owner reorders and hides what their trade already gives them; they
 * do not invent a widget, because a widget id with no code behind it
 * renders nothing and would look like a bug. An empty result falls back
 * to the profile's own ordering rather than leaving a blank dashboard.
 */
export function sanitizeDashboardOverrides(raw, allowed) {
  if (!Array.isArray(raw)) return null;
  const permitted = new Set(allowed || []);
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !permitted.has(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out : null;
}

/**
 * Turn off any capability whose prerequisite is off, repeatedly, until
 * nothing more changes. `tables` without `orders` is not a half-working
 * feature — it is a screen with no data behind it, so the dependency is
 * enforced rather than merely documented.
 */
function enforceDependencies(capabilities) {
  const resolved = { ...capabilities };
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of CAPABILITY_KEYS) {
      if (!resolved[key]) continue;
      const requires = CAPABILITIES[key].requires || [];
      if (requires.some((dep) => !resolved[dep])) {
        resolved[key] = false;
        changed = true;
      }
    }
  }
  return resolved;
}

function resolveUnits(profile, capabilities) {
  // With `units` off there is exactly one unit, and it is the one every
  // product already implicitly had. This is what keeps General Retail's
  // product form identical to what it has always been.
  if (!capabilities.units) return [DEFAULT_UNIT];
  const list = Array.isArray(profile.units) && profile.units.length > 0 ? profile.units : [DEFAULT_UNIT];
  const seen = new Set();
  const out = [];
  for (const id of [DEFAULT_UNIT, ...list]) {
    if (!UNITS[id] || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Base wording, then the profile's, then the owner's.
 *
 * `addCatalogueItem` is DERIVED when the owner has renamed the item, so
 * a shop that calls its products "stock" gets "Add stock" rather than an
 * "Add product" button above a page called Stock. It is not offered as
 * its own box, because two boxes that must agree is a way to get them to
 * disagree.
 */
function resolveTerms(profile, termOverrides) {
  const terms = { ...baseTerms(), ...(profile.terms || {}), ...termOverrides };
  if (termOverrides.catalogueItem) {
    terms.addCatalogueItem = `Add ${termOverrides.catalogueItem}`;
  }
  return terms;
}

/**
 * The one entry point. `settings` is the businessSettings document as
 * SettingsContext already holds it.
 *
 * TOTALITY IS ENFORCED HERE, not merely intended. Everything below is
 * written to degrade rather than throw — an unknown profile lands on
 * General Retail, a malformed override map reduces to nothing — but the
 * contract this file publishes is that it NEVER throws, and a contract
 * that depends on every future edit remembering it is not a contract.
 *
 * So the resolution runs inside a guard. A Firestore document is plain
 * deserialised JSON and cannot contain, say, a property getter that
 * throws; but this function is the single point every screen in the
 * application reads its configuration from, and the cost of a blank app
 * is far higher than the cost of one try block.
 */
export function resolveIndustryConfig(settings) {
  try {
    return resolveIndustryConfigStrict(settings);
  } catch {
    // The safe baseline: General Retail with everything off, which is
    // exactly what a business that has never configured anything gets.
    return resolveIndustryConfigStrict(null);
  }
}

function resolveIndustryConfigStrict(settings) {
  const storedProfileId = settings?.industryProfile;
  const profileId = isKnownProfile(storedProfileId) ? storedProfileId : DEFAULT_PROFILE_ID;
  const profile = getProfile(profileId);

  const overrides = sanitizeCapabilityOverrides(settings?.capabilityOverrides);
  const termOverrides = sanitizeTermOverrides(settings?.termOverrides);

  const profileDefaults = { ...GLOBAL_CAPABILITY_DEFAULTS };
  for (const [key, value] of Object.entries(profile.capabilities || {})) {
    if (isKnownCapability(key)) profileDefaults[key] = value === true;
  }

  const merged = { ...profileDefaults };
  for (const [key, value] of Object.entries(overrides)) merged[key] = value;

  const capabilities = enforceDependencies(merged);

  // Unit and dashboard overrides are resolved AFTER dependencies, because
  // what a profile offers depends on which capabilities survived them: a
  // business with `units` switched off has exactly one unit, and an owner
  // cannot have chosen a subset of a list that no longer exists.
  const profileUnits = resolveUnits(profile, capabilities);
  const unitOverrides = sanitizeUnitOverrides(settings?.unitOverrides, profileUnits);
  const dashboardOverrides = sanitizeDashboardOverrides(settings?.dashboardOverrides, profile.dashboard);

  // Which overrides actually changed something, after dependencies. An
  // override that asks for `tables` in a shop with no `orders` is stored
  // but inert, and the UI should not claim the business is customised
  // because of it.
  const effectiveOverrides = {};
  for (const key of CAPABILITY_KEYS) {
    if (capabilities[key] !== profileDefaults[key]) effectiveOverrides[key] = capabilities[key];
  }

  return {
    profileId,
    profile,
    family: profile.family,
    label: profile.label,
    tagline: profile.tagline,

    capabilities,
    profileDefaults,
    overrides,
    effectiveOverrides,
    usesDefaults:
      Object.keys(effectiveOverrides).length === 0
      && unitOverrides === null
      && dashboardOverrides === null
      && Object.keys(termOverrides).length === 0,

    terms: resolveTerms(profile, termOverrides),
    // What the profile OFFERS, and what the owner has chosen from it.
    // `units` is the effective list every product form reads; the profile
    // list stays available so the customize page can show what was
    // switched off rather than losing it.
    profileUnits,
    units: unitOverrides || profileUnits,
    unitOverrides: unitOverrides || null,
    // The category picture, resolved in categories.js: the trade's own
    // starting groups, the words this business added, the ones it took
    // off, and the effective list every screen reads. Only the business's
    // half is stored, so correcting a business's trade swaps the defaults
    // and leaves its own words exactly where they are.
    ...resolveCategoryModel(settings, profile),
    // The expense list every expense form reads. Stored as a diff against
    // FlowBiz's defaults, on the same document, so it costs no read.
    ...resolveExpenseCategoryModel(settings),
    // How many catalogue items before the counter offers its category
    // row. Zero means always — see profiles.js.
    categoryFilterThreshold: Number.isFinite(profile.categoryFilterThreshold)
      ? profile.categoryFilterThreshold
      : CATEGORY_FILTER_COUNT,
    profileDashboard: profile.dashboard,
    dashboard: dashboardOverrides || profile.dashboard,
    dashboardOverrides: dashboardOverrides || null,
    termOverrides,
    hiddenNav: profile.hiddenNav || [],

    /** The single question the rest of the app is allowed to ask. */
    can: (key) => capabilities[key] === true,
  };
}

/** The configuration a business with no stored settings resolves to. */
export const DEFAULT_INDUSTRY_CONFIG = resolveIndustryConfig(null);

/**
 * The change a "reset to industry defaults" action must write. Clearing
 * the override map is the whole operation — no data is touched, and the
 * profile itself is left exactly where it is.
 */
export function resetOverridesPayload() {
  // Every override an owner can make, cleared together. Nothing else is
  // touched — not the profile, and not a single record — so "back to
  // defaults" changes what FlowBiz OFFERS and never what it has.
  return {
    capabilityOverrides: {},
    unitOverrides: null,
    dashboardOverrides: null,
    termOverrides: {},
  };
}

/**
 * What a profile change is allowed to write. Deliberately just two fields:
 * a profile switch must not delete, rewrite or migrate anything, so it
 * cannot be permitted to carry any other key along with it.
 *
 * NOT AN OWNER-FACING OPERATION. The business type is chosen once, when
 * the business is created (see pages/Setup.jsx), and is not a setting
 * afterwards: everything else in this file is derived from it, so
 * swapping it under a year of recorded trade leaves a configuration that
 * matches nothing the business has. This function is the SHAPE of a
 * change — kept because the Worker's administrator endpoint performs the
 * same two-field write server-side, where it is permissioned and audited.
 * Do not wire it back into a merchant-facing screen.
 *
 * `resetOverrides` defaults to true because overrides are expressed
 * against the profile that was in force when they were made — carrying
 * "tables off" from a Café into a Hardware shop is meaningless. Callers
 * that genuinely want to keep them must ask.
 */
export function profileChangePayload(nextProfileId, { resetOverrides = true } = {}) {
  if (!isKnownProfile(nextProfileId)) {
    throw new Error(`Unknown industry profile: ${nextProfileId}`);
  }
  return resetOverrides
    ? { industryProfile: nextProfileId, ...resetOverridesPayload() }
    : { industryProfile: nextProfileId };
}

/** The capabilities an owner may actually toggle, for the settings UI. */
export function ownerConfigurableCapabilities(config) {
  return CAPABILITY_KEYS
    .filter((key) => CAPABILITIES[key].ownerConfigurable)
    // A capability whose prerequisite is off in this profile is not a
    // choice, it is a dead switch. Do not show it.
    .filter((key) => (CAPABILITIES[key].requires || []).every((dep) => config.capabilities[dep]))
    // A capability designed for another family is not a choice either.
    // A hardware shop has nothing to say about modifiers or recipes, and
    // offering it the switch only invites it to turn on a feature with
    // no meaning in its trade.
    //
    // THE EXCEPTION, and the reason this is not a plain filter: if such a
    // capability is somehow already ON for this business — an override
    // stored before this scoping existed, or set by an administrator —
    // hiding it would strand the setting where nobody could reach it.
    // So an out-of-family capability stays visible exactly as long as it
    // is on, which is exactly as long as there is something to undo.
    .filter((key) => isCapabilityInFamily(key, config.family) || config.capabilities[key] === true)
    .map((key) => ({
      ...CAPABILITIES[key],
      enabled: config.capabilities[key],
      isDefault: config.capabilities[key] === config.profileDefaults[key],
    }));
}
