// src/domain/fnb/production.js
//
// PRODUCTION — turning ingredients into finished goods, and costing the
// result honestly.
//
// FlowBiz already had a production run: pick a made-in-advance item, say
// how many, ingredients out and finished goods in, atomically. That part
// was right and is not being rebuilt. What it could not express is the
// three things that make a bakery a bakery rather than a shop that
// happens to own an oven:
//
//   YIELD. A dough makes twenty loaves. FlowBiz's recipe was per-loaf, so
//   a baker had to divide every ingredient by twenty in their head and
//   type the result. That is a data-entry trap with no error message: get
//   it wrong and every loaf's cost, margin and ingredient consumption is
//   wrong by the same factor, forever, silently.
//
//   SHORT YIELD. You plan twenty and get eighteen — two stuck to the tin.
//   The ingredients for twenty were still consumed. The correct unit cost
//   is therefore the batch cost over EIGHTEEN, not over twenty, and a
//   bakery that costs short yields at plan is understating what its bread
//   costs on every bad day. This is the single most common way a small
//   bakery's numbers drift from reality.
//
//   SHELF LIFE. Bread made on Monday is not the same stock as bread made
//   on Thursday, and it should not be sold in that order. FlowBiz already
//   has a correct model for dated stock sold earliest-first — the batch
//   ledger the pharmacy profile uses, with FEFO at the till and an expiry
//   screen. A production run of a product with a shelf life creates one
//   of those batches, dated. NO NEW ENTITY, because it is genuinely the
//   same behaviour: a lot of goods with a date, sold in date order.
//
// WHAT THIS IS STILL NOT. There is no work order, no production schedule,
// no shop floor, no routing, no capacity and no WIP. That is manufacturing
// ERP. A bakery of the size FlowBiz serves records what it baked, and this
// records what it baked.

import { roundMoney } from '../../utils/currency.js';
import { roundQuantity, DEFAULT_UNIT } from '../../industry/units.js';
import {
  isRecipeItem, isProducedInAdvance, resolveStockDeltas, validateComponentStock, recipeProblem,
  mergeDeltas, roundComponent,
} from '../../utils/inventory.js';
import { recipeYieldOf, recipeUnitCost } from './costing.js';
import { todayISO, isValidExpiryDate } from '../../utils/batches.js';

export const MAX_SHELF_LIFE_DAYS = 3650;

/**
 * How long this product stays sellable after it is made. Absent means no
 * shelf life is tracked, which is what every existing product has and
 * what every non-perishable should keep.
 */
export function shelfLifeDaysOf(product) {
  const value = Number(product?.shelfLifeDays);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(MAX_SHELF_LIFE_DAYS, Math.floor(value));
}

/** The date a batch made today goes out of date. */
export function expiryFromShelfLife(product, { producedOn = todayISO() } = {}) {
  const days = shelfLifeDaysOf(product);
  if (!days || !isValidExpiryDate(producedOn)) return null;
  const date = new Date(`${producedOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Only an item explicitly marked made-in-advance can be produced. */
export function isProducible(product) {
  return isRecipeItem(product) && isProducedInAdvance(product);
}

/**
 * PLAN A RUN. Everything the production screen needs to show before
 * anything is written, and everything the write needs afterwards, from
 * one pure function — so what a baker was shown and what was recorded
 * cannot differ.
 *
 * `batches` is how many times the recipe is run. `actualQuantity` is what
 * came out; leave it out and it is the planned yield, which is the
 * no-short-yield case and exactly the behaviour production had before.
 *
 * THE COSTING RULE, and it is the point of the whole function:
 *
 *     components consumed  = per-unit recipe × PLANNED quantity
 *     finished goods in    = ACTUAL quantity
 *     unit cost            = total component cost ÷ ACTUAL quantity
 *
 * Consumption follows the plan because the plan is what went into the
 * bowl. Cost follows the actual because the cost of the batch has to be
 * carried by the things that came out of it. Dividing by the plan instead
 * would leave the value of the two lost loaves in nothing at all — it
 * would simply vanish from the books, which is how a bakery ends up
 * unable to explain where its flour went.
 */
export function planProduction(product, products, {
  batches = 1,
  actualQuantity = null,
  producedOn = todayISO(),
} = {}) {
  const unit = product?.unit || DEFAULT_UNIT;
  const yieldPerBatch = recipeYieldOf(product);
  const runs = Math.max(0, Number(batches) || 0);
  const plannedQuantity = roundQuantity(runs * yieldPerBatch, unit);

  const actual = actualQuantity === null || actualQuantity === undefined || actualQuantity === ''
    ? plannedQuantity
    : roundQuantity(Number(actualQuantity) || 0, unit);

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const components = [];
  let componentCost = 0;

  for (const line of (product?.recipe || [])) {
    const perUnit = Number(line?.quantity) || 0;
    if (perUnit <= 0) continue;
    const componentProduct = byId.get(line?.componentId);
    const componentUnit = componentProduct?.unit || line?.unit || DEFAULT_UNIT;
    // Consumption follows the PLAN: the full recipe went in, whatever
    // came out of the oven. Tracked to component precision, so half an
    // egg per loaf is half an egg, not zero.
    const needed = roundComponent(plannedQuantity * perUnit);
    // A component MADE TO ORDER — a dough with no stock of its own — is
    // consumed through its own recipe, down to the flour. Checking or
    // deducting the dough's own stock number moved a figure nobody keeps.
    const nested = Boolean(componentProduct) && isRecipeItem(componentProduct) && !isProducedInAdvance(componentProduct);
    const available = nested ? null : roundComponent(Number(componentProduct?.stock) || 0);
    const unitCost = componentProduct
      ? (nested
          ? recipeUnitCost(componentProduct, products).cost
          : Math.max(0, Number(componentProduct.costPrice) || 0))
      : 0;
    const short = !componentProduct
      ? false
      : nested
        ? validateComponentStock([{ productId: componentProduct.id, quantity: needed }], products, { recipes: true }) !== null
        : needed > available;
    componentCost += needed * unitCost;
    components.push({
      componentId: line.componentId,
      componentName: componentProduct?.name || line?.componentName || 'Missing ingredient',
      unit: componentUnit,
      quantity: needed,
      available,
      nested,
      unitCost: roundMoney(unitCost),
      lineCost: roundMoney(needed * unitCost),
      missing: !componentProduct || componentProduct.deleted === true,
      short,
    });
  }

  const totalCost = roundMoney(componentCost);
  const unitCost = actual > 0 ? roundMoney(totalCost / actual) : 0;
  const producible = isProducible(product);
  const yieldVariance = roundQuantity(actual - plannedQuantity, unit);

  return {
    product,
    producible,
    unit,
    yieldPerBatch,
    batches: runs,
    plannedQuantity,
    quantity: actual,
    yieldVariance,
    yieldPercent: plannedQuantity > 0 ? roundMoney((actual / plannedQuantity) * 100) : null,
    components,
    totalCost,
    unitCost,
    // The value of what did not come out of the oven, carried by what did.
    shortYieldCost: yieldVariance < 0 ? roundMoney(-yieldVariance * unitCost) : 0,
    shortfall: components.some((c) => c.short),
    missing: components.some((c) => c.missing),
    // Missing ingredients, a circular recipe, or one nested too deep: a
    // run that cannot be costed or consumed honestly is not recorded.
    problem: product ? recipeProblem(product, products) : null,
    expiryDate: expiryFromShelfLife(product, { producedOn }),
  };
}

/**
 * The stock movements a planned run implies, in the delta shape the one
 * inventory foundation produces and the one adapter writes.
 *
 * Built here rather than by resolveProductionDeltas() because that
 * function assumes finished-in equals recipe-out, which is exactly the
 * assumption short yield breaks. It is otherwise the identical shape and
 * goes through the identical writer, so there is still one answer to how
 * stock is written.
 */
export function productionDeltas(plan, products = []) {
  const deltas = {};
  // NOTHING IS PRODUCED THAT IS NOT MADE. A product with no recipe has
  // nothing to consume, so adding to its stock here would create it out
  // of nothing — the same class of error as deducting from something that
  // has no stock, and the reason the one inventory foundation refuses
  // that too. The screen only offers producible items; this is the guard
  // on the WRITE, which is where it has to be.
  //
  // NOR IS ANYTHING PRODUCED FROM INGREDIENTS THAT DO NOT EXIST. A run
  // with a missing component used to add twenty finished loaves and take
  // nothing for the missing flour, at a computed cost of zero.
  if (!plan?.product || !isProducible(plan.product)) return deltas;
  if (plan.missing || plan.problem) return deltas;
  if (plan.plannedQuantity <= 0 && plan.quantity <= 0) return deltas;

  // A batch that came out at NOTHING still used its ingredients. It adds
  // no finished goods, but the flour is gone all the same.
  if (plan.quantity > 0) deltas[plan.product.id] = { total: plan.quantity, variants: {}, batches: {} };

  for (const component of plan.components) {
    if (component.missing || component.quantity <= 0) continue;
    if (component.nested) {
      // Down through the component's own recipe, exactly as a sale of it
      // would consume it.
      mergeDeltas(deltas, resolveStockDeltas(
        [{ productId: component.componentId, quantity: component.quantity }],
        products,
        { recipes: true }
      ));
      continue;
    }
    const existing = deltas[component.componentId] || { total: 0, variants: {}, batches: {} };
    existing.total = roundComponent(existing.total - component.quantity);
    deltas[component.componentId] = existing;
  }
  return deltas;
}

/** The production run document. Additive: every new field is optional. */
export function buildProductionRecord(plan, {
  note = '', producedBy = null, producedByName = null, at = new Date(),
} = {}) {
  const record = {
    productId: plan.product.id,
    productName: plan.product.name,
    quantity: plan.quantity,
    unitCost: plan.unitCost,
    totalCost: plan.totalCost,
    components: plan.components
      .filter((c) => c.quantity > 0)
      .map((c) => ({
        componentId: c.componentId,
        componentName: c.componentName,
        quantity: c.quantity,
        ...(c.unit !== DEFAULT_UNIT ? { unit: c.unit } : {}),
      })),
    note: String(note || '').trim().slice(0, 300),
    producedBy,
    producedByName,
    producedAt: at,
  };
  if (plan.unit !== DEFAULT_UNIT) record.unit = plan.unit;
  // Only carried when the recipe actually has a yield, or the run came out
  // short. With a yield of one, "three batches" and "three units" are the
  // same number said twice, so a run recorded the simple way stays the
  // document it always was.
  if (plan.yieldPerBatch !== 1) {
    record.batches = plan.batches;
    record.yieldPerBatch = plan.yieldPerBatch;
  }
  if (plan.plannedQuantity !== plan.quantity) {
    record.plannedQuantity = plan.plannedQuantity;
    record.yieldVariance = plan.yieldVariance;
  }
  return record;
}

/** How a run's yield compared with its plan, across a period. */
export function summarizeYield(runs) {
  let planned = 0;
  let actual = 0;
  let shortCost = 0;
  for (const run of runs || []) {
    const made = Number(run?.quantity) || 0;
    const plan = Number(run?.plannedQuantity);
    const expected = Number.isFinite(plan) && plan > 0 ? plan : made;
    planned += expected;
    actual += made;
    if (made < expected) shortCost += (expected - made) * (Number(run?.unitCost) || 0);
  }
  return {
    plannedQuantity: roundQuantity(planned, 'metre'),
    actualQuantity: roundQuantity(actual, 'metre'),
    yieldPercent: planned > 0 ? roundMoney((actual / planned) * 100) : null,
    shortYieldCost: roundMoney(shortCost),
    runs: (runs || []).length,
  };
}
