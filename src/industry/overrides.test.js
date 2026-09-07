// Owner overrides beyond capabilities — units, dashboard and words
// (Phase D).
//
// resolveIndustryConfig has to stay PURE and TOTAL through all of this:
// the input is a Firestore document that an older client, a future
// client, or a hostile one may have written, so every one of these tests
// is really the same test — garbage in must resolve to something the
// application can render, never to a throw and never to a blank screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIndustryConfig, resetOverridesPayload, profileChangePayload,
  sanitizeTermOverrides, sanitizeUnitOverrides, sanitizeDashboardOverrides,
  OVERRIDABLE_TERMS, MAX_TERM_LENGTH,
} from './config.js';
import { PROFILE_IDS, PROFILES } from './profiles.js';
import { arrangeableWidgets, widgetLabel, DASHBOARD_WIDGETS } from './dashboard.js';

// ── Units ────────────────────────────────────────────────────────────

test('an owner may narrow the units their trade offers, but never widen them', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'HARDWARE',
    // 'tot' is a bar unit. Hardware does not offer it, so it is dropped
    // rather than granted: choosing units is a preference, adding one is
    // a change of trade.
    unitOverrides: ['piece', 'metre', 'tot', 'kilogram'],
  });
  assert.deepEqual(config.units, ['piece', 'metre', 'kilogram']);
  assert.ok(config.profileUnits.includes('foot'), 'the profile still offers what it always did');
});

test('the default unit is always offered, however hard an owner tries to drop it', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'HARDWARE',
    unitOverrides: ['metre'],
  });
  assert.equal(config.units[0], 'piece', 'anything with no unit is a piece, so piece must stay offered');
  assert.ok(config.units.includes('metre'));
});

test('an empty or unusable unit override falls back to the profile list rather than to nothing', () => {
  for (const unitOverrides of [[], ['tot', 'nonsense'], 'metre', 7, {}, null]) {
    const config = resolveIndustryConfig({ industryProfile: 'HARDWARE', unitOverrides });
    assert.ok(config.units.length > 1, `${JSON.stringify(unitOverrides)} must not empty the unit list`);
    assert.ok(config.units.includes('piece'));
  }
});

test('with units off there is one unit, and an override cannot bring more back', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'HARDWARE',
    capabilityOverrides: { units: false },
    unitOverrides: ['piece', 'metre', 'kilogram'],
  });
  assert.deepEqual(config.units, ['piece'], 'a unit list is only meaningful when units are on');
});

test('sanitizeUnitOverrides drops duplicates, non-strings and anything not offered', () => {
  assert.deepEqual(
    sanitizeUnitOverrides(['metre', 'metre', 42, null, 'tot', 'piece'], ['piece', 'metre']),
    ['metre', 'piece']
  );
  assert.equal(sanitizeUnitOverrides('metre', ['metre']), null);
  assert.equal(sanitizeUnitOverrides([], ['metre']), null);
});

// ── Dashboard ────────────────────────────────────────────────────────

test('an owner may reorder and hide the widgets their profile offers', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'PHARMACY',
    dashboardOverrides: ['activity', 'expiry'],
  });
  assert.deepEqual(config.dashboard, ['activity', 'expiry']);
  assert.deepEqual(config.profileDashboard, ['moneyToday', 'expiry', 'position', 'activity']);
});

test('an owner cannot invent a widget, because a widget id with no code behind it renders nothing', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    dashboardOverrides: ['moneyToday', 'kitchenQueue', 'expiry', 'nonsense', 'activity'],
  });
  assert.deepEqual(config.dashboard, ['moneyToday', 'activity'], 'only what General Retail offers survives');
});

test('an empty or unusable dashboard override falls back to the profile ordering', () => {
  for (const dashboardOverrides of [[], ['nonsense'], 'moneyToday', 7, {}, null]) {
    const config = resolveIndustryConfig({ industryProfile: 'BAKERY', dashboardOverrides });
    assert.deepEqual(config.dashboard, PROFILES.BAKERY.dashboard, `${JSON.stringify(dashboardOverrides)} must fall back`);
  }
});

test('duplicates in a stored ordering cannot render the same panel twice', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    dashboardOverrides: ['activity', 'activity', 'moneyToday', 'activity'],
  });
  assert.deepEqual(config.dashboard, ['activity', 'moneyToday']);
});

test('the arrangeable list keeps hidden widgets visible to the owner instead of losing them', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'PHARMACY',
    dashboardOverrides: ['activity', 'moneyToday'],
  });
  const widgets = arrangeableWidgets(config);
  assert.deepEqual(widgets.filter((w) => w.shown).map((w) => w.id), ['activity', 'moneyToday']);
  assert.deepEqual(widgets.filter((w) => !w.shown).map((w) => w.id), ['expiry', 'position']);
});

test('every widget any profile offers has an owner-facing name — no internal id ever reaches a screen', () => {
  const offered = new Set();
  for (const id of PROFILE_IDS) PROFILES[id].dashboard.forEach((w) => offered.add(w));
  for (const id of offered) {
    assert.ok(DASHBOARD_WIDGETS[id], `${id} has no owner-facing name`);
    assert.notEqual(widgetLabel(id), id, `${id} would be shown to an owner as its internal id`);
  }
});

test('sanitizeDashboardOverrides never throws and always returns a list or null', () => {
  for (const raw of [null, undefined, 'x', 7, {}, [null], [{}], [['a']]]) {
    const result = sanitizeDashboardOverrides(raw, ['moneyToday']);
    assert.ok(result === null || Array.isArray(result));
  }
});

// ── Words ────────────────────────────────────────────────────────────

test('an owner may rename the catalogue, and the Add button follows the word they chose', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    termOverrides: { catalogue: 'Stock', catalogueItem: 'item', catalogueItemPlural: 'items' },
  });
  assert.equal(config.terms.catalogue, 'Stock');
  assert.equal(config.terms.catalogueItem, 'item');
  assert.equal(config.terms.addCatalogueItem, 'Add item', 'two boxes that must agree is a way to get them to disagree');
});

test('only three words may be renamed, and nothing else in the terms object can be reached', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'RESTAURANT',
    termOverrides: {
      catalogue: 'Carte',
      catalogueDescription: 'forged',
      addCatalogueItem: 'forged',
      order: 'forged',
      capabilities: { orders: false },
    },
  });
  assert.equal(config.terms.catalogue, 'Carte');
  assert.equal(config.terms.catalogueDescription, PROFILES.RESTAURANT.terms.catalogueDescription);
  assert.equal(config.terms.addCatalogueItem, 'Add menu item', 'not renameable, so it keeps the profile wording');
  assert.equal(config.can('orders'), true, 'a term override cannot reach a capability');
  assert.deepEqual(OVERRIDABLE_TERMS, ['catalogue', 'catalogueItem', 'catalogueItemPlural']);
});

test('renamed words are bounded and whitespace-collapsed, so a settings document cannot be grown', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    termOverrides: { catalogue: `  My   ${'z'.repeat(500)}  ` },
  });
  assert.equal(config.terms.catalogue.length, MAX_TERM_LENGTH);
  assert.equal(config.terms.catalogue.startsWith('My z'), true, 'runs of whitespace collapse to one space');
});

test('a blank or non-string rename is not an override — it is the default', () => {
  for (const value of ['', '   ', 42, null, {}, []]) {
    const config = resolveIndustryConfig({
      industryProfile: 'GENERAL_RETAIL', termOverrides: { catalogue: value },
    });
    assert.equal(config.terms.catalogue, 'Products', `${JSON.stringify(value)} must not become a name`);
  }
  assert.deepEqual(sanitizeTermOverrides('nope'), {});
  assert.deepEqual(sanitizeTermOverrides(['catalogue']), {});
});

// ── Totality, purity and the protected baseline ──────────────────────

test('the resolver never throws, whatever is stored in the settings document', () => {
  const hostile = [
    null, undefined, 'settings', 42, [],
    { industryProfile: {}, capabilityOverrides: [], unitOverrides: {}, dashboardOverrides: 'x', termOverrides: 7 },
    { unitOverrides: [[]], dashboardOverrides: [null], termOverrides: { catalogue: {} } },
    { industryProfile: 'BAR', unitOverrides: new Array(1000).fill('tot') },
  ];
  for (const settings of hostile) {
    assert.doesNotThrow(() => resolveIndustryConfig(settings), `${JSON.stringify(settings)} must resolve`);
    const config = resolveIndustryConfig(settings);
    assert.ok(Array.isArray(config.units) && config.units.length > 0);
    assert.ok(Array.isArray(config.dashboard) && config.dashboard.length > 0);
    assert.ok(typeof config.terms.catalogue === 'string' && config.terms.catalogue.length > 0);
    assert.equal(typeof config.can, 'function');
  }
});

test('a garbage settings document still resolves to General Retail', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'NOT_A_PROFILE',
    capabilityOverrides: 'yes',
    unitOverrides: 'metres',
    dashboardOverrides: { a: 1 },
    termOverrides: null,
  });
  assert.equal(config.profileId, 'GENERAL_RETAIL');
  assert.deepEqual(config.units, ['piece']);
  assert.deepEqual(config.dashboard, ['moneyToday', 'position', 'activity']);
  assert.equal(config.terms.catalogue, 'Products');
});

test('the resolver is pure — the same input always gives the same answer', () => {
  const settings = {
    industryProfile: 'BAR',
    capabilityOverrides: { kitchen: true },
    unitOverrides: ['piece', 'tot'],
    dashboardOverrides: ['activity', 'moneyToday'],
    termOverrides: { catalogue: 'Bar list' },
  };
  const a = resolveIndustryConfig(settings);
  const b = resolveIndustryConfig({ ...settings });
  assert.deepEqual(
    { units: a.units, dashboard: a.dashboard, terms: a.terms, capabilities: a.capabilities },
    { units: b.units, dashboard: b.dashboard, terms: b.terms, capabilities: b.capabilities }
  );
});

test('a business that has customised nothing still says so', () => {
  assert.equal(resolveIndustryConfig({ industryProfile: 'BAR' }).usesDefaults, true);
  for (const override of [
    { unitOverrides: ['piece', 'tot'] },
    { dashboardOverrides: ['activity'] },
    { termOverrides: { catalogue: 'Bar list' } },
    { capabilityOverrides: { kitchen: true } },
  ]) {
    assert.equal(
      resolveIndustryConfig({ industryProfile: 'BAR', ...override }).usesDefaults, false,
      `${Object.keys(override)[0]} is a customisation and must be reported as one`
    );
  }
});

// ── Reset and profile switching clear every override ─────────────────

test('reset clears every override an owner can make, and moves no profile', () => {
  const payload = resetOverridesPayload();
  assert.deepEqual(Object.keys(payload).sort(), [
    'capabilityOverrides', 'dashboardOverrides', 'termOverrides', 'unitOverrides',
  ]);
  assert.equal('industryProfile' in payload, false, 'a reset must not move the business type');

  const after = resolveIndustryConfig({ industryProfile: 'PHARMACY', ...payload });
  assert.equal(after.profileId, 'PHARMACY');
  assert.equal(after.usesDefaults, true);
});

test('switching profile clears overrides expressed against the old one', () => {
  const before = {
    industryProfile: 'BAR',
    unitOverrides: ['piece', 'tot'],
    dashboardOverrides: ['activity'],
    termOverrides: { catalogue: 'Bar list' },
    capabilityOverrides: { kitchen: true },
  };
  const after = resolveIndustryConfig({ ...before, ...profileChangePayload('HARDWARE') });
  assert.equal(after.profileId, 'HARDWARE');
  assert.equal(after.usesDefaults, true, '"tot only" is meaningless in a hardware shop');
  assert.ok(after.units.includes('metre'));
  assert.equal(after.terms.catalogue, 'Products');
});

test('every profile round trip is still lossless with the new overrides in play', () => {
  for (const id of PROFILE_IDS) {
    const original = resolveIndustryConfig({ industryProfile: id });
    const wandered = { industryProfile: id, ...profileChangePayload('GENERAL_RETAIL') };
    const home = resolveIndustryConfig({ ...wandered, ...profileChangePayload(id) });
    assert.deepEqual(home.capabilities, original.capabilities, `${id} capabilities`);
    assert.deepEqual(home.units, original.units, `${id} units`);
    assert.deepEqual(home.dashboard, original.dashboard, `${id} dashboard`);
    assert.deepEqual(home.terms, original.terms, `${id} terms`);
  }
});

test('General Retail resolves identically whether or not the new fields exist', () => {
  const withoutFields = resolveIndustryConfig({ shopName: 'Duka' });
  const withEmptyFields = resolveIndustryConfig({
    shopName: 'Duka', unitOverrides: null, dashboardOverrides: null, termOverrides: {},
  });
  for (const key of ['units', 'dashboard', 'terms', 'capabilities', 'defaultCategories']) {
    assert.deepEqual(withEmptyFields[key], withoutFields[key], `${key} must be unchanged`);
  }
  assert.equal(withEmptyFields.usesDefaults, true);
});
