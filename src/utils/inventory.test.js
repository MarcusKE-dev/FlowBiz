// The single inventory foundation — variants, recipes, production and
// services all resolving through one function.
//
// The failure this file mostly exists to prevent is DOUBLE DEDUCTION: a
// bakery that takes flour out at production time and takes it out again
// when the loaf sells will show negative flour by Thursday and blame the
// stock take.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStockDeltas, resolveProductionDeltas, productionUnitCost,
  validateComponentStock, isRecipeItem, isProducedInAdvance, tracksOwnStock,
  isService, isStockItem, missingComponentIds, MAX_RECIPE_DEPTH, recipeDependents,
} from './inventory.js';
import { buildLineItem } from './lineItems.js';

// A small restaurant catalogue: three ingredients and a burger built from
// them, plus a bakery loaf that is baked in advance.
const BUN    = { id: 'bun',   name: 'Burger bun',  stock: 100, costPrice: 15 };
const PATTY  = { id: 'patty', name: 'Beef patty',  stock: 40,  costPrice: 80, unit: 'piece' };
const CHEESE = { id: 'chz',   name: 'Cheese',      stock: 2.5, costPrice: 900, unit: 'kilogram' };
const FLOUR  = { id: 'flour', name: 'Flour',       stock: 50,  costPrice: 120, unit: 'kilogram' };

const BURGER = {
  id: 'burger', name: 'Cheeseburger', sellingPrice: 550, stock: 0,
  recipe: [
    { componentId: 'bun',   componentName: 'Burger bun', quantity: 1 },
    { componentId: 'patty', componentName: 'Beef patty', quantity: 1 },
    { componentId: 'chz',   componentName: 'Cheese',     quantity: 0.03, unit: 'kilogram' },
  ],
};

const LOAF = {
  id: 'loaf', name: 'White loaf', sellingPrice: 70, stock: 24,
  producedInAdvance: true,
  recipe: [{ componentId: 'flour', componentName: 'Flour', quantity: 0.5, unit: 'kilogram' }],
};

const CATALOGUE = [BUN, PATTY, CHEESE, FLOUR, BURGER, LOAF];

// ── Classification ───────────────────────────────────────────────────

test('a recipe item is recognised, and a plain product is not', () => {
  assert.equal(isRecipeItem(BURGER), true);
  assert.equal(isRecipeItem(BUN), false);
  assert.equal(isRecipeItem({ recipe: [] }), false);
  assert.equal(isRecipeItem(null), false);
});

test('made-to-order and made-in-advance are different things', () => {
  assert.equal(isProducedInAdvance(BURGER), false);
  assert.equal(isProducedInAdvance(LOAF), true);
  assert.equal(tracksOwnStock(BURGER), false, 'a burger has no stock of its own');
  assert.equal(tracksOwnStock(LOAF), true, 'a baked loaf does');
  assert.equal(tracksOwnStock(BUN), true);
  assert.equal(tracksOwnStock({ kind: 'service' }), false);
});

// ── Recipes: made to order ───────────────────────────────────────────

test('selling a burger takes its components and never the burger itself', () => {
  const deltas = resolveStockDeltas([{ productId: 'burger', quantity: 2 }], CATALOGUE, { recipes: true });
  assert.equal(deltas.burger, undefined, 'the menu item has no stock to move');
  assert.equal(deltas.bun.total, -2);
  assert.equal(deltas.patty.total, -2);
  assert.equal(deltas.chz.total, -0.06);
});

test('component quantities are rounded in the component unit, not the menu item unit', () => {
  const deltas = resolveStockDeltas([{ productId: 'burger', quantity: 7 }], CATALOGUE, { recipes: true });
  assert.equal(deltas.chz.total, -0.21, '7 × 0.03 kg, to the kilogram unit precision');
});

test('with recipes off, a made-to-order item moves nothing — not itself, not its components', () => {
  // Whether a burger has stock of its own is a fact about the burger, not
  // about a toggle. Deducting the menu item here would drive a field
  // nobody maintains negative and then block the sale.
  const deltas = resolveStockDeltas([{ productId: 'burger', quantity: 2 }], CATALOGUE, { recipes: false });
  assert.deepEqual(deltas, {});
});

test('turning recipes back on resumes component consumption exactly where it left off', () => {
  const off = resolveStockDeltas([{ productId: 'burger', quantity: 2 }], CATALOGUE, { recipes: false });
  const on = resolveStockDeltas([{ productId: 'burger', quantity: 2 }], CATALOGUE, { recipes: true });
  assert.deepEqual(off, {});
  assert.equal(on.bun.total, -2);
});

test('two menu items sharing a component roll into one delta for it', () => {
  const wrap = {
    id: 'wrap', name: 'Cheese wrap', recipe: [{ componentId: 'chz', quantity: 0.02 }],
  };
  const deltas = resolveStockDeltas(
    [{ productId: 'burger', quantity: 1 }, { productId: 'wrap', quantity: 2 }],
    [...CATALOGUE, wrap], { recipes: true }
  );
  assert.equal(deltas.chz.total, -0.07, '0.03 + 2 × 0.02');
});

test('a recipe whose component is itself a recipe resolves down to real stock', () => {
  const sauce = { id: 'sauce', name: 'House sauce', recipe: [{ componentId: 'chz', quantity: 0.01 }] };
  const special = { id: 'special', name: 'Special burger', recipe: [
    { componentId: 'bun', quantity: 1 },
    { componentId: 'sauce', quantity: 2 },
  ] };
  const deltas = resolveStockDeltas([{ productId: 'special', quantity: 3 }], [...CATALOGUE, sauce, special], { recipes: true });
  assert.equal(deltas.bun.total, -3);
  assert.equal(deltas.chz.total, -0.06, '3 × 2 portions × 0.01 kg');
  assert.equal(deltas.sauce, undefined);
});

test('a recipe that references itself terminates instead of hanging the till', () => {
  const loop = { id: 'loop', name: 'Loop', recipe: [{ componentId: 'loop', quantity: 1 }] };
  assert.doesNotThrow(() => resolveStockDeltas([{ productId: 'loop', quantity: 1 }], [loop], { recipes: true }));
});

test('a recipe referencing a deleted component skips it rather than failing the sale', () => {
  const orphan = { id: 'o', name: 'Orphan', recipe: [
    { componentId: 'bun', quantity: 1 },
    { componentId: 'deleted-thing', quantity: 5 },
  ] };
  const deltas = resolveStockDeltas([{ productId: 'o', quantity: 1 }], [...CATALOGUE, orphan], { recipes: true });
  assert.equal(deltas.bun.total, -1);
});

// ── Production: made in advance ──────────────────────────────────────

test('selling a baked loaf takes the loaf, NOT the flour', () => {
  const deltas = resolveStockDeltas([{ productId: 'loaf', quantity: 6 }], CATALOGUE, { recipes: true });
  assert.equal(deltas.loaf.total, -6);
  assert.equal(deltas.flour, undefined, 'the flour was consumed when it was baked');
});

test('a production run adds finished goods and removes exactly its components', () => {
  const deltas = resolveProductionDeltas(LOAF, 20, CATALOGUE);
  assert.equal(deltas.loaf.total, 20);
  assert.equal(deltas.flour.total, -10, '20 loaves × 0.5 kg');
});

test('production then selling moves each thing exactly once', () => {
  // Bake 20 loaves, sell 6.
  const production = resolveProductionDeltas(LOAF, 20, CATALOGUE);
  const sale = resolveStockDeltas([{ productId: 'loaf', quantity: 6 }], CATALOGUE, { recipes: true });

  const loafAfter = 24 + production.loaf.total + sale.loaf.total;
  const flourAfter = 50 + production.flour.total + (sale.flour?.total || 0);
  assert.equal(loafAfter, 38);
  assert.equal(flourAfter, 40, 'flour moves once, at production, and never again');
});

test('production cost rolls up from component costs, per finished unit', () => {
  assert.equal(productionUnitCost(LOAF, 20, CATALOGUE), 60, '0.5 kg of flour at 120/kg');
  assert.equal(productionUnitCost(BURGER, 1, CATALOGUE), 122, '15 + 80 + 0.03 × 900');
  assert.equal(productionUnitCost(BUN, 5, CATALOGUE), 0, 'a plain product has no recipe cost');
  assert.equal(productionUnitCost(LOAF, 0, CATALOGUE), 0);
});

test('a production run of nothing, or of a product with no recipe, moves nothing', () => {
  assert.deepEqual(resolveProductionDeltas(LOAF, 0, CATALOGUE), {});
  assert.deepEqual(resolveProductionDeltas(BUN, 10, CATALOGUE), {});
  assert.deepEqual(resolveProductionDeltas(null, 10, CATALOGUE), {});
});

// ── Component availability ───────────────────────────────────────────

test('a kitchen that has run out of an ingredient cannot sell the dish', () => {
  assert.equal(validateComponentStock([{ productId: 'burger', quantity: 10 }], CATALOGUE, { recipes: true }), null);
  const message = validateComponentStock([{ productId: 'burger', quantity: 41 }], CATALOGUE, { recipes: true });
  assert.match(message, /Not enough Beef patty/);
  assert.match(message, /40 left/);
});

test('component checking is skipped entirely when recipes are off', () => {
  assert.equal(validateComponentStock([{ productId: 'burger', quantity: 999 }], CATALOGUE, { recipes: false }), null);
});

test('an ingredient measured in kilograms is checked in kilograms', () => {
  // 2.5 kg of cheese at 0.03 kg per burger is 83 burgers.
  assert.equal(validateComponentStock([{ productId: 'burger', quantity: 30 }], CATALOGUE, { recipes: true }), null);
  const tight = { ...CHEESE, stock: 0.05 };
  assert.match(
    validateComponentStock([{ productId: 'burger', quantity: 3 }], [BUN, PATTY, tight, BURGER], { recipes: true }),
    /Not enough Cheese/
  );
});

// ── Services and edge cases ──────────────────────────────────────────

test('a service moves no stock at all', () => {
  const haircut = { id: 'h', name: 'Haircut', kind: 'service' };
  assert.deepEqual(resolveStockDeltas([{ productId: 'h', quantity: 3 }], [haircut], { recipes: true }), {});
});

test('a negative quantity in a cart row is ignored rather than crediting stock', () => {
  // Nothing in the UI can produce one, and a stock movement is never the
  // place to discover that something did.
  const deltas = resolveStockDeltas([
    { productId: 'bun', quantity: 3 },
    { productId: 'bun', quantity: -3 },
  ], CATALOGUE);
  assert.deepEqual(deltas, { bun: { total: -3, variants: {}, batches: {} } });
});

test('malformed rows and catalogues never throw', () => {
  for (const rows of [null, undefined, [], [null], [{}], [{ productId: 'nope', quantity: 1 }]]) {
    assert.doesNotThrow(() => resolveStockDeltas(rows, CATALOGUE, { recipes: true }));
  }
  assert.deepEqual(resolveStockDeltas([{ productId: 'bun', quantity: 1 }], null), {});
});

test('a zero or negative quantity moves nothing', () => {
  assert.deepEqual(resolveStockDeltas([{ productId: 'bun', quantity: 0 }], CATALOGUE), {});
  assert.deepEqual(resolveStockDeltas([{ productId: 'bun', quantity: 'abc' }], CATALOGUE), {});
});

// ── Services (Phase 7) ───────────────────────────────────────────────

const HAIRCUT = { id: 'cut', name: 'Haircut', kind: 'service', sellingPrice: 500, costPrice: 0, stock: 0 };
const SHAMPOO = { id: 'sh', name: 'Shampoo 250ml', sellingPrice: 800, costPrice: 500, stock: 12 };

test('a service is never a stock item, however its stock field reads', () => {
  assert.equal(isService(HAIRCUT), true);
  assert.equal(isService(SHAMPOO), false);
  assert.equal(isService({ name: 'Sukari' }), false, 'an absent kind means product');
  assert.equal(isStockItem(HAIRCUT), false);
  assert.equal(isStockItem(SHAMPOO), true);
  assert.equal(isStockItem({ ...HAIRCUT, stock: 99 }), false);
});

test('selling a service and a product together moves only the product', () => {
  const deltas = resolveStockDeltas([
    { productId: 'cut', quantity: 1 },
    { productId: 'sh', quantity: 2 },
  ], [HAIRCUT, SHAMPOO]);
  assert.equal(deltas.cut, undefined, 'a haircut does not run out');
  assert.equal(deltas.sh.total, -2);
});

test('a salon selling only services never writes a stock update at all', () => {
  const deltas = resolveStockDeltas(
    [{ productId: 'cut', quantity: 3 }, { productId: 'cut2', quantity: 1 }],
    [HAIRCUT, { id: 'cut2', name: 'Braiding', kind: 'service' }]
  );
  assert.deepEqual(deltas, {});
});

test('services are excluded from what a stock take and a low-stock alert consider', () => {
  const catalogue = [HAIRCUT, SHAMPOO, BURGER, LOAF, FLOUR];
  const countable = catalogue.filter(isStockItem);
  assert.deepEqual(countable.map((p) => p.id), ['sh', 'loaf', 'flour']);
  // Inventory value: a haircut priced at 500 contributes nothing.
  const value = countable.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0);
  assert.equal(value, 12 * 500 + 24 * 0 + 50 * 120);
});

// ── Services carry no cost (Phase B3) ────────────────────────────────
//
// A service was previously given a buying price by the product form,
// which fed straight into cost of goods sold: a haircut priced at 500
// with a stray 200 in the cost field reported a 60% margin on something
// that has no cost of goods at all.

test('a service sale is pure revenue — full price, zero cost, zero profit gap', () => {
  const haircut = { id: 'cut', name: 'Haircut', kind: 'service', sellingPrice: 500, costPrice: 0, stock: 0 };
  const line = buildLineItem({
    productId: 'cut', productName: 'Haircut', quantity: 2,
    unitPrice: haircut.sellingPrice, costPrice: haircut.costPrice,
  });
  assert.equal(line.lineTotal, 1000);
  assert.equal(line.lineCost, 0);
  assert.equal(line.lineProfit, 1000, 'the whole line is profit, because nothing was bought in');
});

test('a service never appears in inventory valuation or low-stock counts', () => {
  const catalogue = [
    { id: 'cut', name: 'Haircut', kind: 'service', stock: 0, costPrice: 0, lowStockThreshold: 5 },
    // Even a service somebody has left a stale stock and cost figure on.
    { id: 'braid', name: 'Braiding', kind: 'service', stock: 12, costPrice: 250, lowStockThreshold: 5 },
    { id: 'shampoo', name: 'Shampoo', stock: 3, costPrice: 400, lowStockThreshold: 5 },
  ];
  const stockItems = catalogue.filter(isStockItem);
  assert.deepEqual(stockItems.map((p) => p.id), ['shampoo'], 'only the physical product is stock');

  const valuation = stockItems.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  assert.equal(valuation, 1200, 'the stale 12 × 250 on a service must not be counted as inventory');

  const low = stockItems.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));
  assert.deepEqual(low.map((p) => p.id), ['shampoo'], 'a salon is never warned that it is low on haircuts');
});

test('selling a service alongside a product moves only the product, whatever the service says its stock is', () => {
  const catalogue = [
    { id: 'braid', name: 'Braiding', kind: 'service', stock: 12 },
    { id: 'shampoo', name: 'Shampoo', stock: 3 },
  ];
  const deltas = resolveStockDeltas(
    [{ productId: 'braid', quantity: 1 }, { productId: 'shampoo', quantity: 1 }],
    catalogue
  );
  assert.equal(deltas.braid, undefined);
  assert.equal(deltas.shampoo.total, -1);
});

// ── Production writes the cost it actually incurred (Phase B9) ────────

test('the cost of a loaf follows its ingredients, so a flour price rise reaches the profit line', () => {
  const cheapFlour = { id: 'flour', name: 'Flour', stock: 50, costPrice: 120, unit: 'kilogram' };
  const loaf = {
    id: 'loaf', name: 'White loaf', stock: 0, costPrice: 12, producedInAdvance: true,
    recipe: [{ componentId: 'flour', quantity: 0.5, unit: 'kilogram' }],
  };
  // What the product form has stored is 12; what the run actually costs
  // is 60, and that is what production writes back.
  assert.equal(productionUnitCost(loaf, 1, [cheapFlour, loaf]), 60);

  const dearFlour = { ...cheapFlour, costPrice: 180 };
  assert.equal(productionUnitCost(loaf, 1, [dearFlour, loaf]), 90, 'a 50% flour rise is a 50% loaf cost rise');
});

test('a recipe whose ingredients have no cost yet produces zero, which must not overwrite a typed figure', () => {
  const flour = { id: 'flour', name: 'Flour', stock: 50, unit: 'kilogram' };
  const loaf = {
    id: 'loaf', name: 'Loaf', stock: 0, costPrice: 40, producedInAdvance: true,
    recipe: [{ componentId: 'flour', quantity: 0.5 }],
  };
  // Production.jsx only writes the cost back when this is greater than
  // zero, precisely so an unpriced recipe cannot zero a real number.
  assert.equal(productionUnitCost(loaf, 1, [flour, loaf]), 0);
});


// ── Loading components on demand ─────────────────────────────────────
//
// resolveStockDeltas() is pure: a component missing from the products it
// is handed is silently skipped. Screens with a catalogue listener never
// notice. CustomerDetail, which fetches only the products named on a
// credit sale, restored a cancelled burger and kept the patty — so these
// tests cover the loader that closes the gap.

test('a made-to-order recipe names the components still to fetch', () => {
  const missing = missingComponentIds([BURGER], new Set(['burger']));
  assert.deepEqual(missing.sort(), ['bun', 'chz', 'patty']);
});

test('a recipe made IN ADVANCE names nothing — its sale never touched them', () => {
  assert.deepEqual(missingComponentIds([LOAF], new Set(['loaf'])), []);
});

test('a component already loaded is not asked for twice', () => {
  const missing = missingComponentIds([BURGER], new Set(['burger', 'bun', 'patty']));
  assert.deepEqual(missing, ['chz']);
});

test('a plain product, a service and an empty list name nothing', () => {
  assert.deepEqual(missingComponentIds([PATTY], new Set(['patty'])), []);
  assert.deepEqual(missingComponentIds([{ id: 's', kind: 'service' }], new Set(['s'])), []);
  assert.deepEqual(missingComponentIds([], new Set()), []);
  assert.deepEqual(missingComponentIds(undefined), []);
});

test('a component listed with no quantity is not fetched — it moves nothing', () => {
  const badge = { id: 'badge', recipe: [{ componentId: 'ink', quantity: 0 }] };
  assert.deepEqual(missingComponentIds([badge], new Set(['badge'])), []);
});

test('the loader walks a nested recipe down to real stock, and terminates', () => {
  const sauce = { id: 'sauce', recipe: [{ componentId: 'chz', quantity: 0.01 }] };
  const special = { id: 'special', recipe: [
    { componentId: 'sauce', quantity: 1 },
    { componentId: 'bun', quantity: 1 },
  ] };
  const shelf = new Map([...CATALOGUE, sauce, special].map((p) => [p.id, p]));

  // Exactly the loop CustomerDetail.loadProductsFor runs, over a fake shelf.
  const seen = new Set(['special']);
  const live = [special];
  let frontier = live;
  let rounds = 0;
  for (let level = 0; level < MAX_RECIPE_DEPTH; level++) {
    const next = missingComponentIds(frontier, seen);
    if (next.length === 0) break;
    rounds++;
    next.forEach((id) => seen.add(id));
    frontier = next.map((id) => shelf.get(id)).filter(Boolean);
    live.push(...frontier);
  }

  assert.equal(rounds, 2, 'sauce is one level down, cheese two');
  assert.deepEqual([...seen].sort(), ['bun', 'chz', 'sauce', 'special']);

  // And with that shelf loaded, the reversal actually credits the cheese.
  const deltas = resolveStockDeltas([{ productId: 'special', quantity: 3 }], live, {
    recipes: true, reverse: true,
  });
  assert.equal(deltas.chz.total, 0.03);
  assert.equal(deltas.bun.total, 3);
  assert.equal(deltas.special, undefined, 'a made-to-order item has no stock of its own');
});

test('a self-referencing recipe cannot spin the loader forever', () => {
  const loop = { id: 'loop', recipe: [{ componentId: 'loop', quantity: 1 }] };
  assert.deepEqual(missingComponentIds([loop], new Set(['loop'])), [],
    'already loaded, so never asked for again');
});


// ── What breaks if this product goes away ────────────────────────────

test('archiving a component names the products built from it', () => {
  const dependents = recipeDependents('patty', CATALOGUE);
  assert.deepEqual(dependents.map((p) => p.id), ['burger']);
});

test('a product made in advance is named too — its production runs break the same way', () => {
  assert.deepEqual(recipeDependents('flour', CATALOGUE).map((p) => p.id), ['loaf']);
});

test('a product nothing is built from names nobody', () => {
  assert.deepEqual(recipeDependents('burger', CATALOGUE), []);
  assert.deepEqual(recipeDependents('loaf', CATALOGUE), []);
});

test('several products sharing one ingredient are all named', () => {
  const wrap = { id: 'wrap', name: 'Cheese wrap', recipe: [{ componentId: 'chz', quantity: 0.02 }] };
  const dependents = recipeDependents('chz', [...CATALOGUE, wrap]);
  assert.deepEqual(dependents.map((p) => p.id).sort(), ['burger', 'wrap']);
});

test('a self-referencing recipe does not name itself', () => {
  const loop = { id: 'loop', name: 'Loop', recipe: [{ componentId: 'loop', quantity: 1 }] };
  assert.deepEqual(recipeDependents('loop', [loop]), []);
});

test('no id, no catalogue, no dependents', () => {
  assert.deepEqual(recipeDependents(null, CATALOGUE), []);
  assert.deepEqual(recipeDependents('patty', undefined), []);
});
