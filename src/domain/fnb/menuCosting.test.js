// src/domain/fnb/menuCosting.test.js
//
// What a line costs, and what it consumes, once the dish is made rather
// than bought — and once the customer has changed it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sellingUnitCost, modifierUnitCost } from './costing.js';
import { resolveStockDeltas } from '../../utils/inventory.js';
import { normalizeModifierGroups, resolveModifierSelection } from '../../utils/modifiers.js';

// A café: a cappuccino made from milk, beans and a cup.
const MILK   = { id: 'milk',  name: 'Milk',  unit: 'litre', costPrice: 80,  catalogRole: 'ingredient', stock: 20 };
const OAT    = { id: 'oat',   name: 'Oat milk', unit: 'litre', costPrice: 220, catalogRole: 'ingredient', stock: 10 };
const BEANS  = { id: 'beans', name: 'Beans', unit: 'kilogram', costPrice: 1400, catalogRole: 'ingredient', stock: 5 };
const CUP    = { id: 'cup',   name: 'Cup',   costPrice: 8, catalogRole: 'ingredient', stock: 500 };

const CAPPUCCINO = {
  id: 'capp', name: 'Cappuccino', sellingPrice: 350,
  // The invented buying price the old form demanded. Nothing may read it.
  costPrice: 120,
  recipe: [
    { componentId: 'milk',  quantity: 0.15 },
    { componentId: 'beans', quantity: 0.018 },
    { componentId: 'cup',   quantity: 1 },
  ],
};

const PRODUCTS = [MILK, OAT, BEANS, CUP, CAPPUCCINO];

test('A DISH IS COSTED FROM ITS RECIPE, NOT FROM THE PRICE SOMEBODY TYPED', () => {
  // 0.15 L × 80 = 12.00
  // 0.018 kg × 1400 = 25.20
  // 1 cup × 8 = 8.00
  //                    = 45.20   and NOT the 120 stored on the product.
  assert.equal(sellingUnitCost(CAPPUCCINO, PRODUCTS), 45.2);
});

test('a bought-in product still costs exactly what it always did', () => {
  const coke = { id: 'coke', name: 'Coke', costPrice: 45, sellingPrice: 100 };
  assert.equal(sellingUnitCost(coke, [coke]), 45);
  // …and a version carries its own.
  const shirt = { id: 's', name: 'Shirt', costPrice: 400 };
  assert.equal(sellingUnitCost(shirt, [shirt], { variant: { costPrice: 450 } }), 450);
});

test('an item MADE IN ADVANCE keeps the cost its production run wrote', () => {
  const loaf = {
    id: 'loaf', name: 'Loaf', costPrice: 31.5, producedInAdvance: true,
    recipe: [{ componentId: 'flour', quantity: 0.5 }],
  };
  const flour = { id: 'flour', name: 'Flour', unit: 'kilogram', costPrice: 200 };
  // Not 100 (today's flour) — 31.50, what the batch that made it cost.
  assert.equal(sellingUnitCost(loaf, [loaf, flour]), 31.5);
});

test('THE CHOICES CHANGE THE COST — oat milk swaps one ingredient for another', () => {
  const groups = normalizeModifierGroups([{
    name: 'Milk',
    required: true,
    options: [
      { name: 'Whole' },
      {
        name: 'Oat',
        priceDelta: 50,
        recipe: [
          { componentId: 'milk', quantity: -0.15 },
          { componentId: 'oat', quantity: 0.15 },
        ],
      },
    ],
  }]);
  const product = { ...CAPPUCCINO, modifierGroups: groups };
  const chosen = resolveModifierSelection(product, { milk: 'oat' });

  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].recipe.length, 2, 'the adjustment is copied onto the line');

  // −0.15 × 80 = −12.00,  +0.15 × 220 = +33.00  ⇒ +21.00
  assert.equal(modifierUnitCost(chosen, PRODUCTS), 21);
  assert.equal(sellingUnitCost(product, PRODUCTS, { modifiers: chosen }), 66.2);
});

test('an option that only moves a price stores no recipe at all', () => {
  const groups = normalizeModifierGroups([
    { name: 'Size', options: [{ name: 'Large', priceDelta: 100 }] },
  ]);
  assert.deepEqual(groups[0].options[0], { id: 'large', name: 'Large', priceDelta: 100 });
  assert.equal(modifierUnitCost([{ name: 'Large', priceDelta: 100 }], PRODUCTS), 0);
});

test('a stack of removals can never make a line cost less than nothing', () => {
  const chosen = [{ name: 'No everything', recipe: [{ componentId: 'beans', quantity: -10 }] }];
  assert.equal(sellingUnitCost(CAPPUCCINO, PRODUCTS, { modifiers: chosen }), 0);
});

test('SELLING ONE CONSUMES WHAT WAS ACTUALLY POURED, not what the recipe says', () => {
  const chosen = [{
    name: 'Oat',
    recipe: [
      { componentId: 'milk', quantity: -0.15 },
      { componentId: 'oat', quantity: 0.15 },
    ],
  }];
  const rows = [{ productId: 'capp', quantity: 2, modifiers: chosen }];
  const deltas = resolveStockDeltas(rows, PRODUCTS, { recipes: true });

  // Two cappuccinos: the recipe takes 0.30 L of milk, the choice puts it
  // straight back and takes 0.30 L of oat instead.
  assert.equal(deltas.milk, undefined, 'a component that nets to zero writes nothing');
  assert.equal(deltas.oat.total, -0.3);
  assert.equal(deltas.beans.total, -0.036);
  assert.equal(deltas.cup.total, -2);
});

test('an extra shot takes more coffee and nothing else', () => {
  const chosen = [{ name: 'Extra shot', recipe: [{ componentId: 'beans', quantity: 0.009 }] }];
  const deltas = resolveStockDeltas(
    [{ productId: 'capp', quantity: 1, modifiers: chosen }], PRODUCTS, { recipes: true },
  );
  assert.equal(deltas.beans.total, -0.027);   // 0.018 + 0.009
  assert.equal(deltas.milk.total, -0.15);
});

test('WITH RECIPES OFF NOTHING HERE MOVES — every non-food business is untouched', () => {
  const chosen = [{ name: 'Oat', recipe: [{ componentId: 'oat', quantity: 5 }] }];
  const deltas = resolveStockDeltas(
    [{ productId: 'capp', quantity: 1, modifiers: chosen }], PRODUCTS, { recipes: false },
  );
  assert.deepEqual(deltas, {}, 'a dish with no stock of its own moves nothing');
});

test('an adjustment naming an ingredient that has been archived is skipped, not guessed', () => {
  const chosen = [{ name: 'Ghost', recipe: [{ componentId: 'nope', quantity: 1 }] }];
  assert.equal(modifierUnitCost(chosen, PRODUCTS), 0);
  const deltas = resolveStockDeltas(
    [{ productId: 'capp', quantity: 1, modifiers: chosen }], PRODUCTS, { recipes: true },
  );
  assert.equal(deltas.nope, undefined);
  assert.equal(deltas.milk.total, -0.15);
});
