// The production run as the screen now records it (audit H05, H06).

import test from 'node:test';
import assert from 'node:assert/strict';
import { planProduction, productionDeltas } from './production.js';
import { wasteSubledgerProblem, buildWasteRecord, resolveWasteDeltas } from './waste.js';

const flour = { id: 'flour', name: 'Flour', unit: 'kilogram', stock: 50, costPrice: 100 };
const loaf = (over = {}) => ({
  id: 'loaf', name: 'Loaf', stock: 0, costPrice: 0, producedInAdvance: true, recipeYield: 20,
  recipe: [{ componentId: 'flour', quantity: 0.5 }],
  ...over,
});

test('H05: a short yield consumes the PLAN and spreads its cost over what came out', () => {
  const plan = planProduction(loaf(), [loaf(), flour], { batches: 1, actualQuantity: 18 });
  assert.equal(plan.plannedQuantity, 20);
  assert.equal(plan.quantity, 18);
  assert.equal(plan.totalCost, 1000, '10 kg of flour at 100');
  assert.equal(plan.unitCost, 55.56, '1,000 over 18, not over 20');
  const deltas = productionDeltas(plan, [loaf(), flour]);
  assert.equal(deltas.flour.total, -10, 'flour for twenty');
  assert.equal(deltas.loaf.total, 18);
});

test('a batch that produced nothing still takes its ingredients', () => {
  const plan = planProduction(loaf(), [loaf(), flour], { batches: 1, actualQuantity: 0 });
  const deltas = productionDeltas(plan, [loaf(), flour]);
  assert.equal(deltas.flour.total, -10);
  assert.equal(deltas.loaf, undefined);
});

test('H06: a run with a missing ingredient moves nothing at all', () => {
  const plan = planProduction(loaf(), [loaf()], { batches: 1 });
  assert.equal(plan.missing, true);
  assert.deepEqual(productionDeltas(plan, [loaf()]), {});
});

test('H06: a made-to-order dough is consumed down to its flour and costed from it', () => {
  const dough = { id: 'dough', name: 'Dough', unit: 'kilogram', stock: 0, costPrice: 999, recipe: [{ componentId: 'flour', quantity: 0.8 }] };
  const bread = loaf({ recipeYield: 1, recipe: [{ componentId: 'dough', quantity: 0.5 }] });
  const products = [bread, dough, flour];
  const plan = planProduction(bread, products, { batches: 10 });
  assert.equal(plan.shortfall, false);
  assert.equal(plan.totalCost, 400, '5 kg of dough is 4 kg of flour at 100 — not the 999 on the dough');
  const deltas = productionDeltas(plan, products);
  assert.equal(deltas.flour.total, -4);
  assert.equal(deltas.dough, undefined, 'the dough has no stock of its own to deduct');
  assert.equal(deltas.loaf.total, 10);
});

test('H10: waste of a product with versions or batches must say which', () => {
  const shirt = { id: 'shirt', name: 'Shirt', stock: 10, variants: [{ id: 'm', label: 'M' }], variantOptions: [{ name: 'Size', values: ['M'] }], variantStock: { m: 10 } };
  assert.match(wasteSubledgerProblem({}, shirt), /which version/);
  assert.equal(wasteSubledgerProblem({ variantId: 'm' }, shirt), null);

  const drug = { id: 'drug', name: 'Drug', stock: 4, costPrice: 12 };
  const batches = [{ id: 'A', productId: 'drug', remainingQuantity: 4, costPrice: 20 }];
  assert.match(wasteSubledgerProblem({}, drug, { batches }), /which batch/);

  const record = buildWasteRecord({ quantity: 2, batchId: 'A', unitCost: 20 }, drug);
  assert.equal(record.totalCost, 40, 'costed at the batch that went off');
  const deltas = resolveWasteDeltas([record], [drug]);
  assert.deepEqual([deltas.drug.total, deltas.drug.batches.A], [-2, -2]);
});
