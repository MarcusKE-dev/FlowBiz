// src/industry/expenseCategories.js
//
// WHAT AN EXPENSE CATEGORY LIST IS MADE OF.
//
// Until now there was no list: `EXPENSE_CATEGORIES` was a frozen array in
// src/constants/categories.js, the Expenses page mapped over it, and a
// shop that spends money on something FlowBiz had not thought of ("Water",
// "M-Pesa charges", "Boda") had nowhere to put it. Filing everything under
// "Other" is not a category system.
//
// This is the same two-part model the PRODUCT categories already use (see
// categories.js), and deliberately so — one idea, one shape, one set of
// bugs already found:
//
//   FLOWBIZ'S DEFAULTS — the starting list. They are code, never data, so
//   the list can be corrected for everyone without touching a document.
//   Unlike product categories they are NOT per-trade: rent, electricity
//   and wages are what a shop spends money on whether it sells hardware
//   or haircuts.
//
//   THE BUSINESS'S OWN WORDS — categories an owner typed, and defaults an
//   owner took off. They belong to the BUSINESS, expenses already point
//   at them, and nothing here may ever delete or rewrite one.
//
// So the stored shape is the second half only, expressed as a diff:
//
//     customExpenseCategories  — words the owner added
//     hiddenExpenseCategories  — defaults the owner took off the list
//     expenseCategoryOrder     — the running order the owner arranged
//
// and the effective list is derived:
//
//     defaults − hidden  +  custom,  arranged by order
//
// It rides on the businessSettings document the app already holds one
// shared listener on, so a manageable list costs ZERO extra reads and
// zero extra listeners.
//
// AN EXPENSE THAT ALREADY EXISTS IS NEVER TOUCHED. Removing a category
// takes the word off the list a new expense can be filed under; the
// expenses already filed under it keep their `category` string exactly as
// recorded, and every report still counts them, because reports sum
// `amount` and never join against this list.

import { sanitizeCategories, categoryKey, MAX_CATEGORY_LENGTH } from './categories.js';

/**
 * The starting list. This is the array that used to live in
 * src/constants/categories.js, unchanged, so every business that has
 * never opened the new section sees exactly the list it saw before.
 *
 * 'Stock Purchase' and 'Supplier Payment' are deliberately absent: those
 * two are written automatically by the purchase and supplier-payment
 * flows and are excluded from Total Expenses to stop double-counting
 * (see isExpenseExcluded in utils/financials.js). Offering them here
 * would let an owner hand-enter the one thing the engine is built to
 * ignore.
 */
export const DEFAULT_EXPENSE_CATEGORIES = Object.freeze([
  'Rent', 'Electricity', 'Transport', 'Wages',
  'Airtime Float', 'Shop Supplies', 'Security', 'County Fees', 'Other',
]);

export const MAX_EXPENSE_CATEGORIES = 40;
export const MAX_EXPENSE_CATEGORY_LENGTH = MAX_CATEGORY_LENGTH;

/**
 * The two words a shop must not be able to file an expense under by hand,
 * because the engine writes them itself and then excludes them. Matching
 * is on the same case- and space-insensitive key everything else uses.
 */
const RESERVED = new Set(['stock purchase', 'supplier payment'].map(categoryKey));

export function isReservedExpenseCategory(name) {
  return RESERVED.has(categoryKey(name));
}

function keySet(names) {
  return new Set(names.map(categoryKey));
}

/** Has this business been stored in the model at all? */
function hasStoredModel(settings) {
  return Array.isArray(settings?.customExpenseCategories)
    || Array.isArray(settings?.hiddenExpenseCategories)
    || Array.isArray(settings?.expenseCategoryOrder);
}

/**
 * The whole expense-category picture for one business, in one object.
 *
 * PURE and TOTAL, like the rest of this layer: the input is the
 * businessSettings document, and hostile or malformed input degrades to
 * the default list rather than throwing or blanking the dropdown. A
 * business that ends up with an empty effective list would have an
 * expense form it cannot submit, so the defaults are the floor.
 */
export function resolveExpenseCategoryModel(settings) {
  const defaults = [...DEFAULT_EXPENSE_CATEGORIES];
  const defaultKeys = keySet(defaults);

  const stored = hasStoredModel(settings)
    ? {
        custom: sanitizeCategories(settings.customExpenseCategories),
        hidden: sanitizeCategories(settings.hiddenExpenseCategories),
        order: sanitizeCategories(settings.expenseCategoryOrder),
      }
    : { custom: [], hidden: [], order: [] };

  // A "custom" word FlowBiz already ships is not custom, and one of the
  // two reserved words is never offered however it got stored.
  const custom = stored.custom.filter(
    (name) => !defaultKeys.has(categoryKey(name)) && !isReservedExpenseCategory(name)
  );
  const hiddenKeys = keySet(stored.hidden);

  const shownDefaults = defaults.filter((name) => !hiddenKeys.has(categoryKey(name)));
  const pool = [...shownDefaults, ...custom].slice(0, MAX_EXPENSE_CATEGORIES);

  // Arrange: what the owner ordered first, in their order; anything they
  // have never seen (a default FlowBiz added, a word typed on another
  // device) appended rather than lost.
  const byKey = new Map(pool.map((name) => [categoryKey(name), name]));
  const list = [];
  const placed = new Set();
  for (const name of stored.order) {
    const key = categoryKey(name);
    if (!byKey.has(key) || placed.has(key)) continue;
    placed.add(key);
    list.push(byKey.get(key));
  }
  for (const name of pool) {
    const key = categoryKey(name);
    if (placed.has(key)) continue;
    placed.add(key);
    list.push(name);
  }

  // An empty list is an unusable expense form. Nothing an owner can do on
  // the Customize page produces one (the last category cannot be removed),
  // but a hand-edited or imported document could, so the floor is here
  // rather than in the screen that happens to be careful.
  const expenseCategories = list.length > 0 ? list : defaults;

  return {
    defaultExpenseCategories: defaults,
    hiddenExpenseCategories: stored.hidden,
    customExpenseCategories: custom,
    expenseCategories,
    usesDefaultExpenseCategories:
      custom.length === 0
      && shownDefaults.length === defaults.length
      && expenseCategories.every((name, i) => name === defaults[i]),
  };
}

/**
 * The fields a change to the list must write: the DIFF against FlowBiz's
 * defaults, never a frozen copy of the whole list, so a later correction
 * to the defaults reaches every business that has not overridden them.
 */
export function expenseCategoryWritePayload(nextNames) {
  const defaults = [...DEFAULT_EXPENSE_CATEGORIES];
  const next = sanitizeCategories(nextNames)
    .filter((name) => !isReservedExpenseCategory(name))
    .slice(0, MAX_EXPENSE_CATEGORIES);
  const nextKeys = keySet(next);
  const defaultKeys = keySet(defaults);

  return {
    customExpenseCategories: next.filter((name) => !defaultKeys.has(categoryKey(name))),
    hiddenExpenseCategories: defaults.filter((name) => !nextKeys.has(categoryKey(name))),
    expenseCategoryOrder: next,
  };
}

/** What "put my expense categories back" writes: clearing the diff. */
export function resetExpenseCategoriesPayload() {
  return {
    customExpenseCategories: [],
    hiddenExpenseCategories: [],
    expenseCategoryOrder: [],
  };
}
