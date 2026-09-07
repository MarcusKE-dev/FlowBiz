// src/domain/fnb/costing.js
//
// FOOD AND BEVERAGE COSTING — what a recipe costs, what a period should
// have used, what it actually used, and the gap between the two.
//
// TERMINOLOGY, deliberately the profession's and not an invented one.
// Every term below is the standard hospitality cost-control definition,
// because an owner comparing FlowBiz's food cost against the 28–35% their
// trade talks about has to be comparing the same number.
//
//   RECIPE COST        what one batch of a recipe costs in ingredients,
//                      at their current cost prices.
//   RECIPE UNIT COST   recipe cost ÷ yield. The cost of ONE finished
//                      thing. This is what a sale's COGS should be.
//   THEORETICAL USAGE  what the recipes say a period's sales and
//                      production ought to have consumed. Also called
//                      ideal usage.
//   ACTUAL USAGE       what really left the store, from the physical
//                      count. Includes everything theoretical usage
//                      cannot see: over-portioning, spillage, theft,
//                      unrecorded waste.
//   VARIANCE           actual minus theoretical. The whole reason a
//                      kitchen counts stock at all.
//   FOOD COST %        cost of goods sold ÷ NET SALES.
//   POUR COST %        the same ratio for drinks. A bar's name for it.
//
// TWO DELIBERATE OMISSIONS, both because the alternative would be a
// number that looks authoritative and is not.
//
//   NO LABOUR IN RECIPE COST. Recipe cost here is INGREDIENT cost, full
//   stop. Loading an allocated wage rate into a plate cost requires
//   scheduling, hours worked and a costing basis, none of which FlowBiz
//   has; a made-up per-plate labour figure would corrupt gross margin
//   everywhere it is read. Labour belongs in operating expenses, where
//   FlowBiz already records it, and that is where it stays.
//
//   NO STANDALONE PACKAGING COST FIELD. A takeaway box IS an ingredient
//   of a takeaway meal, and the recipe already models components. Adding
//   a parallel packaging-cost field would give two places to record the
//   same shilling and no rule for which one wins.
//
// EVERYTHING HERE IS PURE. The inputs are documents the app already
// listens to; there is no new collection behind any of it, and no figure
// is stored that could go stale against the records it came from.

import { roundMoney } from '../../utils/currency.js';
import { roundQuantity, DEFAULT_UNIT } from '../../industry/units.js';
import { isRecipeItem, isProducedInAdvance, resolveStockDeltas } from '../../utils/inventory.js';

/**
 * HOW MANY FINISHED THINGS ONE RUN OF THIS RECIPE MAKES.
 *
 * This is a DATA-ENTRY and COSTING concept, and it deliberately does not
 * change what a stored recipe line means. `recipe[].quantity` has always
 * been the amount of a component PER FINISHED UNIT and it still is, so
 * every recipe in every existing business keeps consuming exactly what it
 * consumed before this field existed.
 *
 * What yield adds is the ability to say the true thing — "this dough
 * makes 20 loaves" — at the point a baker enters it, and to cost a
 * production run against the batch that was actually run rather than
 * against a per-loaf figure that was reverse-engineered by hand.
 *
 * Absent, zero or malformed is a yield of one, which is the identity and
 * is exactly what every product written before today has.
 */
export function recipeYieldOf(product) {
  const value = Number(product?.recipeYield);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(10000, value);
}

export function hasRecipe(product) {
  return isRecipeItem(product);
}

/**
 * What ONE finished unit costs in ingredients, at their current cost
 * prices, following sub-recipes down.
 *
 * The recursion is bounded at the same depth the inventory foundation
 * uses, and for the same reason: a component that is itself made from
 * components (a sauce, a dough) has to resolve to a real cost, and a
 * recipe that somehow references itself has to terminate rather than hang
 * the screen a baker is standing in front of.
 *
 * A component whose product cannot be found contributes ZERO and is
 * reported by `missing`, rather than being silently skipped. A recipe
 * quietly costing less because an ingredient was archived is exactly the
 * kind of drift that makes an owner stop trusting the figure.
 */
export function recipeUnitCost(product, products, { depth = 0 } = {}) {
  if (!isRecipeItem(product) || depth > 3) return { cost: 0, missing: [] };
  const byId = new Map((products || []).map((p) => [p.id, p]));
  let cost = 0;
  const missing = [];

  for (const component of product.recipe) {
    const perUnit = Number(component?.quantity) || 0;
    if (perUnit <= 0) continue;
    const componentProduct = byId.get(component?.componentId);
    if (!componentProduct) {
      missing.push(component?.componentName || component?.componentId || 'Unknown ingredient');
      continue;
    }
    // A component that is itself made to order is costed from ITS
    // components. One made in advance carries a real cost price that a
    // production run wrote, so that price is the right one to use.
    const componentCost = (isRecipeItem(componentProduct) && !isProducedInAdvance(componentProduct))
      ? recipeUnitCost(componentProduct, products, { depth: depth + 1 }).cost
      : Math.max(0, Number(componentProduct.costPrice) || 0);
    cost += perUnit * componentCost;
  }
  return { cost: roundMoney(cost), missing };
}

/**
 * THE COST OF THE CHOICES ON A LINE, per unit.
 *
 * A modifier option may carry signed recipe adjustments — oat milk
 * instead of cow's milk, an extra shot, no bacon — and those change what
 * the drink COSTS as well as what it is charged. Positive adjustments add
 * their component's cost, negative ones take it off, and the result may
 * legitimately be negative: a flat white with no syrup costs the house
 * less to make than one with.
 */
export function modifierUnitCost(modifiers, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  let cost = 0;
  for (const modifier of modifiers || []) {
    for (const line of modifier?.recipe || []) {
      const quantity = Number(line?.quantity) || 0;
      if (quantity === 0) continue;
      const component = byId.get(line?.componentId);
      if (!component) continue;
      const unitCost = (isRecipeItem(component) && !isProducedInAdvance(component))
        ? recipeUnitCost(component, products).cost
        : Math.max(0, Number(component.costPrice) || 0);
      cost += quantity * unitCost;
    }
  }
  return roundMoney(cost);
}

/**
 * WHAT ONE UNIT OF THIS LINE ACTUALLY COST THE BUSINESS — the figure the
 * till must write onto a sale, and this function is a BUG FIX.
 *
 * FlowBiz rang every line up at the product's stored `costPrice`. For a
 * tin of beans that is right and always was. For a dish assembled to
 * order it is meaningless — its cost lives in its components, and
 * `menuItemMargin()` two functions up says so in as many words — and yet
 * the sale path used the stored field anyway. The consequence was not
 * cosmetic:
 *
 *   * the buying-price box was REQUIRED on the product form, so an owner
 *     entering "Chicken burger" had to invent a supplier price for
 *     something no supplier sells;
 *   * whatever they invented became the line cost on every sale of it,
 *     and therefore cost of goods sold, gross profit, margin, food cost
 *     percentage, close of day and every report built on them;
 *   * ingredient prices could move all year and not one sale noticed.
 *
 * A dish is now costed from its recipe at the moment it is rung, at the
 * ingredient prices of that moment, and the figure is SNAPSHOTTED onto
 * the line exactly as the price is — so a sale from March keeps saying
 * what March's beef cost after beef moves in April.
 *
 * An item MADE IN ADVANCE keeps its stored cost price, and that is not an
 * inconsistency: a production run wrote that number from the ingredients
 * that actually went into the batch, which is a better answer than
 * re-deriving it from today's prices. Bought-in goods keep theirs for the
 * obvious reason. A version carries its own.
 */
export function sellingUnitCost(product, products, { variant = null, modifiers = null } = {}) {
  const base = (isRecipeItem(product) && !isProducedInAdvance(product))
    ? recipeUnitCost(product, products).cost
    : Math.max(0, Number(variant?.costPrice ?? product?.costPrice) || 0);
  // Never below zero: a stack of "remove" choices must not make a line
  // that earns more than it is charged for.
  return Math.max(0, roundMoney(base + modifierUnitCost(modifiers, products)));
}

/** What one full batch of this recipe costs: unit cost × yield. */
export function recipeBatchCost(product, products) {
  const { cost, missing } = recipeUnitCost(product, products);
  return { cost: roundMoney(cost * recipeYieldOf(product)), unitCost: cost, missing };
}

/**
 * The gross margin a menu item is actually earning, at today's ingredient
 * prices rather than at whatever cost was typed when it was created.
 *
 * This is the single most useful number a menu has, and FlowBiz could not
 * produce it: a dish's stored `costPrice` is meaningless for a
 * made-to-order item, because its cost lives in its components.
 */
export function menuItemMargin(product, products) {
  const price = Math.max(0, Number(product?.sellingPrice ?? product?.price) || 0);
  const cost = isRecipeItem(product) && !isProducedInAdvance(product)
    ? recipeUnitCost(product, products).cost
    : Math.max(0, Number(product?.costPrice) || 0);
  const margin = roundMoney(price - cost);
  return {
    price,
    cost,
    margin,
    marginPercent: price > 0 ? roundMoney((margin / price) * 100) : 0,
    // The kitchen's own ratio, the one benchmarks are quoted against.
    costPercent: price > 0 ? roundMoney((cost / price) * 100) : 0,
  };
}

/**
 * A recipe line whose quantity cannot be represented in its component's
 * unit, and therefore silently rounds away at every sale.
 *
 * THIS IS A REAL DEFECT THIS FUNCTION EXISTS TO SURFACE. Stock movements
 * are rounded to the component unit's own precision, and a unit with zero
 * decimals TRUNCATES. A cocktail specified as 1.5 tots of gin therefore
 * deducted ONE tot on every sale, and a third of every measure poured
 * simply never appeared in the books — invisible until a stock take, and
 * indistinguishable from theft when it did.
 *
 * The unit catalogue was corrected so a measured pour can carry a
 * fraction, and this check catches the general case for every unit,
 * at the moment somebody is typing the recipe and can fix it.
 */
export function recipePrecisionWarnings(product, products) {
  if (!isRecipeItem(product)) return [];
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const warnings = [];
  for (const component of product.recipe) {
    const perUnit = Number(component?.quantity) || 0;
    if (perUnit <= 0) continue;
    const componentProduct = byId.get(component?.componentId);
    if (!componentProduct) continue;
    const unit = componentProduct.unit || DEFAULT_UNIT;
    const rounded = roundQuantity(perUnit, unit);
    if (rounded !== perUnit) {
      warnings.push({
        componentId: componentProduct.id,
        componentName: componentProduct.name,
        entered: perUnit,
        used: rounded,
        unit,
      });
    }
  }
  return warnings;
}

// ── Usage and variance ───────────────────────────────────────────────

function addUsage(map, productId, quantity, unit) {
  const existing = map.get(productId) || 0;
  map.set(productId, roundQuantity(existing + quantity, unit));
}

/**
 * THEORETICAL USAGE — what a period's sales and production runs say
 * should have come out of the store, ingredient by ingredient.
 *
 * Two sources, and they must not overlap:
 *
 *   SALES of made-to-order items consume their components at the moment
 *   they are sold. Resolved through the ONE inventory foundation, with
 *   recipes on, so theoretical usage is by construction the same
 *   arithmetic the till actually performed. A report that computed this
 *   its own way would eventually disagree with the stock it is
 *   reconciling, and nobody would be able to say which was right.
 *
 *   PRODUCTION RUNS consume their components when the batch is made. An
 *   item made in advance therefore contributes through its production
 *   run and NOT through its sale — deducting flour in both places is the
 *   double-count the whole made-in-advance distinction exists to prevent,
 *   and it would be just as wrong here as it is at the till.
 */
export function theoreticalUsage({ sales = [], productions = [], products = [] } = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const usage = new Map();

  const lineItems = [];
  for (const sale of sales) {
    if (sale?.isVoided) continue;
    for (const item of Array.isArray(sale?.items) ? sale.items : []) lineItems.push(item);
  }
  const deltas = resolveStockDeltas(lineItems, products, { recipes: true });
  for (const [productId, entry] of Object.entries(deltas)) {
    const product = byId.get(productId);
    if (entry.total >= 0) continue;
    addUsage(usage, productId, -entry.total, product?.unit || DEFAULT_UNIT);
  }

  for (const run of productions) {
    for (const component of Array.isArray(run?.components) ? run.components : []) {
      const quantity = Number(component?.quantity) || 0;
      if (quantity <= 0) continue;
      const product = byId.get(component?.componentId);
      addUsage(usage, component.componentId, quantity, product?.unit || component?.unit || DEFAULT_UNIT);
    }
  }

  return usage;
}

/**
 * VARIANCE — everything that left the store in a period and was not sold.
 *
 * WHAT THIS CAN AND CANNOT KNOW, stated plainly because a variance report
 * that overstates its own certainty is worse than none.
 *
 * A textbook actual-usage figure is `opening + purchases − closing`, and
 * it needs a valued stock position at two points in time. FlowBiz stores
 * a CURRENT stock level, not a history of it, so that figure cannot be
 * reconstructed for an arbitrary past period without inventing numbers.
 *
 * What FlowBiz does have is every movement that is not a sale, recorded
 * as it happened: waste records, and the differences found at a stock
 * take. Together those ARE the variance — they are precisely the stock
 * that went missing against what the recipes expected — and they are
 * measured rather than derived. So:
 *
 *   RECORDED WASTE       loss somebody wrote down, with a reason.
 *   UNACCOUNTED LOSS     the shortfall a physical count found on top of
 *                        that. Over-pouring, breakage nobody logged,
 *                        theft, and recipes that do not match the plate.
 *   VARIANCE             the two together.
 *   VARIANCE %           variance ÷ theoretical usage.
 *
 * A count that finds MORE than the system expected is carried as a
 * negative unaccounted loss rather than being clamped to zero: found
 * stock is a genuine signal, and usually means an earlier delivery or
 * production run was never recorded.
 */
export function usageVariance({
  sales = [], productions = [], wasteRecords = [], stockAdjustments = [], products = [],
} = {}) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const theoretical = theoreticalUsage({ sales, productions, products });

  const waste = new Map();
  for (const record of wasteRecords) {
    const quantity = Number(record?.quantity) || 0;
    if (quantity <= 0 || !record?.productId) continue;
    const product = byId.get(record.productId);
    addUsage(waste, record.productId, quantity, product?.unit || record.unit || DEFAULT_UNIT);
  }

  // A stock take's `difference` is physical minus system: negative means
  // stock is missing. Loss is therefore the negation.
  const counted = new Map();
  for (const adjustment of stockAdjustments) {
    const difference = Number(adjustment?.difference);
    if (!Number.isFinite(difference) || difference === 0 || !adjustment?.productId) continue;
    const product = byId.get(adjustment.productId);
    addUsage(counted, adjustment.productId, -difference, product?.unit || adjustment.unit || DEFAULT_UNIT);
  }

  const productIds = new Set([...theoretical.keys(), ...waste.keys(), ...counted.keys()]);
  const rows = [];

  for (const productId of productIds) {
    const product = byId.get(productId);
    if (!product) continue;
    const unit = product.unit || DEFAULT_UNIT;
    const unitCost = Math.max(0, Number(product.costPrice) || 0);

    const theoreticalQty = roundQuantity(theoretical.get(productId) || 0, unit);
    const wasteQty = roundQuantity(waste.get(productId) || 0, unit);
    const unaccountedQty = roundQuantity(counted.get(productId) || 0, unit);
    const varianceQty = roundQuantity(wasteQty + unaccountedQty, unit);

    if (theoreticalQty === 0 && varianceQty === 0) continue;

    rows.push({
      productId,
      productName: product.name,
      unit,
      unitCost,
      theoreticalQty,
      wasteQty,
      unaccountedQty,
      varianceQty,
      theoreticalCost: roundMoney(theoreticalQty * unitCost),
      wasteCost: roundMoney(wasteQty * unitCost),
      unaccountedCost: roundMoney(unaccountedQty * unitCost),
      varianceCost: roundMoney(varianceQty * unitCost),
      variancePercent: theoreticalQty > 0
        ? roundMoney((varianceQty / theoreticalQty) * 100)
        : null,
    });
  }

  rows.sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost));

  const totals = rows.reduce((acc, row) => ({
    theoreticalCost: roundMoney(acc.theoreticalCost + row.theoreticalCost),
    wasteCost: roundMoney(acc.wasteCost + row.wasteCost),
    unaccountedCost: roundMoney(acc.unaccountedCost + row.unaccountedCost),
    varianceCost: roundMoney(acc.varianceCost + row.varianceCost),
  }), { theoreticalCost: 0, wasteCost: 0, unaccountedCost: 0, varianceCost: 0 });

  return {
    rows,
    ...totals,
    variancePercent: totals.theoreticalCost > 0
      ? roundMoney((totals.varianceCost / totals.theoreticalCost) * 100)
      : null,
  };
}

/**
 * COST PERCENTAGE, the ratio every food and beverage operation is run on.
 *
 * The denominator is NET SALES — sales after discounts and BEFORE any
 * service charge. Both halves of that matter. Including the service
 * charge would flatter the ratio by adding revenue that has no food
 * behind it; ignoring discounts would understate it by pretending the
 * business collected money it gave away.
 */
export function costPercent(costOfGoodsSold, netSales) {
  const sales = Number(netSales) || 0;
  if (sales <= 0) return null;
  return roundMoney(((Number(costOfGoodsSold) || 0) / sales) * 100);
}

/**
 * Cost percentage split by menu group, which is how it is actually
 * managed: a kitchen runs at 30% and a bar at 20%, and a single blended
 * figure hides both. "Food cost" and "pour cost" are this function with a
 * different set of categories.
 */
export function costPercentByCategory(sales, products) {
  const categoryOf = new Map((products || []).map((p) => [p.id, p.category || 'Other']));
  const groups = new Map();

  for (const sale of sales || []) {
    if (sale?.isVoided) continue;
    for (const item of Array.isArray(sale?.items) ? sale.items : []) {
      const category = categoryOf.get(item?.productId) || 'Other';
      const existing = groups.get(category) || { category, netSales: 0, cost: 0, units: 0 };
      existing.netSales = roundMoney(existing.netSales + (Number(item?.lineTotal) || 0));
      existing.cost = roundMoney(existing.cost + (Number(item?.lineCost) || 0));
      existing.units = roundQuantity(existing.units + (Number(item?.quantity) || 0), 'metre');
      groups.set(category, existing);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      grossProfit: roundMoney(group.netSales - group.cost),
      costPercent: costPercent(group.cost, group.netSales),
    }))
    .sort((a, b) => b.netSales - a.netSales);
}

/**
 * MENU PERFORMANCE — what sold, what it earned, and what it cost, per
 * item. The report a menu is actually rewritten from.
 */
export function menuPerformance(sales, products) {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const rows = new Map();

  for (const sale of sales || []) {
    if (sale?.isVoided) continue;
    for (const item of Array.isArray(sale?.items) ? sale.items : []) {
      const id = item?.productId;
      if (!id) continue;
      const existing = rows.get(id) || {
        productId: id,
        productName: item.productName,
        category: byId.get(id)?.category || 'Other',
        unit: item.unit || DEFAULT_UNIT,
        quantity: 0, netSales: 0, cost: 0,
      };
      existing.quantity = roundQuantity(existing.quantity + (Number(item.quantity) || 0), existing.unit);
      existing.netSales = roundMoney(existing.netSales + (Number(item.lineTotal) || 0));
      existing.cost = roundMoney(existing.cost + (Number(item.lineCost) || 0));
      rows.set(id, existing);
    }
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      grossProfit: roundMoney(row.netSales - row.cost),
      costPercent: costPercent(row.cost, row.netSales),
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}
