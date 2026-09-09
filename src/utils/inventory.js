// src/utils/inventory.js
//
// ONE inventory foundation.
//
// Every industry capability that touches stock arrives here rather than
// growing its own engine: variants take from a version, recipes take from
// components, services take nothing, batches (pharmacy) take from the
// earliest-expiring lot. The counter, the order screen and anything else
// that turns a cart into a sale asks this one function what to move, and
// writes the answer as Firestore `increment()` operations inside the same
// batch as the sale document.
//
// The output shape is deliberately dumb — a map of field deltas — so that
// the caller does no thinking and there is nothing to get out of step:
//
//   { [productId]: { total: -3, variants: { 'black__m': -3 }, batches: { … } } }
//
// Two rules the whole file exists to enforce:
//
//   NOTHING IS DEDUCTED TWICE. A recipe item deducts its components and
//   NOT itself; a produced item (a bakery loaf baked this morning) deducts
//   itself and NOT its components, because its components were already
//   taken at production time. Getting this wrong double-counts flour.
//
//   NOTHING IS DEDUCTED THAT HAS NO STOCK. A service, and a menu item with
//   a recipe, have no meaningful `stock` of their own; writing an
//   increment against them would drive a number nobody reads steadily
//   negative and then surface it in inventory valuation.

import { roundQuantity, DEFAULT_UNIT } from '../industry/units.js';
import { hasVariants } from './variants.js';

/**
 * A service: something sold, priced and receipted like anything else,
 * that has no physical stock. A haircut does not run out.
 *
 * Absent `kind` means 'product', so every product written before the
 * services capability existed reads correctly and unchanged.
 */
export function isService(product) {
  return product?.kind === 'service';
}

/**
 * Should this product appear in stock counts, low-stock alerts and
 * inventory valuation? A service has nothing to count; a dish assembled
 * to order has no stock of its own (its ingredients do, and they are
 * counted in their own right).
 */
export function isStockItem(product) {
  return tracksOwnStock(product);
}

/** A product whose stock is consumed through its components instead. */
export function isRecipeItem(product) {
  return Array.isArray(product?.recipe) && product.recipe.length > 0;
}

/**
 * A recipe item that is MADE IN ADVANCE. Its components were consumed by
 * a production run, so selling it takes from its own finished-goods
 * stock. This is the bakery case, and it is the difference between a
 * loaf on a shelf and a burger assembled to order.
 */
export function isProducedInAdvance(product) {
  return isRecipeItem(product) && product.producedInAdvance === true;
}

/** Does this product have its own stock number that a sale should move? */
export function tracksOwnStock(product) {
  if (!product) return false;
  if (product.kind === 'service') return false;
  if (isRecipeItem(product) && !isProducedInAdvance(product)) return false;
  return true;
}

// ── Pack sizes ───────────────────────────────────────────────────────
//
// A product may be RECEIVED in one unit and SOLD in another:
//
//   pharmacy  a box of 30 tablets  → a single tablet
//   bar       a 750ml bottle       → a 30ml tot (25 of them)
//   wines     a crate of 24        → a single bottle
//
// The rule that keeps this from becoming a second inventory engine:
// STOCK IS HELD IN ONE BASE UNIT PER PRODUCT, and the base unit is the
// one it is SOLD in. `packSize` says how many of those come in one pack,
// and `packUnit` is what the pack is called.
//
//   product.unit      'tablet' as `piece`, `bottle`, `tot`   ← stock lives here
//   product.packUnit  'box', 'crate', 'bottle'
//   product.packSize  30, 24, 25
//
// Conversion therefore happens in exactly one direction — packs into base
// units — and only where a quantity was ENTERED in packs. A sale needs no
// conversion at all, because a sale is always in the unit the shop sells
// in. That is why this is thirty lines inside the existing resolver
// rather than a parallel path, and why nothing that does not use it can
// be affected by it.
//
// Both fields are optional with safe defaults: a product with no
// `packSize` has a pack size of one, which is the identity conversion, so
// every product written before this existed behaves exactly as it did.

export const MAX_PACK_SIZE = 10000;

/**
 * How many base units are in one pack. Always at least 1, never NaN and
 * never unbounded — this multiplies a quantity that ends up in a stock
 * figure, so a hostile or fat-fingered value must not be able to move
 * stock by an absurd amount.
 */
export function packSizeOf(product) {
  const size = Number(product?.packSize);
  if (!Number.isFinite(size) || size <= 1) return 1;
  return Math.min(MAX_PACK_SIZE, size);
}

/** Does this product actually come in packs? */
export function hasPackSize(product) {
  return packSizeOf(product) > 1;
}

/** What one pack is called — "box", "crate", "bottle". */
export function packUnitOf(product) {
  return typeof product?.packUnit === 'string' && product.packUnit ? product.packUnit : null;
}

/**
 * Convert a quantity into the product's base unit.
 *
 * `pack: true` means the number was entered in PACKS — three crates, two
 * boxes — and must be multiplied out. Anything else is already in base
 * units and passes through untouched, which is every sale and every
 * product that has no pack size.
 *
 * The multiplication happens BEFORE the base-unit rounding, so a partial
 * pack lands on a whole sellable thing: half a crate of 25 is 12 bottles,
 * not 12.5, because `piece`, `bottle` and `tot` all carry zero decimals
 * and roundQuantity truncates them. That is the correct answer — you
 * cannot put half a bottle on a shelf.
 */
export function toBaseQuantity(product, quantity, { pack = false, packSizes = false } = {}) {
  const unit = product?.unit || DEFAULT_UNIT;
  const value = Number(quantity) || 0;
  if (!pack || !packSizes) return roundQuantity(value, unit);
  return roundQuantity(value * packSizeOf(product), unit);
}

/**
 * The reverse, for display only: "60 tablets (2 boxes)". Never used to
 * compute a stock figure — stock is always the base number — so a
 * remainder that does not divide evenly is simply shown as a remainder
 * rather than rounded into a lie.
 */
export function describePacks(product, baseQuantity) {
  const size = packSizeOf(product);
  const packUnit = packUnitOf(product);
  if (size <= 1 || !packUnit) return null;
  const total = Number(baseQuantity) || 0;
  const packs = Math.floor(total / size);
  const loose = roundQuantity(total - packs * size, product?.unit || DEFAULT_UNIT);
  return { packs, loose, packSize: size, packUnit };
}

function ensure(deltas, productId) {
  if (!deltas[productId]) deltas[productId] = { total: 0, variants: {}, batches: {} };
  return deltas[productId];
}

function take(deltas, product, quantity, { variantId = null, batchId = null } = {}) {
  const unit = product?.unit || DEFAULT_UNIT;
  const entry = ensure(deltas, product.id);
  entry.total = roundQuantity(entry.total - quantity, unit);
  if (variantId && hasVariants(product)) {
    entry.variants[variantId] = roundQuantity((entry.variants[variantId] || 0) - quantity, unit);
  }
  if (batchId) {
    entry.batches[batchId] = roundQuantity((entry.batches[batchId] || 0) - quantity, unit);
  }
}

// The recursion in resolveStockDeltas() below stops at this level, so a
// caller loading products on demand never has to look deeper either.
export const MAX_RECIPE_DEPTH = 3;

/**
 * The products whose recipe uses this one as a component.
 *
 * Archiving or deleting a component is not a self-contained act: the
 * products built from it keep pointing at an id that no longer resolves,
 * and resolveStockDeltas() skips a component it cannot find rather than
 * failing loudly. A restaurant that archives "Beef patty" therefore goes
 * on selling cheeseburgers that deduct nothing at all — silent, and only
 * discovered at the next stock take.
 *
 * So callers ASK before removing, and tell the owner what would break.
 * A product made in advance is included too: its components are consumed
 * by production runs, which have the same dangling-reference problem.
 */
export function recipeDependents(productId, products) {
  if (!productId) return [];
  return (products || []).filter((product) => (
    product?.id !== productId
    && isRecipeItem(product)
    && product.recipe.some((component) => component?.componentId === productId)
  ));
}

/**
 * The component products a set of already-loaded products still needs
 * before resolveStockDeltas() can see them.
 *
 * This exists because resolveStockDeltas() is a PURE function over the
 * products it is handed: a component it cannot find in `products` is
 * silently skipped, and the shop's ingredients quietly never move. Every
 * screen that keeps the whole catalogue in a listener — the counter, the
 * dashboard, returns — is fine by accident. A screen that fetches only
 * the products named on a document (CustomerDetail, restoring stock on a
 * cancelled or refunded credit sale) is NOT, and this is what closes
 * that gap.
 *
 * Only made-to-order recipe items are expanded. One made in advance sells
 * from its own finished-goods stock, so its components are not touched by
 * the sale and must not be touched by the reversal either.
 *
 * @param products  products already loaded (one round's worth)
 * @param loadedIds every id already loaded, so nothing is fetched twice
 * @returns component ids not yet loaded, in no particular order
 */
export function missingComponentIds(products, loadedIds = new Set()) {
  const missing = new Set();
  for (const product of products || []) {
    if (!isRecipeItem(product) || isProducedInAdvance(product)) continue;
    for (const component of product.recipe) {
      const id = component?.componentId;
      if (!id || loadedIds.has(id) || (Number(component?.quantity) || 0) <= 0) continue;
      missing.add(id);
    }
  }
  return [...missing];
}

/**
 * Work out every stock movement a set of cart rows implies.
 *
 * `rows` are cart rows or stored line items — both carry productId,
 * quantity, and optionally variantId and batchAllocations.
 *
 * `options.recipes` gates COMPONENT CONSUMPTION only. Whether a menu item
 * has stock of its own is a property of the DATA, not of the toggle: a
 * burger assembled to order has no stock whether or not the shop is
 * currently tracking its ingredients. So with recipes off, selling one
 * moves nothing at all.
 *
 * That is the safe direction. The alternative — deducting the menu item's
 * own `stock` when recipes are off — would drive a field nobody maintains
 * steadily negative, and would then make the counter refuse to sell a
 * burger because a number that was never meant to mean anything hit zero.
 */
export function resolveStockDeltas(rows, products, {
  recipes = false, depth = 0, reverse = false, packSizes = false,
} = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const deltas = {};

  const consume = (product, quantity, row, level) => {
    if (!product || quantity <= 0) return;

    // A recipe item made to order takes from its components instead of
    // from itself. Bounded recursion, so a component that is itself a
    // recipe (a sauce made from ingredients) resolves, and a recipe that
    // somehow references itself terminates instead of hanging the till.
    if (recipes && isRecipeItem(product) && !isProducedInAdvance(product) && level < 3) {
      for (const component of product.recipe) {
        const componentProduct = byId.get(component?.componentId);
        if (!componentProduct) continue;
        const perUnit = Number(component?.quantity) || 0;
        if (perUnit <= 0) continue;
        const needed = roundQuantity(
          quantity * perUnit,
          componentProduct.unit || DEFAULT_UNIT
        );
        consume(componentProduct, needed, {}, level + 1);
      }
      if (level === 0 && Array.isArray(row?.modifiers)) {
        for (const mod of row.modifiers) {
          for (const line of Array.isArray(mod?.recipe) ? mod.recipe : []) {
            const compProduct = byId.get(line?.componentId);
            if (!compProduct) continue;
            const perUnit = Number(line?.quantity) || 0;
            if (perUnit === 0) continue;
            const deltaQty = roundQuantity(quantity * perUnit, compProduct.unit || DEFAULT_UNIT);
            if (deltaQty > 0) {
              consume(compProduct, deltaQty, {}, level + 1);
            } else if (deltaQty < 0) {
              const entry = ensure(deltas, compProduct.id);
              entry.total = roundQuantity(entry.total + Math.abs(deltaQty), compProduct.unit || DEFAULT_UNIT);
            }
          }
        }
      }
      return;
    }

    if (recipes && level === 0 && Array.isArray(row?.modifiers)) {
      for (const mod of row.modifiers) {
        for (const line of Array.isArray(mod?.recipe) ? mod.recipe : []) {
          const compProduct = byId.get(line?.componentId);
          if (!compProduct) continue;
          const perUnit = Number(line?.quantity) || 0;
          if (perUnit === 0) continue;
          const deltaQty = roundQuantity(quantity * perUnit, compProduct.unit || DEFAULT_UNIT);
          if (deltaQty > 0) {
            consume(compProduct, deltaQty, {}, level + 1);
          } else if (deltaQty < 0) {
            const entry = ensure(deltas, compProduct.id);
            entry.total = roundQuantity(entry.total + Math.abs(deltaQty), compProduct.unit || DEFAULT_UNIT);
          }
        }
      }
    }

    if (!tracksOwnStock(product)) return;

    const allocations = Array.isArray(row?.batchAllocations) ? row.batchAllocations : null;
    if (allocations && allocations.length > 0) {
      for (const allocation of allocations) {
        const allocated = roundQuantity(Number(allocation?.quantity) || 0, product.unit || DEFAULT_UNIT);
        if (allocated <= 0) continue;
        take(deltas, product, allocated, { variantId: row?.variantId, batchId: allocation.batchId });
      }
      return;
    }

    take(deltas, product, quantity, { variantId: row?.variantId });
  };

  for (const row of rows || []) {
    const product = byId.get(row?.productId);
    if (!product) continue;
    // A row that says it is counted in PACKS is multiplied out here, once,
    // at the boundary — so everything downstream, including recipes and
    // batch allocation, works in base units and knows nothing about packs.
    const quantity = toBaseQuantity(product, row?.quantity, { pack: row?.pack === true, packSizes });
    if (quantity <= 0) continue;
    consume(product, quantity, row, depth);
  }

  // A product that nets out to zero movement (added and removed in the
  // same cart) should not produce a pointless Firestore write.
  for (const [productId, entry] of Object.entries(deltas)) {
    const noVariantMovement = Object.values(entry.variants).every((v) => v === 0);
    const noBatchMovement = Object.values(entry.batches).every((v) => v === 0);
    if (entry.total === 0 && noVariantMovement && noBatchMovement) delete deltas[productId];
  }

  return reverse ? negateDeltas(deltas) : deltas;
}

/**
 * Flip every movement in a delta map. This is what a void, a cancelled
 * credit sale, a refund and a return all need, and it is a negation of
 * the SAME resolution rather than a second one — so putting stock back
 * always lands on the same version, the same batch and the same recipe
 * components the sale took it from.
 */
export function negateDeltas(deltas) {
  const out = {};
  for (const [productId, entry] of Object.entries(deltas || {})) {
    out[productId] = {
      total: entry.total === 0 ? 0 : -entry.total,
      variants: Object.fromEntries(
        Object.entries(entry.variants || {}).map(([id, value]) => [id, value === 0 ? 0 : -value])
      ),
      batches: Object.fromEntries(
        Object.entries(entry.batches || {}).map(([id, value]) => [id, value === 0 ? 0 : -value])
      ),
    };
  }
  return out;
}

/**
 * The movements RECEIVING stock implies — a purchase, in the same delta
 * shape a sale produces, so Purchases writes through the same engine the
 * counter does instead of its own raw increment.
 *
 * Recipes are deliberately never expanded here. Receiving 20 loaves adds
 * twenty loaves; it does not add the flour they were made from. And a
 * made-to-order menu item has no stock to receive, so `tracksOwnStock`
 * correctly refuses it rather than growing a number nobody reads.
 */
export function resolveReceiptDeltas(rows, products, { packSizes = false } = {}) {
  return resolveStockDeltas(rows, products, { recipes: false, reverse: true, packSizes });
}

/**
 * A STOCK TAKE is different arithmetic from every other movement in this
 * file: a sale says "move by −3", a count says "the shelf holds 9". The
 * delta is therefore counted-minus-system, and the system figure has to
 * come from the right place — the variant map for a version, the batch
 * ledger for a lot, and the product's own `stock` for everything else.
 *
 * Each row is `{ productId, variantId?, batchId?, counted, systemQuantity? }`,
 * and `counted` is ALWAYS in the product's base unit — you count the
 * bottles on the shelf, not the crates they arrived in — so pack sizes
 * play no part here.
 * A row with no `counted` value is one the shop left blank, and is not a
 * count of zero — it produces no movement at all.
 *
 * The invariant this exists to hold: after applying the result, the sum
 * of a product's variant quantities, and the sum of its batch remainders,
 * each still equal `product.stock`. A count that moved the product total
 * without moving the ledger behind it is what B4 was.
 */
export function resolveCountDeltas(rows, products, { batches = [] } = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const batchById = new Map((batches || []).map((b) => [b.id, b]));
  const deltas = {};

  for (const row of rows || []) {
    const product = byId.get(row?.productId);
    if (!product || !tracksOwnStock(product)) continue;
    if (row?.counted === undefined || row?.counted === null || row?.counted === '') continue;

    const unit = product.unit || DEFAULT_UNIT;
    const counted = roundQuantity(Number(row.counted) || 0, unit);
    if (counted < 0) continue;

    let system;
    if (row.batchId) {
      const batch = batchById.get(row.batchId);
      system = roundQuantity(
        Number(row.systemQuantity ?? batch?.remainingQuantity ?? batch?.quantity) || 0, unit
      );
    } else if (row.variantId) {
      system = roundQuantity(
        Number(row.systemQuantity ?? product.variantStock?.[row.variantId]) || 0, unit
      );
    } else {
      system = roundQuantity(Number(row.systemQuantity ?? product.stock) || 0, unit);
    }

    const difference = roundQuantity(counted - system, unit);
    if (difference === 0) continue;

    const entry = ensure(deltas, product.id);
    entry.total = roundQuantity(entry.total + difference, unit);
    if (row.variantId) {
      entry.variants[row.variantId] = roundQuantity((entry.variants[row.variantId] || 0) + difference, unit);
    }
    if (row.batchId) {
      entry.batches[row.batchId] = roundQuantity((entry.batches[row.batchId] || 0) + difference, unit);
    }
  }

  for (const [productId, entry] of Object.entries(deltas)) {
    const noVariantMovement = Object.values(entry.variants).every((v) => v === 0);
    const noBatchMovement = Object.values(entry.batches).every((v) => v === 0);
    if (entry.total === 0 && noVariantMovement && noBatchMovement) delete deltas[productId];
  }
  return deltas;
}

/**
 * Turn a delta map into the list of documents to touch and the numbers to
 * add to them — the ONE place that decides which field a movement lands
 * on. Deliberately pure and Firestore-free: it names collections, ids and
 * numeric field increments, and `utils/stockWrites.js` is the four-line
 * adapter that turns each number into a Firestore `increment()`.
 *
 * Keeping it pure is what lets every stock path in the application be
 * tested without a database, and is why there is now exactly one answer
 * to "what does moving stock write".
 */
export function stockWriteOps(deltas) {
  const ops = [];
  for (const [productId, entry] of Object.entries(deltas || {})) {
    const fields = {};
    if (entry.total !== 0) fields.stock = entry.total;
    for (const [variantId, value] of Object.entries(entry.variants || {})) {
      if (value !== 0) fields[`variantStock.${variantId}`] = value;
    }
    if (Object.keys(fields).length > 0) {
      ops.push({ collection: 'products', id: productId, fields });
    }
    for (const [batchId, value] of Object.entries(entry.batches || {})) {
      if (value === 0) continue;
      ops.push({ collection: 'productBatches', id: batchId, productId, fields: { remainingQuantity: value } });
    }
  }
  return ops;
}

/**
 * The stock movements a PRODUCTION run implies: the finished item gains,
 * every component loses. Used by the bakery workflow, and the exact
 * inverse of what selling a made-to-order recipe item would have done.
 */
export function resolveProductionDeltas(product, quantity, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const deltas = {};
  const made = roundQuantity(Number(quantity) || 0, product?.unit || DEFAULT_UNIT);
  if (!product || made <= 0 || !isRecipeItem(product)) return deltas;

  ensure(deltas, product.id).total = made;

  for (const component of product.recipe) {
    const componentProduct = byId.get(component?.componentId);
    if (!componentProduct) continue;
    const perUnit = Number(component?.quantity) || 0;
    if (perUnit <= 0) continue;
    const unit = componentProduct.unit || DEFAULT_UNIT;
    const used = roundQuantity(made * perUnit, unit);
    const entry = ensure(deltas, componentProduct.id);
    entry.total = roundQuantity(entry.total - used, unit);
  }
  return deltas;
}

/**
 * What a production run costs: the sum of its components at their current
 * cost prices, divided by the quantity made. Written onto the finished
 * item so gross profit on a loaf is the real cost of its flour, not a
 * number somebody typed once and forgot.
 */
export function productionUnitCost(product, quantity, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const made = Number(quantity) || 0;
  if (!isRecipeItem(product) || made <= 0) return 0;
  let total = 0;
  for (const component of product.recipe) {
    const componentProduct = byId.get(component?.componentId);
    if (!componentProduct) continue;
    total += (Number(component?.quantity) || 0) * (Number(componentProduct.costPrice) || 0);
  }
  // Per finished unit, rounded as money.
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

/**
 * Whether a set of rows can actually be made from what is on the shelf,
 * following recipes down to their components. Returns a message or null.
 */
export function validateComponentStock(rows, products, { recipes = false } = {}) {
  if (!recipes) return null;
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const deltas = resolveStockDeltas(rows, products, { recipes });
  for (const [productId, entry] of Object.entries(deltas)) {
    const product = byId.get(productId);
    if (!product || entry.total >= 0) continue;
    const unit = product.unit || DEFAULT_UNIT;
    const available = roundQuantity(Number(product.stock) || 0, unit);
    if (available + entry.total < 0) {
      return `Not enough ${product.name}. ${available} left, ${-entry.total} needed.`;
    }
  }
  return null;
}
