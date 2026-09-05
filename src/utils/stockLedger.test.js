// The stock ledger invariants — Phase B.
//
// FlowBiz keeps three views of the same stock: the product total, the
// per-version map, and the per-batch remainders. Every one of them must
// agree, after every operation, in both directions. Before this phase
// four separate code paths wrote stock with a raw increment and three of
// them moved only the total, so a boutique's sizes and a pharmacy's lots
// drifted away from the number the counter sells against.
//
// These tests exercise the INVARIANT rather than the call sites: they
// apply resolved deltas to a plain in-memory shop and assert that the
// three views still sum to each other.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveStockDeltas, resolveReceiptDeltas, resolveCountDeltas,
  negateDeltas, stockWriteOps,
} from './inventory.js';
import { totalVariantStock } from './variants.js';
import { roundQuantity } from '../industry/units.js';

// ── A tiny in-memory shop that applies deltas exactly as Firestore
//    increments would, so the invariant is checked on real arithmetic.

function applyToShop(products, batches, deltas) {
  const nextProducts = products.map((p) => ({
    ...p,
    variantStock: p.variantStock ? { ...p.variantStock } : undefined,
  }));
  const nextBatches = batches.map((b) => ({ ...b }));
  for (const op of stockWriteOps(deltas)) {
    if (op.collection === 'products') {
      const product = nextProducts.find((p) => p.id === op.id);
      for (const [field, value] of Object.entries(op.fields)) {
        if (field === 'stock') {
          product.stock = roundQuantity((Number(product.stock) || 0) + value, product.unit);
        } else {
          const variantId = field.slice('variantStock.'.length);
          product.variantStock = product.variantStock || {};
          product.variantStock[variantId] =
            roundQuantity((Number(product.variantStock[variantId]) || 0) + value, product.unit);
        }
      }
    } else {
      const batch = nextBatches.find((b) => b.id === op.id);
      batch.remainingQuantity = roundQuantity(
        (Number(batch.remainingQuantity) || 0) + op.fields.remainingQuantity, batch.unit
      );
    }
  }
  return { products: nextProducts, batches: nextBatches };
}

const assertVariantInvariant = (product, note) =>
  assert.equal(
    totalVariantStock(product), roundQuantity(product.stock, product.unit),
    `${note}: variant stock must sum to product stock`
  );

const assertBatchInvariant = (product, batches, note) =>
  assert.equal(
    roundQuantity(
      batches.filter((b) => b.productId === product.id)
        .reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0),
      product.unit
    ),
    roundQuantity(product.stock, product.unit),
    `${note}: batch remainders must sum to product stock`
  );

// ── B1: variant stock can be received and counted ────────────────────

const SHIRT = () => ({
  id: 'shirt', name: 'Shirt', stock: 9, costPrice: 300, sellingPrice: 700,
  variants: [
    { id: 'black__s', label: 'Black / S' },
    { id: 'black__m', label: 'Black / M' },
    { id: 'white__m', label: 'White / M' },
  ],
  variantStock: { black__s: 2, black__m: 4, white__m: 3 },
});

test('a purchase of one version raises that version AND the product total', () => {
  const shirt = SHIRT();
  const deltas = resolveReceiptDeltas([{ productId: 'shirt', variantId: 'black__m', quantity: 6 }], [shirt]);
  assert.equal(deltas.shirt.total, 6);
  assert.equal(deltas.shirt.variants.black__m, 6);

  const after = applyToShop([shirt], [], deltas).products[0];
  assert.equal(after.stock, 15);
  assert.equal(after.variantStock.black__m, 10);
  assertVariantInvariant(after, 'after a purchase');
});

test('the invariant survives a purchase, a sale, a void and a stock take in sequence', () => {
  let shop = { products: [SHIRT()], batches: [] };
  const shirt = () => shop.products[0];

  // Receive 6 Black / M.
  shop = applyToShop(shop.products, shop.batches,
    resolveReceiptDeltas([{ productId: 'shirt', variantId: 'black__m', quantity: 6 }], shop.products));
  assertVariantInvariant(shirt(), 'purchase');
  assert.equal(shirt().stock, 15);

  // Sell 2 Black / M and 1 White / M.
  const saleRows = [
    { productId: 'shirt', variantId: 'black__m', quantity: 2 },
    { productId: 'shirt', variantId: 'white__m', quantity: 1 },
  ];
  shop = applyToShop(shop.products, shop.batches, resolveStockDeltas(saleRows, shop.products));
  assertVariantInvariant(shirt(), 'sale');
  assert.equal(shirt().stock, 12);
  assert.equal(shirt().variantStock.black__m, 8);

  // Void that same sale.
  shop = applyToShop(shop.products, shop.batches,
    resolveStockDeltas(saleRows, shop.products, { reverse: true }));
  assertVariantInvariant(shirt(), 'void');
  assert.equal(shirt().stock, 15);
  assert.equal(shirt().variantStock.black__m, 10);
  assert.equal(shirt().variantStock.white__m, 3);

  // Count: two of the Black / M have walked.
  shop = applyToShop(shop.products, shop.batches,
    resolveCountDeltas([{ productId: 'shirt', variantId: 'black__m', counted: 8 }], shop.products));
  assertVariantInvariant(shirt(), 'stock take');
  assert.equal(shirt().stock, 13);
  assert.equal(shirt().variantStock.black__m, 8);
});

test('counting one version leaves every other version exactly where it was', () => {
  const shirt = SHIRT();
  const after = applyToShop([shirt], [],
    resolveCountDeltas([{ productId: 'shirt', variantId: 'black__s', counted: 0 }], [shirt])).products[0];
  assert.equal(after.variantStock.black__s, 0);
  assert.equal(after.variantStock.black__m, 4);
  assert.equal(after.variantStock.white__m, 3);
  assert.equal(after.stock, 7);
  assertVariantInvariant(after, 'single-version count');
});

// ── B4: the batch ledger stays in step with the product total ────────

const DRUG = () => ({ id: 'amox', name: 'Amoxicillin', stock: 120, costPrice: 8, unit: 'piece' });
const LOTS = () => ([
  { id: 'lotA', productId: 'amox', batchNumber: 'A1', expiryDate: '2026-11-30', quantity: 50, remainingQuantity: 50, costPrice: 8 },
  { id: 'lotB', productId: 'amox', batchNumber: 'B2', expiryDate: '2027-03-31', quantity: 70, remainingQuantity: 70, costPrice: 9 },
]);

test('a per-batch count moves the batch remainder and the product total together', () => {
  const drug = DRUG();
  const lots = LOTS();
  // The earliest lot is four short on the shelf.
  const deltas = resolveCountDeltas(
    [{ productId: 'amox', batchId: 'lotA', counted: 46 }], [drug], { batches: lots }
  );
  assert.equal(deltas.amox.total, -4);
  assert.equal(deltas.amox.batches.lotA, -4);

  const after = applyToShop([drug], lots, deltas);
  assert.equal(after.products[0].stock, 116);
  assert.equal(after.batches.find((b) => b.id === 'lotA').remainingQuantity, 46);
  assert.equal(after.batches.find((b) => b.id === 'lotB').remainingQuantity, 70, 'the other lot is untouched');
  assertBatchInvariant(after.products[0], after.batches, 'per-batch count');
});

test('counting every batch of a product reconciles the whole product', () => {
  const drug = DRUG();
  const lots = LOTS();
  const after = applyToShop([drug], lots, resolveCountDeltas([
    { productId: 'amox', batchId: 'lotA', counted: 48 },
    { productId: 'amox', batchId: 'lotB', counted: 65 },
  ], [drug], { batches: lots }));
  assert.equal(after.products[0].stock, 113);
  assertBatchInvariant(after.products[0], after.batches, 'full reconciliation');
});

test('the invariant survives a batched sale followed by its void', () => {
  const drug = DRUG();
  const lots = LOTS();
  const rows = [{
    productId: 'amox', quantity: 60,
    batchAllocations: [{ batchId: 'lotA', quantity: 50 }, { batchId: 'lotB', quantity: 10 }],
  }];

  let shop = applyToShop([drug], lots, resolveStockDeltas(rows, [drug]));
  assert.equal(shop.products[0].stock, 60);
  assert.equal(shop.batches.find((b) => b.id === 'lotA').remainingQuantity, 0);
  assertBatchInvariant(shop.products[0], shop.batches, 'FEFO sale');

  shop = applyToShop(shop.products, shop.batches, resolveStockDeltas(rows, shop.products, { reverse: true }));
  assert.equal(shop.products[0].stock, 120);
  assert.equal(shop.batches.find((b) => b.id === 'lotA').remainingQuantity, 50, 'stock goes back to the lot it came from');
  assertBatchInvariant(shop.products[0], shop.batches, 'void');
});

// ── Reversal is an exact negation, never a re-resolution ─────────────

test('reversing a sale is the exact negation of making it', () => {
  const shirt = SHIRT();
  const rows = [{ productId: 'shirt', variantId: 'white__m', quantity: 2 }];
  const forward = resolveStockDeltas(rows, [shirt]);
  const backward = resolveStockDeltas(rows, [shirt], { reverse: true });
  assert.deepEqual(backward, negateDeltas(forward));
  assert.deepEqual(negateDeltas(backward), forward);
});

test('a cancelled credit sale of a recipe dish puts the INGREDIENTS back, not the dish', () => {
  const bun = { id: 'bun', name: 'Bun', stock: 100 };
  const patty = { id: 'patty', name: 'Patty', stock: 40 };
  const burger = {
    id: 'burger', name: 'Burger', stock: 0,
    recipe: [{ componentId: 'bun', quantity: 1 }, { componentId: 'patty', quantity: 1 }],
  };
  const rows = [{ productId: 'burger', quantity: 3 }];
  const deltas = resolveStockDeltas(rows, [bun, patty, burger], { recipes: true, reverse: true });
  assert.equal(deltas.bun.total, 3);
  assert.equal(deltas.patty.total, 3);
  assert.equal(deltas.burger, undefined, 'the dish itself has no stock to restore');
});

// ── Decimal units stay exact through a whole cycle ───────────────────

test('a measured product survives receive, sell, reverse and count without drift', () => {
  const cable = { id: 'cable', name: 'Cable', unit: 'metre', stock: 100 };
  let shop = { products: [cable], batches: [] };
  const wire = () => shop.products[0];

  shop = applyToShop(shop.products, [], resolveReceiptDeltas([{ productId: 'cable', quantity: 12.5 }], shop.products));
  assert.equal(wire().stock, 112.5);

  for (let i = 0; i < 10; i += 1) {
    shop = applyToShop(shop.products, [], resolveStockDeltas([{ productId: 'cable', quantity: 0.1 }], shop.products));
  }
  assert.equal(wire().stock, 111.5, 'ten 0.1 m cuts must not accumulate float error');

  shop = applyToShop(shop.products, [], resolveCountDeltas([{ productId: 'cable', counted: 111.25 }], shop.products));
  assert.equal(wire().stock, 111.25);
});

// ── A blank count is not a count of zero ─────────────────────────────

test('a row the shop left blank produces no movement at all', () => {
  const shirt = SHIRT();
  for (const counted of [undefined, null, '']) {
    assert.deepEqual(resolveCountDeltas([{ productId: 'shirt', counted }], [shirt]), {});
  }
});

test('a count that matches the system figure writes nothing', () => {
  const shirt = SHIRT();
  assert.deepEqual(resolveCountDeltas([{ productId: 'shirt', counted: 9 }], [shirt]), {});
});

test('a service and a made-to-order dish are never countable', () => {
  const haircut = { id: 'cut', name: 'Haircut', kind: 'service', stock: 0 };
  const burger = { id: 'burger', name: 'Burger', stock: 0, recipe: [{ componentId: 'bun', quantity: 1 }] };
  assert.deepEqual(resolveCountDeltas([{ productId: 'cut', counted: 5 }], [haircut]), {});
  assert.deepEqual(resolveCountDeltas([{ productId: 'burger', counted: 5 }], [burger]), {});
});

test('resolveCountDeltas never throws on malformed input', () => {
  for (const rows of [null, undefined, 'nope', [null], [{}], [{ productId: 'ghost', counted: 3 }]]) {
    assert.doesNotThrow(() => resolveCountDeltas(rows, [SHIRT()]));
  }
  assert.doesNotThrow(() => resolveCountDeltas([{ productId: 'shirt', counted: -5 }], [SHIRT()]));
});

// ── The write plan is the one description of what moves ──────────────

test('write ops name the product, the version field and the batch document', () => {
  const shirt = SHIRT();
  const ops = stockWriteOps(resolveStockDeltas(
    [{ productId: 'shirt', variantId: 'black__m', quantity: 2, batchAllocations: [{ batchId: 'lot1', quantity: 2 }] }],
    [shirt]
  ));
  const product = ops.find((o) => o.collection === 'products');
  assert.deepEqual(product.fields, { stock: -2, 'variantStock.black__m': -2 });
  const batch = ops.find((o) => o.collection === 'productBatches');
  assert.deepEqual(batch.fields, { remainingQuantity: -2 });
  assert.equal(batch.productId, 'shirt', 'a batch op names its product so a skipped product takes it along');
});

test('a zero-movement delta map produces no writes at all', () => {
  assert.deepEqual(stockWriteOps({}), []);
  assert.deepEqual(stockWriteOps({ x: { total: 0, variants: {}, batches: {} } }), []);
});
