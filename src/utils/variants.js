// src/utils/variants.js
//
// Product variants — one product, many sizes and colours, each holding
// its own stock.
//
// SHAPE, and why it is this shape:
//
//   product.variantOptions  [{ name: 'Size', values: ['S','M','L'] }, …]
//   product.variants        [{ id, label, options, sellingPrice, costPrice, barcode }]
//   product.variantStock    { [variantId]: number }
//   product.stock           the TOTAL, kept in step with variantStock
//
// Variants are fields on the product, not documents in a collection.
// A separate collection would mean a second live listener over a
// boutique's whole catalogue, a second set of rules, and a join on every
// render of the counter — for data that is never read without its parent
// and is a few hundred bytes.
//
// Stock is a MAP rather than a number on each entry in `variants`,
// because Firestore can atomically `increment()` a nested map field
// (`variantStock.black-m`) but cannot increment a field inside an array
// element. That single constraint is the reason the definition and the
// quantity live apart. It is also what keeps a variant sale offline-safe
// and free of read-modify-write races between two tills.
//
// `product.stock` stays the total, and stays authoritative for everything
// that already reads it: low-stock alerts, inventory valuation, reports,
// the admin inspector, exports. Nothing outside this file and the counter
// needs to know variants exist.

import { roundQuantity, DEFAULT_UNIT } from '../industry/units.js';

export const MAX_OPTION_TYPES = 3;
export const MAX_VALUES_PER_OPTION = 30;
export const MAX_VARIANTS = 200;

/** Firestore map keys cannot carry a dot, and we want them URL-safe too. */
function slug(value) {
  return String(value ?? '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/**
 * A variant's id is derived from its option VALUES, in option order, so
 * it is stable across edits: renaming the product, reordering the value
 * list or changing a price never moves stock to a different variant.
 * Adding a new option type does change the ids — which is correct, since
 * "Black / M" and "Black / M / Cotton" are genuinely different variants.
 */
export function variantIdFor(optionValues) {
  const parts = (optionValues || []).map(slug).filter(Boolean);
  return parts.length > 0 ? parts.join('__') : 'default';
}

/**
 * Clean an option definition down to something that can be stored and
 * rendered. Bounded on every axis, because this is written by an owner
 * typing into a form and read by every device in the shop.
 */
export function normalizeVariantOptions(rawOptions) {
  const out = [];
  const seenNames = new Set();
  for (const option of Array.isArray(rawOptions) ? rawOptions : []) {
    if (out.length >= MAX_OPTION_TYPES) break;
    const name = String(option?.name ?? '').trim().slice(0, 24);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;

    const values = [];
    const seenValues = new Set();
    for (const raw of Array.isArray(option?.values) ? option.values : []) {
      if (values.length >= MAX_VALUES_PER_OPTION) break;
      const value = String(raw ?? '').trim().slice(0, 24);
      if (!value) continue;
      const valueKey = value.toLowerCase();
      if (seenValues.has(valueKey)) continue;
      seenValues.add(valueKey);
      values.push(value);
    }
    if (values.length === 0) continue;

    seenNames.add(key);
    out.push({ name, values });
  }
  return out;
}

function cartesian(lists) {
  return lists.reduce(
    (acc, list) => acc.flatMap((combo) => list.map((value) => [...combo, value])),
    [[]]
  );
}

/**
 * Build the full variant list from an option definition, carrying over
 * whatever was already set on a variant that still exists.
 *
 * This is the operation that must never lose stock. A boutique that adds
 * "XL" to its size list is not asking for its existing Black/M stock to
 * be reset, and a combination that DISAPPEARS from the definition keeps
 * its stock in `variantStock` rather than having it deleted — the same
 * rule the whole industry project follows: turning something off hides
 * it, it does not destroy it.
 */
export function generateVariants(rawOptions, previous = {}) {
  const options = normalizeVariantOptions(rawOptions);
  if (options.length === 0) return { options: [], variants: [], variantStock: { ...(previous.variantStock || {}) } };

  const previousById = new Map((previous.variants || []).map((v) => [v.id, v]));
  const combos = cartesian(options.map((option) => option.values)).slice(0, MAX_VARIANTS);

  const variants = combos.map((values) => {
    const id = variantIdFor(values);
    const optionMap = {};
    options.forEach((option, index) => { optionMap[option.name] = values[index]; });
    const existing = previousById.get(id);
    return {
      id,
      label: values.join(' / '),
      options: optionMap,
      sellingPrice: existing?.sellingPrice ?? null,
      costPrice: existing?.costPrice ?? null,
      barcode: existing?.barcode ?? null,
    };
  });

  // Every stock figure that was already recorded is carried through —
  // including for variants that no longer appear in the definition.
  const variantStock = { ...(previous.variantStock || {}) };
  for (const variant of variants) {
    if (variantStock[variant.id] === undefined) variantStock[variant.id] = 0;
  }

  return { options, variants, variantStock };
}

export function hasVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

/**
 * The variants a counter can actually sell, each resolved to its own
 * effective price, cost and stock. A variant with no price override
 * inherits the product's — which is how a boutique prices a whole rail of
 * t-shirts once and only overrides the one size that costs more.
 */
export function variantsOf(product) {
  if (!hasVariants(product)) return [];
  const stockMap = product.variantStock || {};
  const unit = product.unit || DEFAULT_UNIT;
  return product.variants.map((variant) => ({
    ...variant,
    sellingPrice: variant.sellingPrice ?? product.sellingPrice ?? 0,
    costPrice: variant.costPrice ?? product.costPrice ?? 0,
    barcode: variant.barcode || null,
    stock: roundQuantity(Number(stockMap[variant.id]) || 0, unit),
  }));
}

export function findVariant(product, variantId) {
  return variantsOf(product).find((variant) => variant.id === variantId) || null;
}

/**
 * The sum of every recorded variant quantity — INCLUDING orphans, i.e.
 * stock sitting against a combination that is no longer in the option
 * definition. That stock is still physically in the shop, so leaving it
 * out of the total would quietly understate inventory value.
 */
export function totalVariantStock(product) {
  const unit = product?.unit || DEFAULT_UNIT;
  const values = Object.values(product?.variantStock || {});
  return roundQuantity(values.reduce((sum, value) => sum + (Number(value) || 0), 0), unit);
}

/** Variant stock that no longer matches any defined combination. */
export function orphanedVariantStock(product) {
  if (!product?.variantStock) return [];
  const live = new Set((product.variants || []).map((v) => v.id));
  return Object.entries(product.variantStock)
    .filter(([id, quantity]) => !live.has(id) && (Number(quantity) || 0) !== 0)
    .map(([id, quantity]) => ({ id, quantity: Number(quantity) || 0 }));
}

/**
 * Match a scanned code against a product's variants. A boutique that
 * puts its own barcode on each size needs the scan to land on the size,
 * not on the parent product.
 */
export function findVariantByBarcode(products, code) {
  const needle = String(code ?? '').trim();
  if (!needle) return null;
  for (const product of products || []) {
    if (!hasVariants(product)) continue;
    for (const variant of product.variants) {
      if (variant.barcode && String(variant.barcode).trim() === needle) {
        return { product, variant: findVariant(product, variant.id) };
      }
    }
  }
  return null;
}
