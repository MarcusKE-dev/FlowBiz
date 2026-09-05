// Industry-aware categories.
//
// A category list has two halves that behave differently, and the whole
// point of this file is to pin down which half wins where:
//
//   the TRADE's starting groups, which follow the profile, and
//   the BUSINESS's own words, which follow the business.
//
// Only the second half is stored. What is being tested here is that a
// business always sees its OWN trade's groups plus its OWN words — never
// another trade's — and that no path through this code ever loses a word
// an owner typed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIndustryConfig } from './config.js';
import {
  resolveCategoryModel, sanitizeCategories, categoryWritePayload, resetCategoriesPayload,
  LEGACY_DEFAULT_CATEGORIES, MAX_CATEGORIES, MAX_CATEGORY_LENGTH,
} from './categories.js';
import { PROFILES, PROFILE_IDS, getProfile } from './profiles.js';

const legacy = () => [...LEGACY_DEFAULT_CATEGORIES];

// ── Each trade gets its own list, and only its own ───────────────────

test('every profile starts on its own categories and on no other profile\'s', () => {
  for (const id of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: id });
    assert.deepEqual(
      config.categories, PROFILES[id].categories,
      `${id} must start on exactly the categories its profile ships`
    );
    assert.equal(config.usesDefaultCategories, true);
  }
});

test('four structurally different trades each get their trade and not the others', () => {
  const expectations = {
    ELECTRONICS:       { present: ['Phones', 'Computers', 'Cables & Chargers'], absent: ['Timber', 'Antibiotics', 'Beer'] },
    HARDWARE:          { present: ['Timber', 'Plumbing', 'Fasteners'],          absent: ['Phones', 'Antibiotics', 'Beer'] },
    PHARMACY:          { present: ['Prescription', 'Antibiotics', 'First Aid'], absent: ['Phones', 'Timber', 'Beer'] },
    WINES_AND_SPIRITS: { present: ['Beer', 'Spirits', 'Wine'],                  absent: ['Phones', 'Timber', 'Antibiotics'] },
  };
  for (const [id, { present, absent }] of Object.entries(expectations)) {
    const categories = resolveIndustryConfig({ industryProfile: id }).categories;
    for (const name of present) assert.ok(categories.includes(name), `${id} must offer ${name}`);
    for (const name of absent) assert.ok(!categories.includes(name), `${id} must not offer another trade's ${name}`);
  }
});

test('a bar and a wines-and-spirits shop share a trade but not a category list', () => {
  const bar = resolveIndustryConfig({ industryProfile: 'BAR' }).categories;
  const shop = resolveIndustryConfig({ industryProfile: 'WINES_AND_SPIRITS' }).categories;
  assert.ok(bar.includes('Cocktails'), 'a bar mixes drinks');
  assert.ok(!shop.includes('Cocktails'), 'a liquor shop sells sealed stock');
  assert.ok(shop.includes('Ready to Drink'));
});

// ── THE BUG: a fossil list must not mask the trade's own groups ──────
//
// Every business created before the industry layer had the same seven
// words physically written into its settings document by SettingsContext
// and by Setup. Under the previous rule — "a stored list wins, always" —
// that fossil was returned verbatim, so a supermarket was shown a general
// shop's categories and no industry default was ever reachable.

test('a supermarket carrying the fossil list is shown SUPERMARKET categories', () => {
  const config = resolveIndustryConfig({ industryProfile: 'SUPERMARKET', categories: legacy() });
  assert.ok(config.categories.includes('Groceries'));
  assert.ok(config.categories.includes('Fresh Produce'));
  assert.ok(!config.categories.includes('Hardware'), 'a supermarket is not a hardware shop');
});

test('no trade is shown another trade\'s categories because of the fossil list', () => {
  // The words that only ever appear in ONE profile, so their presence is
  // proof of cross-industry leakage rather than a legitimate overlap.
  const exclusive = {
    HARDWARE: 'Timber', PHARMACY: 'Antibiotics', ELECTRONICS: 'Phones',
    RESTAURANT: 'Main Course', BAR: 'Cocktails', SUPERMARKET: 'Fresh Produce',
    BAKERY: 'Bread', SALON: 'Braiding', BOUTIQUE: 'Dresses',
  };
  for (const id of Object.keys(exclusive)) {
    const categories = resolveIndustryConfig({ industryProfile: id, categories: legacy() }).categories;
    assert.ok(categories.includes(exclusive[id]), `${id} must reach its own ${exclusive[id]}`);
    for (const [otherId, word] of Object.entries(exclusive)) {
      if (otherId === id) continue;
      assert.ok(!categories.includes(word), `${id} must not be shown ${otherId}'s ${word}`);
    }
    // And nothing from the fossil that its own trade does not also ship.
    for (const fossil of LEGACY_DEFAULT_CATEGORIES) {
      if (PROFILES[id].categories.includes(fossil)) continue;
      assert.ok(!categories.includes(fossil), `${id} must not keep the fossil's ${fossil}`);
    }
  }
});

test('a general shop carrying the fossil list sees exactly what it sees today', () => {
  // General Retail's profile list IS the legacy list, so the business
  // that was never given a trade is byte-for-byte unaffected.
  const config = resolveIndustryConfig({ categories: legacy() });
  assert.deepEqual(config.categories, LEGACY_DEFAULT_CATEGORIES);
  assert.deepEqual(resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL', categories: legacy() }).categories,
    LEGACY_DEFAULT_CATEGORIES);
});

// ── Nothing an owner typed is ever lost ──────────────────────────────

test('a word an owner added to the fossil list survives into their own trade', () => {
  const stored = [...legacy(), 'Veterinary'];
  const config = resolveIndustryConfig({ industryProfile: 'PHARMACY', categories: stored });
  assert.ok(config.categories.includes('Veterinary'), 'the owner\'s word is theirs');
  assert.ok(config.categories.includes('Prescription'), 'and the trade\'s groups are reachable');
  assert.deepEqual(config.customCategories, ['Veterinary']);
});

test('a fossil default an owner removed stays removed', () => {
  const stored = legacy().filter((c) => c !== 'Stationery');
  const config = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL', categories: stored });
  assert.ok(!config.categories.includes('Stationery'));
  assert.deepEqual(config.categories, stored);
});

test('an order an owner arranged is kept; an order nobody chose is not imposed', () => {
  // Rearranged: their sequence wins.
  const arranged = ['Other', 'Beverages', 'Hardware'];
  assert.deepEqual(
    resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL', categories: arranged }).categories,
    arranged
  );
  // Untouched fossil: the trade's own running order wins, not the order
  // the legacy constant happened to be typed in.
  const supermarket = resolveIndustryConfig({ industryProfile: 'SUPERMARKET', categories: legacy() });
  assert.equal(supermarket.categories[0], 'Groceries');
});

test('the two-part model, once stored, is what is read back', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'ELECTRONICS',
    customCategories: ['Solar Kits'],
    hiddenCategories: ['Storage'],
    categoryOrder: ['Solar Kits', 'Phones'],
    // A stale compatibility mirror must never win over the model.
    categories: ['Nonsense', 'Fossil'],
  });
  assert.equal(config.categories[0], 'Solar Kits');
  assert.equal(config.categories[1], 'Phones');
  assert.ok(!config.categories.includes('Storage'), 'a hidden default stays hidden');
  assert.ok(!config.categories.includes('Nonsense'), 'the mirror is never read back');
  assert.ok(config.categories.includes('Computers'), 'defaults it never touched are still offered');
});

// ── Correcting a business's trade keeps its own words ────────────────

test('changing trade swaps the defaults and keeps every word the business added', () => {
  // An electronics shop that added two of its own words, then corrected
  // to a pharmacy — the scenario in the brief.
  const stored = categoryWritePayload(
    [...PROFILES.ELECTRONICS.categories, 'Solar Kits', 'Repairs Bench'],
    'ELECTRONICS'
  );
  const after = resolveIndustryConfig({ industryProfile: 'PHARMACY', ...stored });
  assert.ok(after.categories.includes('Solar Kits'));
  assert.ok(after.categories.includes('Repairs Bench'));
  assert.ok(after.categories.includes('Prescription'), 'the new trade\'s groups arrive');
  assert.ok(!after.categories.includes('Phones'), 'the old trade\'s groups do not follow');
});

test('a group hidden under one trade is inert under a trade that does not ship it', () => {
  // A bar that took 'Cocktails' off its list, then corrected to a
  // pharmacy. 'Cocktails' is not a pharmacy group, so the stored removal
  // has nothing to act on and every pharmacy group is offered.
  const stored = categoryWritePayload(
    PROFILES.BAR.categories.filter((c) => c !== 'Cocktails'),
    'BAR'
  );
  const asPharmacy = resolveIndustryConfig({ industryProfile: 'PHARMACY', ...stored });
  for (const group of PROFILES.PHARMACY.categories) {
    assert.ok(asPharmacy.categories.includes(group), `pharmacy must still offer ${group}`);
  }
  assert.ok(!asPharmacy.categories.includes('Cocktails'));
});

// ── What a write stores ──────────────────────────────────────────────

test('a write stores the diff against the trade, never a frozen copy of the list', () => {
  const payload = categoryWritePayload([...PROFILES.HARDWARE.categories, 'Welding'], 'HARDWARE');
  assert.deepEqual(payload.customCategories, ['Welding']);
  assert.deepEqual(payload.hiddenCategories, []);
  assert.ok(payload.categoryOrder.includes('Welding'));
  // The compatibility mirror, for a client still on the previous bundle.
  assert.deepEqual(payload.categories, payload.categoryOrder);
});

test('removing one of the trade\'s groups is stored as hidden, not as a rewritten list', () => {
  const kept = PROFILES.PHARMACY.categories.filter((c) => c !== 'Antibiotics');
  const payload = categoryWritePayload(kept, 'PHARMACY');
  assert.deepEqual(payload.hiddenCategories, ['Antibiotics']);
  assert.deepEqual(payload.customCategories, []);
  assert.ok(!resolveIndustryConfig({ industryProfile: 'PHARMACY', ...payload }).categories.includes('Antibiotics'));
});

test('renaming one of the trade\'s groups makes it this business\'s own word', () => {
  const renamed = PROFILES.BAR.categories.map((c) => (c === 'Mixers' ? 'Sodas & Mixers' : c));
  const payload = categoryWritePayload(renamed, 'BAR');
  assert.deepEqual(payload.hiddenCategories, ['Mixers']);
  assert.deepEqual(payload.customCategories, ['Sodas & Mixers']);
});

test('a round trip through a write is stable', () => {
  const start = ['Beer', 'Spirits', 'House Cocktails'];
  const payload = categoryWritePayload(start, 'BAR');
  assert.deepEqual(resolveIndustryConfig({ industryProfile: 'BAR', ...payload }).categories, start);
});

test('resetting categories clears the business\'s half and nothing else', () => {
  const payload = resetCategoriesPayload();
  assert.deepEqual(payload.customCategories, []);
  assert.deepEqual(payload.hiddenCategories, []);
  assert.deepEqual(payload.categoryOrder, []);
  assert.equal(payload.categories, null);
  assert.deepEqual(
    resolveIndustryConfig({ industryProfile: 'BAKERY', ...payload }).categories,
    PROFILES.BAKERY.categories
  );
});

// ── Bounds: this is a document every device in the business renders ──

test('a stored list is trimmed, de-duplicated case-insensitively and bounded', () => {
  assert.deepEqual(sanitizeCategories(['  Beer  ', 'beer', 'BEER', 'Wine']), ['Beer', 'Wine']);
  assert.deepEqual(sanitizeCategories(['Soft   Drinks']), ['Soft Drinks']);
  assert.equal(sanitizeCategories(['x'.repeat(200)])[0].length, MAX_CATEGORY_LENGTH);
  assert.equal(sanitizeCategories(Array.from({ length: 500 }, (_, i) => `C${i}`)).length, MAX_CATEGORIES);
});

test('a custom word the trade already ships is not stored twice', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'BAR',
    customCategories: ['Beer', 'beer', 'House Cocktails'],
  });
  assert.equal(config.categories.filter((c) => c.toLowerCase() === 'beer').length, 1);
  assert.deepEqual(config.customCategories, ['House Cocktails']);
});

test('resolution never throws and never returns a partial list, whatever is stored', () => {
  const hostile = [
    undefined, null, 0, 'x', {},
    { categories: 'Beverages' }, { categories: [null, 42] }, { categories: [''] },
    { customCategories: 'yes' }, { hiddenCategories: 7 }, { categoryOrder: {} },
    { customCategories: [[]], hiddenCategories: [{}], categoryOrder: [Symbol.iterator] },
  ];
  for (const [index, settings] of hostile.entries()) {
    for (const id of PROFILE_IDS) {
      const out = resolveCategoryModel(settings, getProfile(id));
      assert.ok(Array.isArray(out.categories), `${id} / hostile input #${index}`);
      assert.ok(out.categories.every((c) => typeof c === 'string' && c.length > 0));
      assert.ok(out.categories.length <= MAX_CATEGORIES);
    }
  }
});

test('resolveCategoryModel tolerates a missing profile instead of throwing', () => {
  const out = resolveCategoryModel({ customCategories: ['Beer'] }, undefined);
  assert.deepEqual(out.categories, ['Beer']);
  assert.deepEqual(resolveCategoryModel(null, undefined).categories, []);
});

test('the fossil constant is a migration constant and never a fallback', () => {
  // Nothing resolves TO the legacy list unless the profile happens to
  // ship it. A business with no stored list and no profile gets General
  // Retail's own list, which is a profile decision, not this constant.
  assert.deepEqual(resolveIndustryConfig(null).categories, PROFILES.GENERAL_RETAIL.categories);
});
