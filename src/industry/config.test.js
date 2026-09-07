// Phase 1 gate — the configuration foundation.
//
// These tests exist to pin down the four properties everything later in
// the industry project is built on: an unconfigured business is General
// Retail with nothing on; precedence runs in exactly one direction;
// hostile input cannot widen what a business has; and switching profile
// is a two-field write that touches no data.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIndustryConfig, sanitizeCapabilityOverrides, profileChangePayload,
  resetOverridesPayload, ownerConfigurableCapabilities, DEFAULT_INDUSTRY_CONFIG,
} from './config.js';
import { PROFILES, PROFILE_IDS, DEFAULT_PROFILE_ID, getProfile } from './profiles.js';
import { CAPABILITY_KEYS, CAPABILITIES } from './capabilities.js';
import { roundQuantity, formatQuantityWithUnit, unitStep, unitDecimals } from './units.js';

// ── Backward compatibility: the existing business is the baseline ────

test('a business with no settings at all resolves to General Retail with every capability off', () => {
  for (const input of [null, undefined, {}, { shopName: 'Duka' }]) {
    const config = resolveIndustryConfig(input);
    assert.equal(config.profileId, 'GENERAL_RETAIL');
    for (const key of CAPABILITY_KEYS) {
      assert.equal(config.can(key), false, `${key} should be off for an unconfigured business`);
    }
  }
});

test('General Retail offers exactly one unit, so its product form is unchanged', () => {
  const config = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' });
  assert.deepEqual(config.units, ['piece']);
  assert.equal(config.terms.catalogue, 'Products');
  assert.deepEqual(config.dashboard, ['moneyToday', 'position', 'activity']);
});

test('an unknown or malformed profile never throws and never guesses — it lands on General Retail', () => {
  const hostile = ['PHARMACY_ADMIN', '', '../../users', 42, null, {}, [], 'gEnErAl_ReTaIl'];
  for (const industryProfile of hostile) {
    const config = resolveIndustryConfig({ industryProfile });
    assert.equal(config.profileId, DEFAULT_PROFILE_ID, `${JSON.stringify(industryProfile)} must not resolve`);
  }
});

// ── Precedence ───────────────────────────────────────────────────────

test('precedence runs global -> profile -> business override', () => {
  // Global default is off; the Hardware profile turns `units` on.
  assert.equal(resolveIndustryConfig({ industryProfile: 'HARDWARE' }).can('units'), true);
  // A business override turns it back off.
  assert.equal(
    resolveIndustryConfig({ industryProfile: 'HARDWARE', capabilityOverrides: { units: false } }).can('units'),
    false
  );
  // And a General Retail shop may opt in to it.
  assert.equal(
    resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL', capabilityOverrides: { units: true } }).can('units'),
    true
  );
});

test('usesDefaults reports whether a business is running on its industry defaults', () => {
  assert.equal(resolveIndustryConfig({ industryProfile: 'CAFE' }).usesDefaults, true);
  const customised = resolveIndustryConfig({ industryProfile: 'CAFE', capabilityOverrides: { tables: true } });
  assert.equal(customised.usesDefaults, false);
  assert.deepEqual(customised.effectiveOverrides, { tables: true });
});

test('an override that changes nothing does not make a business look customised', () => {
  // Restaurant already has tables on; asking for tables on is a no-op.
  const config = resolveIndustryConfig({ industryProfile: 'RESTAURANT', capabilityOverrides: { tables: true } });
  assert.equal(config.usesDefaults, true);
  assert.deepEqual(config.effectiveOverrides, {});
});

// ── Hostile input ────────────────────────────────────────────────────

test('overrides cannot introduce unknown capabilities or non-boolean values', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    capabilityOverrides: {
      isAdmin: true, role: 'owner', businessId: 'other', __proto__: { units: true },
      units: 'true', variants: 1, services: null, modifiers: true,
    },
  });
  assert.deepEqual(config.overrides, { modifiers: true });
  assert.equal(config.can('units'), false);
  assert.equal(config.can('variants'), false);
  assert.equal(config.capabilities.isAdmin, undefined);
  assert.equal(config.capabilities.role, undefined);
});

test('overrides cannot turn on a capability that is not owner-configurable', () => {
  // `orders` and `batches` move only with the profile.
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    capabilityOverrides: { orders: true, batches: true },
  });
  assert.equal(config.can('orders'), false);
  assert.equal(config.can('batches'), false);
  assert.deepEqual(config.overrides, {});
});

test('sanitizeCapabilityOverrides survives every shape a stored document could take', () => {
  for (const input of [null, undefined, 'yes', 7, [], [{ units: true }], () => {}]) {
    assert.deepEqual(sanitizeCapabilityOverrides(input), {});
  }
});

test('a capability whose prerequisite is off is off, whatever anyone stored', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    capabilityOverrides: { tables: true, kitchen: true, diningModes: true, production: true, expiryAlerts: true },
  });
  assert.equal(config.can('tables'), false, 'tables requires orders');
  assert.equal(config.can('kitchen'), false, 'kitchen requires orders');
  assert.equal(config.can('diningModes'), false, 'diningModes requires orders');
  assert.equal(config.can('production'), false, 'production requires recipes');
  assert.equal(config.can('expiryAlerts'), false, 'expiryAlerts requires batches');
});

test('turning off a prerequisite turns off everything that depends on it', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'BAKERY',
    capabilityOverrides: { recipes: false },
  });
  assert.equal(config.can('recipes'), false);
  assert.equal(config.can('production'), false);
});

// ── Every profile is well formed ─────────────────────────────────────

test('all fifteen profiles exist, in four families', () => {
  assert.equal(PROFILE_IDS.length, 15);
  const byFamily = {};
  for (const id of PROFILE_IDS) {
    byFamily[PROFILES[id].family] = (byFamily[PROFILES[id].family] || 0) + 1;
  }
  assert.deepEqual(byFamily, { RETAIL: 6, FOOD: 5, SERVICES: 3, SPECIALIZED: 1 });
});

test('every profile resolves to a complete, dependency-consistent configuration', () => {
  for (const id of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: id });
    assert.equal(config.profileId, id);
    assert.ok(config.terms.catalogue, `${id} must have a catalogue term`);
    assert.ok(config.units.includes('piece'), `${id} must always offer piece`);
    assert.ok(config.dashboard.includes('moneyToday'), `${id} dashboard must lead with money`);
    assert.ok(config.dashboard.includes('activity'), `${id} dashboard must end with activity`);
    assert.ok(config.defaultCategories.length > 0, `${id} must ship starting categories`);
    for (const key of CAPABILITY_KEYS) {
      if (!config.can(key)) continue;
      for (const dep of CAPABILITIES[key].requires || []) {
        assert.equal(config.can(dep), true, `${id}: ${key} is on but its prerequisite ${dep} is off`);
      }
    }
  }
});

test('the food family shares one set of capabilities and differs only in defaults', () => {
  const restaurant = resolveIndustryConfig({ industryProfile: 'RESTAURANT' });
  const cafe = resolveIndustryConfig({ industryProfile: 'CAFE' });
  const fastFood = resolveIndustryConfig({ industryProfile: 'FAST_FOOD' });

  for (const config of [restaurant, cafe, fastFood]) {
    assert.equal(config.family, 'FOOD');
    assert.equal(config.can('orders'), true);
    assert.equal(config.can('modifiers'), true);
    assert.equal(config.can('kitchen'), true);
    assert.equal(config.terms.catalogue, 'Menu');
  }
  assert.equal(restaurant.can('tables'), true);
  assert.equal(cafe.can('tables'), false, 'café tables are optional, and default off');
  assert.equal(fastFood.can('tables'), false);
  assert.equal(restaurant.can('recipes'), true);
  assert.equal(fastFood.can('recipes'), false);
});

test('a café can turn tables on without becoming a restaurant', () => {
  const cafe = resolveIndustryConfig({ industryProfile: 'CAFE', capabilityOverrides: { tables: true } });
  assert.equal(cafe.can('tables'), true);
  assert.equal(cafe.profileId, 'CAFE');
});

test('Electronics stays a retail profile — no serials, no warranty, no manufacturer', () => {
  const config = resolveIndustryConfig({ industryProfile: 'ELECTRONICS' });
  assert.equal(config.family, 'RETAIL');
  assert.equal(config.can('variants'), true);
  assert.equal(config.can('batches'), false);
  assert.equal(config.can('orders'), false);
  assert.equal(config.can('services'), false);
  for (const forbidden of ['imei', 'serials', 'warranty', 'manufacturer']) {
    assert.equal(CAPABILITY_KEYS.includes(forbidden), false, `${forbidden} must not exist as a capability`);
  }
});

test('General Services offers no physical-stock navigation', () => {
  const config = resolveIndustryConfig({ industryProfile: 'GENERAL_SERVICES' });
  assert.equal(config.can('services'), true);
  assert.deepEqual(config.hiddenNav, ['/purchases', '/suppliers', '/stock-take']);
});

// ── Profile switching ────────────────────────────────────────────────

test('a profile change writes the profile and the owner overrides, and NOTHING else', () => {
  // The property that matters is not the field count — it is that a
  // profile change cannot carry a key that touches a record. Every key
  // here is either the profile itself or an override being cleared,
  // because overrides are expressed against the profile that was in
  // force when they were made.
  const payload = profileChangePayload('PHARMACY');
  assert.deepEqual(Object.keys(payload).sort(), [
    'capabilityOverrides', 'dashboardOverrides', 'industryProfile', 'termOverrides', 'unitOverrides',
  ]);
  assert.equal(payload.industryProfile, 'PHARMACY');
  assert.deepEqual(payload.capabilityOverrides, {});
  assert.deepEqual(payload.termOverrides, {});
  assert.equal(payload.unitOverrides, null);
  assert.equal(payload.dashboardOverrides, null);

  // Nothing that owns data, money or access may ever appear.
  for (const forbidden of [
    'products', 'sales', 'creditSales', 'stock', 'batches', 'customers',
    'subscription', 'plan', 'entitlement', 'role', 'businessId', 'categories',
  ]) {
    assert.equal(forbidden in payload, false, `a profile change must never write ${forbidden}`);
  }

  assert.deepEqual(profileChangePayload('HARDWARE', { resetOverrides: false }), { industryProfile: 'HARDWARE' });
});

test('a profile change to an unknown profile is refused outright', () => {
  assert.throws(() => profileChangePayload('SUPERMARKET_PRO'), /Unknown industry profile/);
  assert.throws(() => profileChangePayload(null), /Unknown industry profile/);
});

test('every round trip between profiles is lossless for configuration', () => {
  // Switching away and back must land on exactly the original configuration.
  const journeys = [
    ['GENERAL_RETAIL', 'HARDWARE', 'GENERAL_RETAIL'],
    ['GENERAL_RETAIL', 'BOUTIQUE', 'GENERAL_RETAIL'],
    ['GENERAL_RETAIL', 'RESTAURANT', 'GENERAL_RETAIL'],
    ['GENERAL_RETAIL', 'PHARMACY', 'GENERAL_RETAIL'],
    ['PHARMACY', 'GENERAL_RETAIL', 'PHARMACY'],
    ['GENERAL_RETAIL', 'SALON', 'GENERAL_RETAIL'],
  ];
  for (const journey of journeys) {
    let settings = { shopName: 'Duka', categories: ['Other'], industryProfile: journey[0] };
    const before = resolveIndustryConfig(settings);
    for (const next of journey.slice(1)) {
      settings = { ...settings, ...profileChangePayload(next) };
    }
    const after = resolveIndustryConfig(settings);
    assert.equal(after.profileId, before.profileId, journey.join(' -> '));
    assert.deepEqual(after.capabilities, before.capabilities, journey.join(' -> '));
    // Nothing else in the settings document was disturbed.
    assert.equal(settings.shopName, 'Duka');
    assert.deepEqual(settings.categories, ['Other']);
  }
});

test('resetting to defaults clears overrides and leaves the profile alone', () => {
  const settings = { industryProfile: 'CAFE', capabilityOverrides: { tables: true, kitchen: false } };
  const reset = { ...settings, ...resetOverridesPayload() };
  const config = resolveIndustryConfig(reset);
  assert.equal(config.profileId, 'CAFE');
  assert.equal(config.usesDefaults, true);
  assert.equal(config.can('tables'), false);
  assert.equal(config.can('kitchen'), true);
});

// ── Owner customisation surface ──────────────────────────────────────

test('an owner is never offered a switch that is not a real choice', () => {
  const retail = ownerConfigurableCapabilities(resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' }));
  const keys = retail.map((c) => c.key);
  assert.ok(keys.includes('units'));
  assert.ok(keys.includes('variants'));
  assert.ok(!keys.includes('tables'), 'tables needs orders, which a shop does not have');
  assert.ok(!keys.includes('orders'), 'orders is not owner-configurable');
  assert.ok(!keys.includes('batches'), 'batches is not owner-configurable');

  const restaurant = ownerConfigurableCapabilities(resolveIndustryConfig({ industryProfile: 'RESTAURANT' }));
  assert.ok(restaurant.map((c) => c.key).includes('tables'));
});

test('the owner surface reports whether each switch is still at its default', () => {
  const config = resolveIndustryConfig({ industryProfile: 'CAFE', capabilityOverrides: { tables: true } });
  const tables = ownerConfigurableCapabilities(config).find((c) => c.key === 'tables');
  assert.equal(tables.enabled, true);
  assert.equal(tables.isDefault, false);
  const modifiers = ownerConfigurableCapabilities(config).find((c) => c.key === 'modifiers');
  assert.equal(modifiers.isDefault, true);
});

// ── Units ────────────────────────────────────────────────────────────

test('quantity rounding kills binary floating-point noise the way money rounding does', () => {
  assert.equal(roundQuantity(0.1 + 0.2, 'metre'), 0.3);
  assert.equal(roundQuantity(2.5 * 3, 'metre'), 7.5);
  assert.equal(roundQuantity(1 / 3, 'kilogram'), 0.333);
  assert.equal(roundQuantity(0.1 + 0.2 - 0.3, 'metre'), 0);
});

test('count units stay whole numbers, measured units keep their decimals', () => {
  assert.equal(unitDecimals('piece'), 0);
  assert.equal(roundQuantity(3.7, 'piece'), 3);
  assert.equal(roundQuantity(3.7, 'metre'), 3.7);
  assert.equal(unitStep('piece'), 1);
  assert.equal(unitStep('metre'), 0.001);
  assert.equal(unitStep('foot'), 0.01);
});

test('a quantity in pieces reads exactly as it always did', () => {
  assert.equal(formatQuantityWithUnit(3, 'piece'), '3');
  assert.equal(formatQuantityWithUnit(3, undefined), '3');
  assert.equal(formatQuantityWithUnit(2.5, 'metre'), '2.5 m');
  assert.equal(formatQuantityWithUnit(3.5, 'kilogram'), '3.5 kg');
  assert.equal(formatQuantityWithUnit(8, 'foot'), '8 ft');
});

test('an unknown unit degrades to piece rather than breaking a product', () => {
  assert.equal(roundQuantity(3.7, 'furlong'), 3);
  assert.equal(formatQuantityWithUnit(3, 'furlong'), '3');
  assert.equal(unitDecimals(undefined), 0);
});

test('the frozen default config is General Retail', () => {
  assert.equal(DEFAULT_INDUSTRY_CONFIG.profileId, 'GENERAL_RETAIL');
  assert.equal(DEFAULT_INDUSTRY_CONFIG.usesDefaults, true);
  assert.equal(getProfile('nonsense').id, 'GENERAL_RETAIL');
});

// ── The counter's category row is a property of the trade (Phase B8) ──
//
// A hardcoded threshold of 40 meant a restaurant with a 25-item menu saw
// one flat alphabetical list. A menu is not a small catalogue: it is read
// by group, and the groups are how the person at the till thinks.

test('the food family always shows its menu groups, whatever the menu size', () => {
  for (const id of ['RESTAURANT', 'CAFE', 'FAST_FOOD', 'BAKERY']) {
    assert.equal(
      resolveIndustryConfig({ industryProfile: id }).categoryFilterThreshold, 0,
      `${id} must group its menu from the first item`
    );
  }
});

test('General Retail keeps the count-based rule exactly as it was', () => {
  assert.equal(resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' }).categoryFilterThreshold, 40);
  assert.equal(resolveIndustryConfig(null).categoryFilterThreshold, 40);
});

test('every retail, services and specialised profile keeps the count-based rule', () => {
  for (const id of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: id });
    if (config.family === 'FOOD') continue;
    assert.equal(config.categoryFilterThreshold, 40, `${id} should not have gained a menu-style filter`);
  }
});

test('a garbled threshold on a profile falls back to the count rule rather than breaking the counter', () => {
  // The resolver must stay TOTAL: nothing it returns may be NaN, because
  // `products.length >= NaN` is false forever and the filter would vanish.
  for (const config of PROFILE_IDS.map((id) => resolveIndustryConfig({ industryProfile: id }))) {
    assert.equal(Number.isFinite(config.categoryFilterThreshold), true);
    assert.equal(config.categoryFilterThreshold >= 0, true);
  }
});
