// Assume the client is malicious (Phase F2).
//
// The premise of the whole industry layer is that it is PRESENTATION. If
// that premise ever fails — if some capability, term or unit can widen
// what a business may read or write — then every other guarantee in the
// project is worthless. These tests attack that premise directly.
//
// What they can and cannot cover: this is the CLIENT copy of the rules,
// and it is a convenience, not the enforcement. The Worker's copy is
// attacked in cloudflare-worker/test/, the two are proved identical by
// the drift test there, and firestore.rules holds the third copy. What
// these tests prove is that the client cannot even ASK for something the
// server would have to refuse.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIndustryConfig, sanitizeCapabilityOverrides, sanitizeTermOverrides,
  sanitizeUnitOverrides, sanitizeDashboardOverrides, profileChangePayload,
  resetOverridesPayload, ownerConfigurableCapabilities, OVERRIDABLE_TERMS,
} from './config.js';
import { CAPABILITIES, CAPABILITY_KEYS, isOwnerConfigurable } from './capabilities.js';
import { PROFILE_IDS, isKnownProfile } from './profiles.js';

// Everything a forged document might try to reach.
const PRIVILEGED = [
  'businessId', 'role', 'uid', 'isAdmin', 'owner', 'permissions',
  'subscription', 'plan', 'entitlement', 'lifetime', 'status',
  'products', 'sales', 'creditSales', 'customers', 'batches', 'productBatches',
  'stock', 'variantStock', 'costPrice', 'totalAmount', 'refunds', 'orders',
];

// ── A forged profile ─────────────────────────────────────────────────

test('a forged industry profile is refused, however it is spelled', () => {
  const hostile = [
    'PHARMACY_ADMIN', 'general_retail', 'GENERAL_RETAIL ', ' BAR', 'BAR\n',
    '../../users', '__proto__', 'constructor', 'toString',
    '', null, undefined, 42, {}, [], true, ['BAR'],
  ];
  for (const industryProfile of hostile) {
    assert.equal(isKnownProfile(industryProfile), false, `${JSON.stringify(industryProfile)} must not be known`);
    const config = resolveIndustryConfig({ industryProfile });
    assert.equal(config.profileId, 'GENERAL_RETAIL', 'a forged profile lands on the safe baseline');
    for (const key of CAPABILITY_KEYS) {
      assert.equal(config.can(key), false, `${JSON.stringify(industryProfile)} must not grant ${key}`);
    }
  }
});

test('a profile change to anything not on the list throws rather than writing', () => {
  for (const id of ['PHARMACY_ADMIN', '__proto__', '', null, 42, {}, 'BAR ']) {
    assert.throws(() => profileChangePayload(id), /Unknown industry profile/);
  }
  for (const id of PROFILE_IDS) {
    assert.doesNotThrow(() => profileChangePayload(id));
  }
});

// ── A forged capability override ─────────────────────────────────────

test('a forged override cannot switch on a capability the product moves only with the profile', () => {
  const forged = sanitizeCapabilityOverrides({
    orders: true, batches: true,
    units: true, packSizes: true, ageRestriction: true,
  });
  assert.deepEqual(forged, { units: true, packSizes: true, ageRestriction: true });
  assert.equal('orders' in forged, false);
  assert.equal('batches' in forged, false);

  // And resolving it changes nothing about the locked pair.
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    capabilityOverrides: { orders: true, batches: true },
  });
  assert.equal(config.can('orders'), false);
  assert.equal(config.can('batches'), false);
});

test('every locked capability stays locked on every profile', () => {
  const locked = CAPABILITY_KEYS.filter((key) => !isOwnerConfigurable(key));
  assert.deepEqual(locked.sort(), ['batches', 'orders']);
  for (const profileId of PROFILE_IDS) {
    for (const key of locked) {
      const profileDefault = resolveIndustryConfig({ industryProfile: profileId }).can(key);
      const forged = resolveIndustryConfig({
        industryProfile: profileId,
        capabilityOverrides: { [key]: !profileDefault },
      });
      assert.equal(forged.can(key), profileDefault, `${profileId}: ${key} must not be moved by an override`);
    }
  }
});

test('a capability override cannot name a privileged field, and cannot carry a non-boolean', () => {
  for (const key of PRIVILEGED) {
    assert.deepEqual(sanitizeCapabilityOverrides({ [key]: true }), {}, `${key} must be dropped`);
  }
  for (const value of ['true', 1, 0, null, undefined, {}, [], 'yes']) {
    assert.deepEqual(sanitizeCapabilityOverrides({ units: value }), {}, `${JSON.stringify(value)} is not a boolean`);
  }
  for (const raw of ['{}', 7, [], [{ units: true }], true, null, undefined]) {
    assert.deepEqual(sanitizeCapabilityOverrides(raw), {});
  }
});

test('prototype pollution through an override map changes nothing', () => {
  const before = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' });
  resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    capabilityOverrides: JSON.parse('{"__proto__": {"orders": true}}'),
    termOverrides: JSON.parse('{"__proto__": {"catalogue": "Pwned"}}'),
  });
  const after = resolveIndustryConfig({ industryProfile: 'GENERAL_RETAIL' });
  assert.deepEqual(after.capabilities, before.capabilities);
  assert.equal(after.terms.catalogue, 'Products');
  assert.equal({}.orders, undefined, 'Object.prototype must be untouched');
  assert.equal({}.catalogue, undefined);
});

// ── Forged presentation overrides ────────────────────────────────────

test('a term override cannot reach anything but the three renameable words', () => {
  for (const key of [...PRIVILEGED, 'catalogueDescription', 'addCatalogueItem', 'order', 'openOrders', 'saveOrder']) {
    assert.deepEqual(sanitizeTermOverrides({ [key]: 'forged' }), {}, `${key} must not be renameable`);
  }
  assert.deepEqual(OVERRIDABLE_TERMS, ['catalogue', 'catalogueItem', 'catalogueItemPlural']);
});

test('term, unit and dashboard overrides are bounded — none can grow a shared document', () => {
  const terms = sanitizeTermOverrides({ catalogue: 'z'.repeat(100000) });
  assert.ok(terms.catalogue.length <= 24);

  const units = sanitizeUnitOverrides(new Array(10000).fill('metre'), ['piece', 'metre']);
  assert.ok(units.length <= 2, 'duplicates collapse, so a list cannot be padded');

  const widgets = sanitizeDashboardOverrides(new Array(10000).fill('activity'), ['activity']);
  assert.ok(widgets.length <= 1);
});

test('a forged unit or widget that the profile does not offer is dropped, never granted', () => {
  const config = resolveIndustryConfig({
    industryProfile: 'GENERAL_RETAIL',
    unitOverrides: ['piece', 'kilogram', 'tot', 'metre'],
    dashboardOverrides: ['moneyToday', 'expiry', 'kitchenQueue', 'openOrders'],
  });
  assert.deepEqual(config.units, ['piece'], 'General Retail offers one unit, and a forged list cannot add one');
  assert.deepEqual(config.dashboard, ['moneyToday'], 'a widget the profile does not offer is not granted by asking');
});

test('no override of any kind can change what a capability resolves to', () => {
  const base = resolveIndustryConfig({ industryProfile: 'BAR' });
  const attacked = resolveIndustryConfig({
    industryProfile: 'BAR',
    unitOverrides: ['piece', 'tot'],
    dashboardOverrides: ['activity'],
    termOverrides: { catalogue: 'Anything' },
  });
  assert.deepEqual(attacked.capabilities, base.capabilities);
});

// ── A profile change is presentation, and only presentation ──────────

test('a profile change can never carry a field that owns data, money or access', () => {
  for (const id of PROFILE_IDS) {
    const payload = profileChangePayload(id);
    for (const key of PRIVILEGED) {
      assert.equal(key in payload, false, `${id}: a profile change must never write ${key}`);
    }
  }
  for (const key of PRIVILEGED) {
    assert.equal(key in resetOverridesPayload(), false, `a reset must never write ${key}`);
  }
});

test('a profile is never an authorisation boundary — no capability decides who may read anything', () => {
  // Structural: nothing in the catalogue may even be NAMED after an
  // access concept, because a capability that reads like a permission is
  // one refactor away from being used as one.
  for (const key of CAPABILITY_KEYS) {
    const text = `${key} ${CAPABILITIES[key].label} ${CAPABILITIES[key].description}`.toLowerCase();
    for (const word of ['permission', 'role', 'admin', 'access', 'allow', 'authoris', 'authoriz']) {
      assert.equal(text.includes(word), false, `${key} reads like an authorisation control`);
    }
  }
});

// ── Nothing internal is ever offered to an owner ─────────────────────

test('the owner surface never exposes a capability that is not a real choice', () => {
  for (const profileId of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: profileId });
    for (const capability of ownerConfigurableCapabilities(config)) {
      assert.equal(isOwnerConfigurable(capability.key), true, `${profileId}: ${capability.key} is not owner-configurable`);
      for (const dep of CAPABILITIES[capability.key].requires || []) {
        assert.equal(config.can(dep), true, `${profileId}: ${capability.key} is offered but ${dep} is off`);
      }
      // Every switch an owner sees carries words, not a flag name.
      assert.ok(capability.label && capability.label !== capability.key);
      assert.ok(capability.description && capability.description.length > 10);
    }
  }
});

// ── Totality under attack ────────────────────────────────────────────

test('the resolver never throws and never returns something unrenderable, however hostile the document', () => {
  const attacks = [
    { industryProfile: { toString: () => 'BAR' } },
    { capabilityOverrides: { get units() { throw new Error('boom'); } } },
    { unitOverrides: { length: 5 } },
    { dashboardOverrides: { 0: 'activity', length: 1 } },
    { termOverrides: { catalogue: { toString: () => 'x' } } },
    { industryProfile: 'BAR', capabilityOverrides: null, unitOverrides: false, dashboardOverrides: 0, termOverrides: '' },
  ];
  for (const settings of attacks) {
    let config;
    assert.doesNotThrow(() => { config = resolveIndustryConfig(settings); }, JSON.stringify(Object.keys(settings)));
    assert.ok(typeof config.profileId === 'string' && isKnownProfile(config.profileId));
    assert.ok(Array.isArray(config.units) && config.units.length > 0);
    assert.ok(Array.isArray(config.dashboard) && config.dashboard.length > 0);
    assert.ok(typeof config.terms.catalogue === 'string' && config.terms.catalogue.length > 0);
    assert.equal(typeof config.can, 'function');
    assert.equal(config.can('__proto__'), false);
    assert.equal(config.can('constructor'), false);
  }
});
