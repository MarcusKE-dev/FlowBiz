// src/domain/fnb/costing.test.js
//
// Costing, yield, waste and variance. Several of these pin BUG FIXES
// rather than new behaviour, and those are marked.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  recipeYieldOf, recipeUnitCost, recipeBatchCost, menuItemMargin,
  recipePrecisionWarnings, theoreticalUsage, usageVariance, costPercent,
  costPercentByCategory, menuPerformance,
} from './costing.js';
import { planProduction, productionDeltas, buildProductionRecord, shelfLifeDaysOf, expiryFromShelfLife, summarizeYield } from './production.js';
import { buildWasteRecord, resolveWasteDeltas, summarizeWaste, isWastable, wasteByProduct } from './waste.js';
import { resolveStockDeltas } from '../../utils/inventory.js';

const FLOUR = { id: 'flour', name: 'Flour', unit: 'kilogram', costPrice: 100, stock: 50 };
const SUGAR = { id: 'sugar', name: 'Sugar', unit: 'kilogram', costPrice: 200, stock: 10 };
const GIN   = { id: 'gin', name: 'Gin', unit: 'tot', costPrice: 60, stock: 30 };
const LOAF  = {
  id: 'loaf', name: 'Loaf', unit: 'piece', sellingPrice: 60, costPrice: 5,
  producedInAdvance: true, recipeYield: 20,
  // Per FINISHED UNIT, which is what a stored recipe line has always meant.
  recipe: [{ componentId: 'flour', quantity: 0.5 }, { componentId: 'sugar', quantity: 0.05 }],
};
const DAWA = {
  id: 'dawa', name: 'Dawa', unit: 'piece', sellingPrice: 400, costPrice: 0,
  recipe: [{ componentId: 'gin', quantity: 1.5 }],
};
const PRODUCTS = [FLOUR, SUGAR, GIN, LOAF, DAWA];

// ── Yield ────────────────────────────────────────────────────────────

test('a product with no yield has a yield of one, which is what every existing product has', () => {
  assert.equal(recipeYieldOf({}), 1);
  assert.equal(recipeYieldOf({ recipeYield: 0 }), 1);
  assert.equal(recipeYieldOf({ recipeYield: 'twenty' }), 1);
  assert.equal(recipeYieldOf(LOAF), 20);
});

test('recipe cost is per finished unit; batch cost is that times the yield', () => {
  const { cost } = recipeUnitCost(LOAF, PRODUCTS);
  assert.equal(cost, 60, '0.5kg flour at 100 plus 0.05kg sugar at 200');
  assert.equal(recipeBatchCost(LOAF, PRODUCTS).cost, 1200, 'one dough, twenty loaves');
});

test('a missing ingredient is REPORTED, never silently costed at zero', () => {
  const broken = { id: 'x', recipe: [{ componentId: 'gone', componentName: 'Yeast', quantity: 1 }] };
  const { cost, missing } = recipeUnitCost(broken, PRODUCTS);
  assert.equal(cost, 0);
  assert.deepEqual(missing, ['Yeast'], 'a recipe quietly getting cheaper is how a figure stops being trusted');
});

test('a made-to-order item is costed from its components, not from its own stale cost price', () => {
  const margin = menuItemMargin(DAWA, PRODUCTS);
  assert.equal(margin.cost, 90, '1.5 tots of gin at 60');
  assert.equal(margin.price, 400);
  assert.equal(margin.margin, 310);
  assert.equal(margin.costPercent, 22.5, 'a bar runs on this number');
});

// ── The fractional-pour bug ──────────────────────────────────────────

test('BUG FIX: a 1.5-tot pour deducts one and a half tots, not one', () => {
  // A tot used to carry zero decimals, and roundQuantity() truncates
  // those. Selling one Dawa deducted exactly 1 tot of gin, so a third of
  // every measure poured never reached the books — invisible until a
  // stock take, and indistinguishable from theft when it did.
  const deltas = resolveStockDeltas([{ productId: 'dawa', quantity: 1 }], PRODUCTS, { recipes: true });
  assert.equal(deltas.gin.total, -1.5);
  assert.equal(deltas.dawa, undefined, 'the cocktail itself has no stock of its own');
});

test('a recipe quantity its unit cannot hold is flagged where somebody can fix it', () => {
  const halfBottle = { id: 'x', recipe: [{ componentId: 'bottleish', quantity: 0.5 }] };
  const products = [{ id: 'bottleish', name: 'Beer', unit: 'bottle', costPrice: 100 }];
  const warnings = recipePrecisionWarnings(halfBottle, products);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].entered, 0.5);
  assert.equal(warnings[0].used, 0, 'half a bottle is not a thing, and the recipe must say so out loud');
});

test('a recipe whose quantities all fit produces no warning', () => {
  assert.deepEqual(recipePrecisionWarnings(DAWA, PRODUCTS), []);
  assert.deepEqual(recipePrecisionWarnings(LOAF, PRODUCTS), []);
});

// ── Production ───────────────────────────────────────────────────────

test('a full-yield run consumes the recipe and costs the plan', () => {
  const plan = planProduction(LOAF, PRODUCTS, { batches: 1 });
  assert.equal(plan.plannedQuantity, 20);
  assert.equal(plan.quantity, 20);
  assert.equal(plan.totalCost, 1200);
  assert.equal(plan.unitCost, 60);
  assert.equal(plan.yieldVariance, 0);
  assert.equal(plan.shortYieldCost, 0);
});

test('SHORT YIELD raises the unit cost, because the ingredients were still used', () => {
  // Plan twenty, get eighteen. The dough for twenty went in the oven, so
  // the cost of that dough has to be carried by the eighteen that came
  // out — costing them at the planned rate would make the value of the
  // two lost loaves vanish from the books entirely.
  const plan = planProduction(LOAF, PRODUCTS, { batches: 1, actualQuantity: 18 });
  assert.equal(plan.plannedQuantity, 20);
  assert.equal(plan.quantity, 18);
  assert.equal(plan.totalCost, 1200, 'the full dough was still used');
  assert.equal(plan.unitCost, 66.67, '1200 over 18, not over 20');
  assert.equal(plan.yieldVariance, -2);
  assert.equal(plan.yieldPercent, 90);
});

test('a short-yield run puts in what came out and takes out what went in', () => {
  const plan = planProduction(LOAF, PRODUCTS, { batches: 1, actualQuantity: 18 });
  const deltas = productionDeltas(plan);
  assert.equal(deltas.loaf.total, 18, 'eighteen loaves on the shelf');
  assert.equal(deltas.flour.total, -10, 'the flour for twenty is gone');
  assert.equal(deltas.sugar.total, -1);
});

test('a run recorded the simple way stores no new fields', () => {
  const plain = { id: 'cake', name: 'Cake', unit: 'piece', producedInAdvance: true,
                  recipe: [{ componentId: 'flour', quantity: 1 }] };
  const record = buildProductionRecord(planProduction(plain, PRODUCTS, { batches: 3 }));
  assert.ok(!('plannedQuantity' in record), 'nothing short-yielded, so nothing to say');
  assert.ok(!('batches' in record), 'yield of one, so batches is just the quantity');
  assert.equal(record.quantity, 3);
});

test('short yield IS recorded, so it can be reported later', () => {
  const record = buildProductionRecord(planProduction(LOAF, PRODUCTS, { batches: 1, actualQuantity: 18 }));
  assert.equal(record.plannedQuantity, 20);
  assert.equal(record.yieldVariance, -2);
  assert.equal(record.batches, 1);
  assert.equal(record.yieldPerBatch, 20);
});

test('a run that would go short of an ingredient says so before it is committed', () => {
  const plan = planProduction(LOAF, PRODUCTS, { batches: 10 });
  assert.equal(plan.shortfall, true, '10kg of sugar needed, 10 in stock… and 100kg of flour needed, 50 in stock');
  assert.ok(plan.components.some((c) => c.short));
});

test('yield across a period', () => {
  const summary = summarizeYield([
    { quantity: 18, plannedQuantity: 20, unitCost: 66.67 },
    { quantity: 20, plannedQuantity: 20, unitCost: 60 },
    { quantity: 5 },
  ]);
  assert.equal(summary.plannedQuantity, 45);
  assert.equal(summary.actualQuantity, 43);
  assert.equal(summary.shortYieldCost, 133.34);
});

test('a full-yield run adds finished goods and removes exactly its components', () => {
  const deltas = productionDeltas(planProduction(LOAF, PRODUCTS, { batches: 1 }));
  assert.equal(deltas.loaf.total, 20);
  assert.equal(deltas.flour.total, -10, '20 loaves × 0.5 kg');
  assert.equal(deltas.sugar.total, -1);
});

test('PRODUCTION THEN SELLING MOVES EACH THING EXACTLY ONCE', () => {
  // The double-count the made-in-advance distinction exists to prevent.
  // Bake 20 loaves, sell 6: the loaves move twice (in, then out) and the
  // flour moves once, at the bake, and never again.
  const production = productionDeltas(planProduction(LOAF, PRODUCTS, { batches: 1 }));
  const sale = resolveStockDeltas([{ productId: 'loaf', quantity: 6 }], PRODUCTS, { recipes: true });
  assert.equal(production.loaf.total + sale.loaf.total, 14);
  assert.equal(sale.flour, undefined, 'the flour was consumed when it was baked');
  assert.equal(production.flour.total, -10);
});

test('NOTHING IS PRODUCED THAT IS NOT MADE', () => {
  // Producing a product with no recipe would add to its stock with
  // nothing consumed — stock created out of nothing, which is the same
  // class of error as deducting from something that has no stock.
  assert.deepEqual(productionDeltas(planProduction(LOAF, PRODUCTS, { batches: 0 })), {}, 'a run of zero');
  assert.deepEqual(productionDeltas(planProduction(FLOUR, PRODUCTS, { batches: 5 })), {}, 'a raw ingredient is not made');
  assert.deepEqual(productionDeltas(planProduction(DAWA, PRODUCTS, { batches: 5 })), {}, 'a made-to-order item is not made in advance');
  assert.deepEqual(productionDeltas(null), {});
  assert.equal(planProduction(FLOUR, PRODUCTS, { batches: 5 }).producible, false);
});

test('the cost of a loaf follows its ingredients, so a flour price rise reaches the profit line', () => {
  // What the product form has stored is 5; what a run actually costs is
  // 60, and that is what production writes back.
  const dearer = PRODUCTS.map((p) => (p.id === 'flour' ? { ...p, costPrice: 200 } : p));
  assert.equal(recipeUnitCost(LOAF, PRODUCTS).cost, 60);
  assert.equal(recipeUnitCost(LOAF, dearer).cost, 110, 'a doubled flour price reaches the loaf');
});

test('an unpriced recipe costs zero, which must not be written over a typed figure', () => {
  const unpriced = [{ id: 'flour', name: 'Flour', unit: 'kilogram', stock: 50 }, LOAF];
  assert.equal(recipeUnitCost(LOAF, unpriced).cost, 0);
  // Production.jsx writes the cost back ONLY when it is greater than
  // zero, precisely so an unpriced recipe cannot zero a real number.
  assert.equal(planProduction(LOAF, unpriced, { batches: 1 }).unitCost, 0);
});

// ── Shelf life ───────────────────────────────────────────────────────

test('a product with no shelf life gets no expiry date, which is every existing product', () => {
  assert.equal(shelfLifeDaysOf({}), null);
  assert.equal(expiryFromShelfLife({}, { producedOn: '2026-09-06' }), null);
});

test('a shelf life dates the batch a run creates', () => {
  assert.equal(expiryFromShelfLife({ shelfLifeDays: 3 }, { producedOn: '2026-09-06' }), '2026-09-09');
  assert.equal(expiryFromShelfLife({ shelfLifeDays: 30 }, { producedOn: '2026-12-20' }), '2027-01-19');
});

// ── Waste ────────────────────────────────────────────────────────────

test('a service and a made-to-order dish cannot be wasted, because they have no stock', () => {
  assert.equal(isWastable({ kind: 'service' }), false);
  assert.equal(isWastable(DAWA), false, 'what was lost is the gin, and the gin is what gets recorded');
  assert.equal(isWastable(FLOUR), true);
  assert.equal(isWastable(LOAF), true, 'a loaf made in advance has real stock');
});

test('a waste record snapshots the cost it destroyed', () => {
  const record = buildWasteRecord({ quantity: 2.5, reason: 'spoilage' }, FLOUR, { recordedByName: 'Ann' });
  assert.equal(record.quantity, 2.5);
  assert.equal(record.unitCost, 100);
  assert.equal(record.totalCost, 250);
  assert.equal(record.unit, 'kilogram');
  assert.equal(record.recordedByName, 'Ann');
});

test('an unusable waste row becomes nothing, never a half-written record', () => {
  assert.equal(buildWasteRecord({ quantity: 0 }, FLOUR), null);
  assert.equal(buildWasteRecord({ quantity: -5 }, FLOUR), null);
  assert.equal(buildWasteRecord({ quantity: 1 }, DAWA), null);
  assert.equal(buildWasteRecord({ quantity: 1 }, null), null);
});

test('an unknown reason falls back rather than being stored', () => {
  assert.equal(buildWasteRecord({ quantity: 1, reason: 'gremlins' }, FLOUR).reason, 'spoilage');
});

test('waste moves stock down, against the batch it was actually thrown from', () => {
  const records = [
    buildWasteRecord({ quantity: 2 }, FLOUR),
    buildWasteRecord({ quantity: 1, batchId: 'b7' }, SUGAR),
  ];
  const deltas = resolveWasteDeltas(records, PRODUCTS);
  assert.equal(deltas.flour.total, -2);
  assert.equal(deltas.sugar.total, -1);
  assert.equal(deltas.sugar.batches.b7, -1, 'you throw away the box that went off, not the earliest one');
});

test('waste summarises by reason and by product', () => {
  const records = [
    { reason: 'spoilage', totalCost: 250, productId: 'flour', productName: 'Flour', quantity: 2.5, unit: 'kilogram' },
    { reason: 'breakage', totalCost: 100, productId: 'sugar', productName: 'Sugar', quantity: 0.5, unit: 'kilogram' },
    { reason: 'spoilage', totalCost: 50, productId: 'flour', productName: 'Flour', quantity: 0.5, unit: 'kilogram' },
  ];
  const summary = summarizeWaste(records);
  assert.equal(summary.totalCost, 400);
  assert.equal(summary.byReason.spoilage, 300);
  assert.equal(summary.byReason.breakage, 100);

  const byProduct = wasteByProduct(records);
  assert.equal(byProduct[0].productId, 'flour');
  assert.equal(byProduct[0].totalCost, 300);
  assert.equal(byProduct[0].quantity, 3);
});

// ── Theoretical usage and variance ───────────────────────────────────

test('theoretical usage traces a sale through its recipe', () => {
  const sales = [{ items: [{ productId: 'dawa', quantity: 4, lineTotal: 1600, lineCost: 360 }] }];
  const usage = theoreticalUsage({ sales, products: PRODUCTS });
  assert.equal(usage.get('gin'), 6, 'four Dawas at 1.5 tots');
});

test('an item made in advance is counted through PRODUCTION, never twice', () => {
  // Selling a loaf takes the loaf. The flour was taken when it was baked.
  // Counting both would double the flour, which is the exact bug the
  // made-in-advance distinction exists to prevent at the till.
  const sales = [{ items: [{ productId: 'loaf', quantity: 20, lineTotal: 1200, lineCost: 1200 }] }];
  const productions = [{ components: [{ componentId: 'flour', quantity: 10, unit: 'kilogram' }] }];
  const usage = theoreticalUsage({ sales, productions, products: PRODUCTS });
  assert.equal(usage.get('flour'), 10, 'once, from the bake');
  assert.equal(usage.get('loaf'), 20, 'and the loaves themselves left the shelf');
});

test('a voided sale consumed nothing', () => {
  const usage = theoreticalUsage({
    sales: [{ isVoided: true, items: [{ productId: 'dawa', quantity: 10 }] }],
    products: PRODUCTS,
  });
  assert.equal(usage.get('gin'), undefined);
});

test('variance is recorded waste plus what the count could not account for', () => {
  const result = usageVariance({
    sales: [{ items: [{ productId: 'dawa', quantity: 10 }] }],   // 15 tots theoretical
    wasteRecords: [{ productId: 'gin', quantity: 1, unit: 'tot' }],
    stockAdjustments: [{ productId: 'gin', difference: -2, unit: 'tot' }],
    products: PRODUCTS,
  });
  const gin = result.rows.find((r) => r.productId === 'gin');
  assert.equal(gin.theoreticalQty, 15);
  assert.equal(gin.wasteQty, 1, 'somebody wrote this one down');
  assert.equal(gin.unaccountedQty, 2, 'the count found two more missing');
  assert.equal(gin.varianceQty, 3);
  assert.equal(gin.varianceCost, 180);
  assert.equal(gin.variancePercent, 20);
});

test('a count that finds MORE than expected is a negative loss, not clamped away', () => {
  const result = usageVariance({
    sales: [{ items: [{ productId: 'dawa', quantity: 10 }] }],
    stockAdjustments: [{ productId: 'gin', difference: 3, unit: 'tot' }],
    products: PRODUCTS,
  });
  const gin = result.rows.find((r) => r.productId === 'gin');
  assert.equal(gin.unaccountedQty, -3, 'found stock usually means a delivery was never recorded');
});

test('variance over a period with nothing to say is empty rather than noisy', () => {
  const result = usageVariance({ products: PRODUCTS });
  assert.deepEqual(result.rows, []);
  assert.equal(result.variancePercent, null);
});

// ── Cost percentage ──────────────────────────────────────────────────

test('cost percentage is against net sales, and refuses to divide by nothing', () => {
  assert.equal(costPercent(300, 1000), 30);
  assert.equal(costPercent(300, 0), null);
  assert.equal(costPercent(300, -5), null);
});

test('cost percentage splits by menu group, because a kitchen and a bar run at different ratios', () => {
  const products = [
    { id: 'a', category: 'Main Course' }, { id: 'b', category: 'Spirits' },
  ];
  const sales = [{ items: [
    { productId: 'a', quantity: 1, lineTotal: 1000, lineCost: 320 },
    { productId: 'b', quantity: 2, lineTotal: 800, lineCost: 160 },
  ] }];
  const rows = costPercentByCategory(sales, products);
  const food = rows.find((r) => r.category === 'Main Course');
  const bar = rows.find((r) => r.category === 'Spirits');
  assert.equal(food.costPercent, 32);
  assert.equal(bar.costPercent, 20);
});

test('menu performance ranks by what each item actually earns', () => {
  const sales = [{ items: [
    { productId: 'a', productName: 'Steak', quantity: 1, lineTotal: 1800, lineCost: 900 },
    { productId: 'b', productName: 'Soda', quantity: 10, lineTotal: 1000, lineCost: 200 },
  ] }];
  const rows = menuPerformance(sales, []);
  assert.equal(rows[0].productName, 'Steak', '900 of profit');
  assert.equal(rows[1].productName, 'Soda', '800 of profit, on ten times the volume');
  assert.equal(rows[1].quantity, 10);
});
