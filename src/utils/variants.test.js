// Phase 4 gate — variants and variant-level stock.
//
// The property that matters most here is that editing an option list
// never loses stock. A boutique adding "XL" to its size run must not
// discover that every Black/M it had is now zero.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVariantOptions, generateVariants, variantIdFor, hasVariants,
  variantsOf, findVariant, totalVariantStock, orphanedVariantStock,
  findVariantByBarcode,
  MAX_OPTION_TYPES, MAX_VARIANTS,
} from './variants.js';
import { resolveStockDeltas } from './inventory.js';

const OPTIONS = [
  { name: 'Color', values: ['Black', 'White'] },
  { name: 'Size', values: ['S', 'M', 'L'] },
];

function tshirt(over = {}) {
  const generated = generateVariants(OPTIONS);
  return {
    id: 'p1', name: 'Cotton T-Shirt', sellingPrice: 800, costPrice: 500,
    variantOptions: generated.options,
    variants: generated.variants,
    variantStock: { ...generated.variantStock, 'black__s': 4, 'black__m': 6, 'white__l': 2 },
    stock: 12,
    ...over,
  };
}

// ── Generation ───────────────────────────────────────────────────────

test('two option types generate every combination, in definition order', () => {
  const { variants } = generateVariants(OPTIONS);
  assert.equal(variants.length, 6);
  assert.deepEqual(variants.map((v) => v.label), [
    'Black / S', 'Black / M', 'Black / L', 'White / S', 'White / M', 'White / L',
  ]);
  assert.deepEqual(variants[0].options, { Color: 'Black', Size: 'S' });
});

test('a variant id is derived from its values, so it survives every other edit', () => {
  assert.equal(variantIdFor(['Black', 'M']), 'black__m');
  assert.equal(variantIdFor(['BLACK', 'm']), 'black__m', 'case must not create a second variant');
  assert.equal(variantIdFor(['Navy Blue', 'XL']), 'navy-blue__xl');
  assert.equal(variantIdFor([]), 'default');
});

test('a variant id can never contain a dot, which would break the Firestore field path', () => {
  for (const values of [['2.5', 'M'], ['a.b.c'], ['../../x'], ['Black/White']]) {
    assert.equal(variantIdFor(values).includes('.'), false, values.join());
    assert.equal(variantIdFor(values).includes('/'), false, values.join());
    assert.match(variantIdFor(values), /^[a-z0-9_-]+$/);
  }
});

// ── The property that matters: editing never loses stock ─────────────

test('adding a size keeps every existing variant stock exactly where it was', () => {
  const before = tshirt();
  const after = generateVariants(
    [{ name: 'Color', values: ['Black', 'White'] }, { name: 'Size', values: ['S', 'M', 'L', 'XL'] }],
    before
  );
  assert.equal(after.variants.length, 8);
  assert.equal(after.variantStock['black__s'], 4);
  assert.equal(after.variantStock['black__m'], 6);
  assert.equal(after.variantStock['white__l'], 2);
  assert.equal(after.variantStock['black__xl'], 0, 'a brand-new combination starts at zero');
});

test('removing a size does NOT delete the stock recorded against it', () => {
  const before = tshirt();
  const after = generateVariants(
    [{ name: 'Color', values: ['Black', 'White'] }, { name: 'Size', values: ['S', 'M'] }],
    before
  );
  assert.equal(after.variants.length, 4);
  assert.equal(after.variantStock['white__l'], 2, 'those two shirts are still physically in the shop');
  assert.equal(after.variants.some((v) => v.id === 'white__l'), false, 'but it is no longer offered');
});

test('per-variant price and barcode overrides survive a regeneration', () => {
  const before = tshirt();
  before.variants = before.variants.map((v) =>
    v.id === 'black__m' ? { ...v, sellingPrice: 950, barcode: '6001112223334' } : v
  );
  const after = generateVariants(
    [{ name: 'Color', values: ['Black', 'White'] }, { name: 'Size', values: ['S', 'M', 'L'] }],
    before
  );
  const blackM = after.variants.find((v) => v.id === 'black__m');
  assert.equal(blackM.sellingPrice, 950);
  assert.equal(blackM.barcode, '6001112223334');
});

test('reordering the values in an option does not renumber anything', () => {
  const before = tshirt();
  const after = generateVariants(
    [{ name: 'Color', values: ['White', 'Black'] }, { name: 'Size', values: ['L', 'M', 'S'] }],
    before
  );
  assert.equal(after.variantStock['black__m'], 6);
  assert.equal(after.variants.length, 6);
});

// ── Bounds and hostile input ─────────────────────────────────────────

test('option definitions are bounded — no fourth option type, no duplicate names', () => {
  const options = normalizeVariantOptions([
    { name: 'Color', values: ['Black'] },
    { name: 'Size', values: ['S'] },
    { name: 'Fabric', values: ['Cotton'] },
    { name: 'Fit', values: ['Slim'] },
    { name: 'color', values: ['Red'] },
  ]);
  assert.equal(options.length, MAX_OPTION_TYPES);
  assert.deepEqual(options.map((o) => o.name), ['Color', 'Size', 'Fabric']);
});

test('duplicate, blank and whitespace values are cleaned rather than stored', () => {
  const options = normalizeVariantOptions([
    { name: '  Size  ', values: ['S', 's', ' S ', '', '   ', 'M', null, undefined] },
    { name: '', values: ['X'] },
    { name: 'Empty', values: [] },
  ]);
  assert.deepEqual(options, [{ name: 'Size', values: ['S', 'M'] }]);
});

test('the total variant count is capped', () => {
  const big = generateVariants([
    { name: 'A', values: Array.from({ length: 30 }, (_, i) => `a${i}`) },
    { name: 'B', values: Array.from({ length: 30 }, (_, i) => `b${i}`) },
  ]);
  assert.equal(big.variants.length, MAX_VARIANTS);
});

test('malformed option input yields no variants rather than throwing', () => {
  for (const input of [null, undefined, 'Size', 42, [{}], [{ name: 'X' }], [{ values: ['a'] }]]) {
    const result = generateVariants(input);
    assert.deepEqual(result.variants, [], JSON.stringify(input));
    assert.deepEqual(result.options, []);
  }
});

// ── Resolution ───────────────────────────────────────────────────────

test('a variant with no price override inherits the product price', () => {
  const resolved = variantsOf(tshirt());
  assert.equal(resolved.every((v) => v.sellingPrice === 800), true);
  assert.equal(resolved.every((v) => v.costPrice === 500), true);
});

test('a variant price override wins over the product price', () => {
  const product = tshirt();
  product.variants = product.variants.map((v) =>
    v.id === 'black__l' ? { ...v, sellingPrice: 950, costPrice: 600 } : v
  );
  assert.equal(findVariant(product, 'black__l').sellingPrice, 950);
  assert.equal(findVariant(product, 'black__l').costPrice, 600);
  assert.equal(findVariant(product, 'black__s').sellingPrice, 800);
});

test('each variant carries its own stock, and an unstocked one reads zero', () => {
  const resolved = variantsOf(tshirt());
  assert.equal(resolved.find((v) => v.id === 'black__s').stock, 4);
  assert.equal(resolved.find((v) => v.id === 'black__m').stock, 6);
  assert.equal(resolved.find((v) => v.id === 'white__s').stock, 0);
});

test('a product with no variants resolves to an empty list, not an error', () => {
  assert.equal(hasVariants({ name: 'Sukari' }), false);
  assert.deepEqual(variantsOf({ name: 'Sukari' }), []);
  assert.equal(findVariant({ name: 'Sukari' }, 'x'), null);
  assert.equal(totalVariantStock(null), 0);
  assert.deepEqual(orphanedVariantStock(null), []);
});

test('the total counts every recorded variant, including combinations no longer offered', () => {
  const product = tshirt();
  assert.equal(totalVariantStock(product), 12);
  product.variantStock['red__xxl'] = 3; // a combination that was removed
  assert.equal(totalVariantStock(product), 15, 'those three shirts are still in the shop');
  assert.deepEqual(orphanedVariantStock(product), [{ id: 'red__xxl', quantity: 3 }]);
});

// ── Scanning ─────────────────────────────────────────────────────────

test('a scan of a variant barcode lands on the variant, not the parent product', () => {
  const product = tshirt();
  product.variants = product.variants.map((v) =>
    v.id === 'white__l' ? { ...v, barcode: '6009998887776' } : v
  );
  const hit = findVariantByBarcode([product], '6009998887776');
  assert.equal(hit.product.id, 'p1');
  assert.equal(hit.variant.id, 'white__l');
  assert.equal(hit.variant.stock, 2);
  assert.equal(findVariantByBarcode([product], '0000000000000'), null);
  assert.equal(findVariantByBarcode([product], ''), null);
  assert.equal(findVariantByBarcode(null, '6009998887776'), null);
});

// ── The stock a sale actually takes ──────────────────────────────────

test('selling a variant decrements both the variant and the product total', () => {
  const product = tshirt();
  const deltas = resolveStockDeltas(
    [{ productId: 'p1', variantId: 'black__m', quantity: 2 }],
    [product]
  );
  assert.deepEqual(deltas, { p1: { total: -2, variants: { black__m: -2 }, batches: {} } });
});

test('two variants of the same product in one sale roll into one total delta', () => {
  const product = tshirt();
  const deltas = resolveStockDeltas([
    { productId: 'p1', variantId: 'black__m', quantity: 2 },
    { productId: 'p1', variantId: 'white__l', quantity: 1 },
  ], [product]);
  assert.deepEqual(deltas, { p1: { total: -3, variants: { black__m: -2, white__l: -1 }, batches: {} } });
});

test('the same variant twice in one cart accumulates rather than overwriting', () => {
  const deltas = resolveStockDeltas([
    { productId: 'p1', variantId: 'black__m', quantity: 2 },
    { productId: 'p1', variantId: 'black__m', quantity: 3 },
  ], [tshirt()]);
  assert.deepEqual(deltas, { p1: { total: -5, variants: { black__m: -5 }, batches: {} } });
});

test('a plain product without variants gets a total delta and no variant deltas', () => {
  const deltas = resolveStockDeltas(
    [{ productId: 's1', quantity: 3 }],
    [{ id: 's1', name: 'Sukari', stock: 10 }]
  );
  assert.deepEqual(deltas, { s1: { total: -3, variants: {}, batches: {} } });
});

test('a service takes no stock at all', () => {
  const deltas = resolveStockDeltas(
    [{ productId: 'h1', quantity: 1 }],
    [{ id: 'h1', name: 'Haircut', kind: 'service' }]
  );
  assert.deepEqual(deltas, {});
});

test('a measured variant decrements in its own unit precision', () => {
  const fabric = {
    id: 'f1', name: 'Cotton fabric', unit: 'metre', sellingPrice: 300,
    variants: [{ id: 'blue', label: 'Blue', options: { Color: 'Blue' } }],
    variantStock: { blue: 20 },
  };
  const deltas = resolveStockDeltas([{ productId: 'f1', variantId: 'blue', quantity: 2.5 }], [fabric]);
  assert.deepEqual(deltas, { f1: { total: -2.5, variants: { blue: -2.5 }, batches: {} } });
});

test('a sale of a product that has vanished produces no delta rather than throwing', () => {
  assert.deepEqual(resolveStockDeltas([{ productId: 'gone', quantity: 1 }], [tshirt()]), {});
  assert.deepEqual(resolveStockDeltas(null, null), {});
  assert.deepEqual(resolveStockDeltas([{ productId: 'p1', quantity: 0 }], [tshirt()]), {});
});
