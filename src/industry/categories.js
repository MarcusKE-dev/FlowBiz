// src/industry/categories.js
//
// WHAT A CATEGORY LIST IS MADE OF.
//
// A business's category list has two halves that behave completely
// differently, and collapsing them into one stored array is what made the
// Customize page show a supermarket its hardware categories:
//
//   INDUSTRY DEFAULTS — the trade's starting groups. They belong to the
//   PROFILE, not to the business, so they must follow the profile when a
//   platform administrator corrects it. They are code, never data.
//
//   THE BUSINESS'S OWN WORDS — categories an owner typed, and industry
//   defaults an owner removed. They belong to the BUSINESS, products
//   already point at them, and nothing may ever delete or rewrite them.
//
// So the stored shape is the second half only, expressed as a diff
// against the first:
//
//     customCategories  — words the owner added that the trade does not ship
//     hiddenCategories  — trade defaults the owner took off the list
//     categoryOrder     — the running order the owner arranged
//
// and the effective list is derived:
//
//     profile defaults − hidden  +  custom,  arranged by order
//
// THE BUG THIS FILE FIXES. Until now the whole effective list was stored
// in `categories`, and the resolver's rule was "a stored list wins,
// always". Every FlowBiz business that predates the industry layer had
// one written for it — SettingsContext used to `setDoc` a global default
// list on first read, and Setup wrote the same seven words into every new
// business regardless of trade. So a supermarket, a pharmacy and a bar
// all had 'Beverages, Hardware, Household, Personal Care, Stationery,
// Airtime/Float, Other' physically stored in Firestore, the resolver
// dutifully returned it, and no industry default was ever reached. The
// resolver was right; the data was a fossil.
//
// It is migrated at READ time, never by a destructive write:
// LEGACY_DEFAULT_CATEGORIES is exactly what those clients wrote, so the
// words in a stored list that are NOT in it are precisely the words an
// owner typed, and the ones missing from it are precisely the ones an
// owner removed. Both survive; the fossil defaults do not.
//
// General Retail is unaffected by design: its profile list IS the legacy
// list, so a general shop's effective categories come out byte-identical
// to what it sees today.

import { getProfile } from './profiles.js';

/**
 * The category list every FlowBiz client wrote into businessSettings
 * before the industry layer existed — SettingsContext's self-heal and
 * Setup's business-creation batch. It is a MIGRATION CONSTANT, not a
 * default: nothing resolves to it, and it must never be edited to track
 * the General Retail profile. Its only job is to recognise a stored list
 * that no owner ever chose.
 */
export const LEGACY_DEFAULT_CATEGORIES = Object.freeze([
  'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other',
]);

export const MAX_CATEGORIES = 60;
export const MAX_CATEGORY_LENGTH = 32;

/** Case- and whitespace-insensitive identity. Two spellings are one word. */
export function categoryKey(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Reduce a stored list to clean, bounded, de-duplicated words.
 * Everything is dropped rather than rejected: these are Firestore arrays
 * that an older client, a data import or a future client may have
 * written, and one bad entry must never blank a business's whole list.
 */
export function sanitizeCategories(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, MAX_CATEGORY_LENGTH);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out;
}

function keySet(names) {
  return new Set(names.map(categoryKey));
}

/** Has this business been stored in the two-part model at all? */
function hasStoredModel(settings) {
  return Array.isArray(settings?.customCategories)
    || Array.isArray(settings?.hiddenCategories)
    || Array.isArray(settings?.categoryOrder);
}

/**
 * Read the business's own half of the list out of whatever is stored —
 * the model fields when they exist, otherwise the legacy array, migrated.
 *
 * Returns `{ custom, hidden, order, source }` and never throws.
 */
function storedOwnWords(settings, defaults) {
  const defaultKeys = keySet(defaults);

  if (hasStoredModel(settings)) {
    return {
      custom: sanitizeCategories(settings.customCategories),
      hidden: sanitizeCategories(settings.hiddenCategories),
      order: sanitizeCategories(settings.categoryOrder),
      source: 'model',
    };
  }

  const legacy = sanitizeCategories(settings?.categories);
  if (legacy.length === 0) {
    return { custom: [], hidden: [], order: [], source: 'defaults' };
  }

  // MIGRATION. The stored list is a legacy full list. Split it against
  // what the legacy clients wrote, not against the current profile: the
  // words that were never in the fossil are the owner's, and the fossil
  // words that are missing were removed on purpose.
  const legacyKeys = keySet(LEGACY_DEFAULT_CATEGORIES);
  const storedKeys = keySet(legacy);

  const custom = legacy.filter((name) => !legacyKeys.has(categoryKey(name)) && !defaultKeys.has(categoryKey(name)));
  const hidden = LEGACY_DEFAULT_CATEGORIES.filter((name) => !storedKeys.has(categoryKey(name)));

  // THE ORDER IS ONLY CARRIED OVER IF SOMEONE CHOSE IT. The fossil list
  // has a running order nobody picked — it is the order the constant was
  // typed in — and imposing it on a trade's defaults would push, say, a
  // pharmacy's Prescription below a general shop's Personal Care. So it
  // is kept only when the stored list shows evidence of arrangement:
  // the legacy words are out of their original sequence, or a word the
  // owner added sits somewhere other than the end (which is where adding
  // one has always put it).
  const legacySequence = legacy.filter((name) => legacyKeys.has(categoryKey(name))).map(categoryKey);
  const originalSequence = LEGACY_DEFAULT_CATEGORIES
    .filter((name) => storedKeys.has(categoryKey(name))).map(categoryKey);
  const reordered = legacySequence.join('|') !== originalSequence.join('|');
  const tail = legacy.slice(legacy.length - custom.length);
  const customAppended = custom.every((name, i) => categoryKey(tail[i]) === categoryKey(name));

  return {
    custom,
    hidden,
    order: reordered || !customAppended ? legacy : [],
    source: 'legacy',
  };
}

/**
 * The whole category picture for one business, in one object.
 *
 * PURE and TOTAL, exactly like the rest of the industry layer: the input
 * is the businessSettings document the app already listens to, the
 * profile table is static code, and hostile input degrades to the trade's
 * own starting list rather than throwing.
 */
export function resolveCategoryModel(settings, profileOrId) {
  const profile = typeof profileOrId === 'string' ? getProfile(profileOrId) : profileOrId;
  const defaults = Array.isArray(profile?.categories) ? [...profile.categories] : [];
  const defaultKeys = keySet(defaults);

  const { custom: rawCustom, hidden: rawHidden, order, source } = storedOwnWords(settings, defaults);

  // A "custom" word that the trade also ships is not custom — it is the
  // default, and storing it twice would show it twice.
  const custom = rawCustom.filter((name) => !defaultKeys.has(categoryKey(name)));
  // Hiding something the trade does not ship is inert, but it is kept as
  // stored: the profile can change under it, and a word hidden in a
  // pharmacy should stay hidden if the business is corrected back.
  const hiddenKeys = keySet(rawHidden);

  const shownDefaults = defaults.filter((name) => !hiddenKeys.has(categoryKey(name)));
  const pool = [...shownDefaults, ...custom].slice(0, MAX_CATEGORIES);

  // Arrange. Anything the owner ordered comes first in their order;
  // anything they have never seen (a default the profile gained, a word
  // added on another device) is appended rather than lost.
  const byKey = new Map(pool.map((name) => [categoryKey(name), name]));
  const categories = [];
  const placed = new Set();
  for (const name of order) {
    const key = categoryKey(name);
    if (!byKey.has(key) || placed.has(key)) continue;
    placed.add(key);
    categories.push(byKey.get(key));
  }
  for (const name of pool) {
    const key = categoryKey(name);
    if (placed.has(key)) continue;
    placed.add(key);
    categories.push(name);
  }

  return {
    /** The trade's starting groups, as shipped. */
    defaultCategories: defaults,
    /** Trade groups this business has taken off its list. */
    hiddenCategories: rawHidden,
    /** Words this business added that no profile ships. */
    customCategories: custom,
    /** What every screen reads. */
    categories,
    /** True when nothing has been added, removed or rearranged. */
    usesDefaultCategories:
      custom.length === 0
      && shownDefaults.length === defaults.length
      && categories.every((name, i) => name === defaults[i]),
    /** 'defaults' | 'legacy' | 'model' — where the owner's half came from. */
    categorySource: source,
  };
}

/**
 * The fields a change to the category list must write.
 *
 * The caller hands in the ordered list it wants the business to have and
 * gets back the DIFF against the trade — which is the only thing stored,
 * so that correcting a business's industry later swaps the defaults and
 * leaves every one of these words exactly where it is.
 *
 * `categories` is written too, as a COMPATIBILITY MIRROR. It is never
 * read back by this file once the model fields exist; it is there so a
 * client still running the previous bundle (a phone that has not picked
 * up the new service worker yet) keeps rendering the right list instead
 * of falling back to the fossil defaults.
 */
export function categoryWritePayload(nextNames, profileOrId) {
  const profile = typeof profileOrId === 'string' ? getProfile(profileOrId) : profileOrId;
  const defaults = Array.isArray(profile?.categories) ? [...profile.categories] : [];
  const next = sanitizeCategories(nextNames);
  const nextKeys = keySet(next);
  const defaultKeys = keySet(defaults);

  return {
    customCategories: next.filter((name) => !defaultKeys.has(categoryKey(name))),
    hiddenCategories: defaults.filter((name) => !nextKeys.has(categoryKey(name))),
    categoryOrder: next,
    categories: next,
  };
}

/**
 * What "reset my categories to the trade's defaults" writes. Clearing the
 * diff is the whole operation — and it is the only category write that
 * removes an owner's words, which is why it exists only behind an
 * explicit action and never happens as a side effect of anything else.
 */
export function resetCategoriesPayload() {
  return {
    customCategories: [],
    hiddenCategories: [],
    categoryOrder: [],
    categories: null,
  };
}
