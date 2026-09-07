// The drinks trade — Bar, Wines & Spirits, and pack sizes (Phase C).
//
// Both profiles are DEFAULTS over capabilities that already existed. The
// test that matters most in this file is therefore the negative one: no
// bar engine, no drinks-only code path, and nothing General Retail gained.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIndustryConfig } from './config.js';
import { PROFILES, PROFILE_IDS } from './profiles.js';
import { CAPABILITIES, CAPABILITY_KEYS } from './capabilities.js';
import { UNITS, roundQuantity } from './units.js';
import {
  resolveStockDeltas, resolveReceiptDeltas, resolveCountDeltas,
  toBaseQuantity, packSizeOf, hasPackSize, packUnitOf, describePacks, MAX_PACK_SIZE,
} from '../utils/inventory.js';

// ── The two new profiles ─────────────────────────────────────────────

test('a bar is the food family with tabs, modifiers and recipes, and no kitchen by default', () => {
  const bar = resolveIndustryConfig({ industryProfile: 'BAR' });
  assert.equal(bar.family, 'FOOD');
  assert.equal(bar.can('orders'), true, 'a bar runs on tabs');
  assert.equal(bar.can('tables'), true);
  assert.equal(bar.can('diningModes'), true);
  assert.equal(bar.can('modifiers'), true);
  assert.equal(bar.can('recipes'), true, 'a cocktail consumes spirits');
  assert.equal(bar.can('units'), true);
  assert.equal(bar.can('packSizes'), true, 'a 750ml bottle pours into tots');
  assert.equal(bar.can('ageRestriction'), true);
  assert.equal(bar.can('kitchen'), false, 'bar snacks are optional, so the kitchen queue is off');
  assert.equal(bar.can('batches'), false);
  assert.equal(bar.can('variants'), false);
});

test('a bar that does serve food can turn the kitchen on without becoming a restaurant', () => {
  const bar = resolveIndustryConfig({ industryProfile: 'BAR', capabilityOverrides: { kitchen: true } });
  assert.equal(bar.can('kitchen'), true);
  assert.equal(bar.profileId, 'BAR');
});

test('a bar calls a ticket a tab, and it is the same document', () => {
  const bar = resolveIndustryConfig({ industryProfile: 'BAR' });
  assert.equal(bar.terms.catalogue, 'Drinks');
  assert.equal(bar.terms.order, 'tab');
  assert.equal(bar.terms.openOrders, 'Open tabs');
  // The wording changed; the capability that carries the data did not.
  assert.equal(bar.can('orders'), resolveIndustryConfig({ industryProfile: 'RESTAURANT' }).can('orders'));
});

test('a wines and spirits shop is retail selling sealed stock — no orders, no versions', () => {
  const shop = resolveIndustryConfig({ industryProfile: 'WINES_AND_SPIRITS' });
  assert.equal(shop.family, 'RETAIL');
  assert.equal(shop.can('barcodeLabels'), true);
  assert.equal(shop.can('units'), true);
  assert.equal(shop.can('packSizes'), true, 'a crate of 24 becomes 24 bottles');
  assert.equal(shop.can('ageRestriction'), true);
  assert.equal(shop.can('variants'), false, 'a 250ml and a 750ml are two products, not two sizes of one');
  assert.equal(shop.can('orders'), false, 'nothing is left open in a liquor shop');
  assert.equal(shop.can('recipes'), false);
  assert.equal(shop.can('kitchen'), false);
  assert.deepEqual(shop.dashboard, ['moneyToday', 'position', 'lowStock', 'activity']);
});

test('both drinks profiles offer the units the trade actually counts in', () => {
  const bar = resolveIndustryConfig({ industryProfile: 'BAR' });
  for (const unit of ['bottle', 'tot', 'crate']) {
    assert.ok(bar.units.includes(unit), `a bar must be able to count in ${unit}s`);
  }
  const shop = resolveIndustryConfig({ industryProfile: 'WINES_AND_SPIRITS' });
  for (const unit of ['bottle', 'crate', 'carton']) {
    assert.ok(shop.units.includes(unit), `a liquor shop must be able to count in ${unit}s`);
  }
  assert.ok(!shop.units.includes('tot'), 'a shop that sells sealed stock never pours a tot');
});

test('both drinks profiles ship the categories of the trade', () => {
  for (const id of ['BAR', 'WINES_AND_SPIRITS']) {
    const categories = resolveIndustryConfig({ industryProfile: id }).defaultCategories;
    for (const expected of ['Beer', 'Spirits', 'Wine']) {
      assert.ok(categories.includes(expected), `${id} must start with a ${expected} category`);
    }
  }
});

// ── No bar engine ────────────────────────────────────────────────────

test('neither new profile introduced a capability of its own', () => {
  // Every capability a drinks profile turns on must be one that already
  // serves another trade, or the shared one this phase justified.
  const shared = new Set(CAPABILITY_KEYS);
  for (const id of ['BAR', 'WINES_AND_SPIRITS']) {
    for (const key of Object.keys(PROFILES[id].capabilities)) {
      assert.ok(shared.has(key), `${id} invented the capability ${key}`);
    }
  }
  for (const forbidden of ['happyHour', 'priceLevels', 'reservations', 'splitBills', 'bottleService', 'loyalty', 'delivery']) {
    assert.equal(CAPABILITY_KEYS.includes(forbidden), false, `${forbidden} must not exist`);
  }
});

test('the units the drinks trade added are three, and each is a count', () => {
  for (const id of ['bottle', 'crate', 'tot']) {
    assert.ok(UNITS[id], `${id} must exist`);
    assert.equal(UNITS[id].group, 'count');
    assert.equal(UNITS[id].decimals, 0, 'you cannot stock half a bottle');
  }
});

// ── General Retail is untouched ──────────────────────────────────────

test('General Retail gained nothing at all from either new profile', () => {
  const retail = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' });
  for (const key of CAPABILITY_KEYS) {
    assert.equal(retail.can(key), false, `${key} must stay off for General Retail`);
  }
  assert.deepEqual(retail.units, ['piece']);
  assert.deepEqual(retail.dashboard, ['moneyToday', 'position', 'activity']);
  assert.equal(retail.terms.catalogue, 'Products');
  assert.equal(retail.categoryFilterThreshold, 40);
});

test('pack sizes and age restriction are off by default for every profile that did not ask for them', () => {
  const packExpected = new Set(['BAR', 'WINES_AND_SPIRITS', 'PHARMACY']);
  const ageExpected = new Set(['BAR', 'WINES_AND_SPIRITS']);
  for (const id of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: id });
    assert.equal(config.can('packSizes'), packExpected.has(id), `${id} packSizes`);
    assert.equal(config.can('ageRestriction'), ageExpected.has(id), `${id} ageRestriction`);
  }
});

test('pack sizes need units, so turning units off turns pack sizes off with them', () => {
  assert.deepEqual(CAPABILITIES.packSizes.requires, ['units']);
  const bar = resolveIndustryConfig({ industryProfile: 'BAR', capabilityOverrides: { units: false } });
  assert.equal(bar.can('units'), false);
  assert.equal(bar.can('packSizes'), false, 'a pack size with no units is a number with nothing to be a number of');
});

test('both new capabilities are owner-configurable, and the locked ones stayed locked', () => {
  assert.equal(CAPABILITIES.packSizes.ownerConfigurable, true);
  assert.equal(CAPABILITIES.ageRestriction.ownerConfigurable, true);
  assert.equal(CAPABILITIES.orders.ownerConfigurable, false);
  assert.equal(CAPABILITIES.batches.ownerConfigurable, false);
});

// ── Pack size arithmetic ─────────────────────────────────────────────

const GIN   = { id: 'gin',  name: 'Gin 750ml',   unit: 'tot',    packUnit: 'bottle', packSize: 25, stock: 0 };
const BEER  = { id: 'beer', name: 'Tusker 500ml', unit: 'bottle', packUnit: 'crate',  packSize: 25, stock: 0 };
const TABS  = { id: 'amox', name: 'Amoxicillin',  unit: 'piece',  packUnit: 'box',    packSize: 30, stock: 0 };
const PLAIN = { id: 'soda', name: 'Soda',         unit: 'bottle', stock: 40 };

test('receiving packs books in singles — a crate of 25 is 25 bottles', () => {
  const deltas = resolveReceiptDeltas([{ productId: 'beer', quantity: 4, pack: true }], [BEER], { packSizes: true });
  assert.equal(deltas.beer.total, 100, 'four crates of 25');
});

test('the three cases the capability was justified by all resolve exactly', () => {
  const cases = [
    [TABS, 2, 60,  'a pharmacy box of 30 tablets'],
    [GIN,  6, 150, 'a bar bottle poured as 25 tots'],
    [BEER, 3, 75,  'a liquor crate of 25 bottles'],
  ];
  for (const [product, packs, expected, note] of cases) {
    const deltas = resolveReceiptDeltas(
      [{ productId: product.id, quantity: packs, pack: true }], [product], { packSizes: true }
    );
    assert.equal(deltas[product.id].total, expected, note);
  }
});

test('a sale is always in singles and is never converted', () => {
  const deltas = resolveStockDeltas([{ productId: 'gin', quantity: 3 }], [GIN], { packSizes: true });
  assert.equal(deltas.gin.total, -3, 'three tots is three tots');
});

test('a partial pack lands on a whole sellable thing, never on half a bottle', () => {
  // Half a crate of 25 is 12 bottles. The rounding is the unit's own —
  // `bottle` carries no decimals — so the answer is the physical truth
  // rather than 12.5 of something that does not divide.
  assert.equal(toBaseQuantity(BEER, 0.5, { pack: true, packSizes: true }), 12);
  assert.equal(toBaseQuantity(TABS, 1.5, { pack: true, packSizes: true }), 45, 'a box and a half of 30');
  assert.equal(toBaseQuantity(GIN, 2.5, { pack: true, packSizes: true }), 62, 'two and a half bottles of 25 tots');
});

test('a pack conversion into a decimal unit keeps that unit’s precision', () => {
  const syrup = { id: 'syr', name: 'Syrup', unit: 'litre', packUnit: 'carton', packSize: 1.5 };
  assert.equal(toBaseQuantity(syrup, 3, { pack: true, packSizes: true }), 4.5);
  const spice = { id: 'spc', name: 'Spice', unit: 'kilogram', packUnit: 'box', packSize: 1.125 };
  assert.equal(toBaseQuantity(spice, 3, { pack: true, packSizes: true }), 3.375, 'three decimals, exactly');
});

test('with the capability off a pack row is taken at face value rather than silently converted', () => {
  // The safe direction: a business that has not turned pack sizes on must
  // never have a quantity multiplied behind its back.
  const deltas = resolveReceiptDeltas([{ productId: 'beer', quantity: 4, pack: true }], [BEER]);
  assert.equal(deltas.beer.total, 4);
});

test('a product with no pack size converts by one, whatever is asked of it', () => {
  assert.equal(packSizeOf(PLAIN), 1);
  assert.equal(hasPackSize(PLAIN), false);
  assert.equal(packUnitOf(PLAIN), null);
  assert.equal(toBaseQuantity(PLAIN, 7, { pack: true, packSizes: true }), 7);
});

test('a hostile or absurd pack size cannot move stock by an absurd amount', () => {
  for (const packSize of [null, undefined, 'many', NaN, Infinity, -5, 0, 1, {}, []]) {
    assert.equal(packSizeOf({ ...BEER, packSize }), 1, `${JSON.stringify(packSize)} must be the identity`);
  }
  assert.equal(packSizeOf({ ...BEER, packSize: 1e9 }), MAX_PACK_SIZE, 'bounded, not unbounded');
});

test('a count is always in singles — you count the bottles, not the crates', () => {
  const stocked = { ...BEER, stock: 100 };
  const deltas = resolveCountDeltas([{ productId: 'beer', counted: 96 }], [stocked]);
  assert.equal(deltas.beer.total, -4, 'four bottles short, not four crates');
});

test('receiving then selling then reversing leaves the shelf exactly where it started', () => {
  const beer = { ...BEER, stock: 0 };
  const received = resolveReceiptDeltas([{ productId: 'beer', quantity: 2, pack: true }], [beer], { packSizes: true });
  const after = roundQuantity(beer.stock + received.beer.total, 'bottle');
  assert.equal(after, 50);

  const sold = resolveStockDeltas([{ productId: 'beer', quantity: 6 }], [{ ...beer, stock: after }], { packSizes: true });
  const afterSale = roundQuantity(after + sold.beer.total, 'bottle');
  assert.equal(afterSale, 44);

  const reversed = resolveStockDeltas([{ productId: 'beer', quantity: 6 }], [{ ...beer, stock: afterSale }], { packSizes: true, reverse: true });
  assert.equal(roundQuantity(afterSale + reversed.beer.total, 'bottle'), 50);
});

test('packs are described for a human without ever being used as a stock figure', () => {
  assert.deepEqual(describePacks(BEER, 63), { packs: 2, loose: 13, packSize: 25, packUnit: 'crate' });
  assert.deepEqual(describePacks(BEER, 50), { packs: 2, loose: 0, packSize: 25, packUnit: 'crate' });
  assert.equal(describePacks(PLAIN, 40), null, 'nothing to describe without a pack');
});

test('pack helpers never throw on malformed input', () => {
  for (const bad of [null, undefined, 'nope', 42, [], {}]) {
    assert.doesNotThrow(() => packSizeOf(bad));
    assert.doesNotThrow(() => hasPackSize(bad));
    assert.doesNotThrow(() => packUnitOf(bad));
    assert.doesNotThrow(() => describePacks(bad, 10));
    assert.doesNotThrow(() => toBaseQuantity(bad, 5, { pack: true, packSizes: true }));
  }
});
