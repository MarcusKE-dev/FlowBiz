// The Worker validates industry configuration against its OWN tables, not
// the browser's. These tests prove two things: the two tables agree, and
// the Worker refuses everything it should regardless of what the browser
// believes.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDUSTRY_PROFILE_IDS, OWNER_CONFIGURABLE_CAPABILITIES, DEFAULT_INDUSTRY_PROFILE,
  OVERRIDABLE_TERMS, MAX_TERM_LENGTH, MAX_OVERRIDE_LIST,
  isKnownIndustryProfile, sanitizeCapabilityOverrides,
  sanitizeTermOverrides, sanitizeIdList,
} from '../src/lib/industry.js';
import { PROFILE_IDS, DEFAULT_PROFILE_ID } from '../../src/industry/profiles.js';
import { CAPABILITIES, CAPABILITY_KEYS } from '../../src/industry/capabilities.js';
import {
  OVERRIDABLE_TERMS as CLIENT_OVERRIDABLE_TERMS,
  MAX_TERM_LENGTH as CLIENT_MAX_TERM_LENGTH,
  sanitizeTermOverrides as clientSanitizeTermOverrides,
} from '../../src/industry/config.js';

test('the Worker profile list matches the browser profile list exactly', () => {
  assert.deepEqual([...INDUSTRY_PROFILE_IDS].sort(), [...PROFILE_IDS].sort());
  assert.equal(DEFAULT_INDUSTRY_PROFILE, DEFAULT_PROFILE_ID);
});

test('the Worker owner-configurable list matches the browser capability catalogue', () => {
  const fromCatalogue = CAPABILITY_KEYS.filter((key) => CAPABILITIES[key].ownerConfigurable);
  assert.deepEqual([...OWNER_CONFIGURABLE_CAPABILITIES].sort(), [...fromCatalogue].sort());
});

test('orders and batches are never owner-configurable on either side', () => {
  for (const locked of ['orders', 'batches']) {
    assert.equal(OWNER_CONFIGURABLE_CAPABILITIES.includes(locked), false);
    assert.equal(CAPABILITIES[locked].ownerConfigurable, false);
  }
});

test('an unknown profile is refused however it is spelled', () => {
  const hostile = [
    'PHARMACY_ADMIN', 'general_retail', '', ' PHARMACY', 'PHARMACY ', null, undefined,
    42, {}, [], '../../users', 'GENERAL_RETAIL\n',
  ];
  for (const value of hostile) {
    assert.equal(isKnownIndustryProfile(value), false, `${JSON.stringify(value)} must be refused`);
  }
  for (const value of INDUSTRY_PROFILE_IDS) {
    assert.equal(isKnownIndustryProfile(value), true);
  }
});

test('a forged override body cannot introduce a locked or unknown capability', () => {
  const sanitized = sanitizeCapabilityOverrides({
    orders: true, batches: true, isAdmin: true, role: 'SUPER_ADMIN',
    businessId: 'someone-else', subscription: { plan: 'lifetime' },
    units: true, tables: 'yes', modifiers: false,
  });
  assert.deepEqual(sanitized, { units: true, modifiers: false });
});

test('a non-object override body is rejected rather than coerced', () => {
  for (const value of ['{}', 7, [], [{ units: true }], true]) {
    assert.equal(sanitizeCapabilityOverrides(value), null, `${JSON.stringify(value)} must be rejected`);
  }
  assert.deepEqual(sanitizeCapabilityOverrides({}), {});
});


// ── The new lists must stay in lockstep too ──────────────────────────

test('the two new profiles exist on BOTH sides, and neither side invented one', () => {
  for (const id of ['BAR', 'WINES_AND_SPIRITS']) {
    assert.equal(INDUSTRY_PROFILE_IDS.includes(id), true, `the Worker must know ${id}`);
    assert.equal(PROFILE_IDS.includes(id), true, `the browser must know ${id}`);
    assert.equal(isKnownIndustryProfile(id), true);
  }
});

test('the two new capabilities are owner-configurable on BOTH sides', () => {
  for (const key of ['packSizes', 'ageRestriction']) {
    assert.equal(OWNER_CONFIGURABLE_CAPABILITIES.includes(key), true, `the Worker must allow ${key}`);
    assert.equal(CAPABILITIES[key].ownerConfigurable, true, `the browser must allow ${key}`);
  }
});

test('a forged override body cannot switch on a locked capability alongside the new ones', () => {
  const sanitized = sanitizeCapabilityOverrides({
    orders: true, batches: true, packSizes: true, ageRestriction: true,
    isAdmin: true, ownerConfigurable: true,
  });
  assert.deepEqual(sanitized, { packSizes: true, ageRestriction: true });
});

test('the renameable term list is identical on both sides', () => {
  assert.deepEqual([...OVERRIDABLE_TERMS].sort(), [...CLIENT_OVERRIDABLE_TERMS].sort());
  assert.equal(MAX_TERM_LENGTH, CLIENT_MAX_TERM_LENGTH);
});

test('the two term sanitisers agree on what a hostile body reduces to', () => {
  const hostile = {
    catalogue: '  My   Stock  ',
    catalogueItem: 'thing',
    catalogueItemPlural: 'x'.repeat(200),
    // Everything below must be dropped: not a renameable term, not a
    // string, or an attempt to reach something that is not wording.
    catalogueDescription: 'anything',
    addCatalogueItem: 'forged',
    capabilities: { orders: true },
    businessId: 'someone-else',
    role: 'owner',
    __proto__: { polluted: true },
    catalogueX: 'no',
  };
  const fromWorker = sanitizeTermOverrides(hostile);
  const fromClient = clientSanitizeTermOverrides(hostile);
  assert.deepEqual(fromWorker, fromClient, 'the two copies must reduce a body identically');
  assert.deepEqual(Object.keys(fromWorker).sort(), ['catalogue', 'catalogueItem', 'catalogueItemPlural']);
  assert.equal(fromWorker.catalogue, 'My Stock', 'runs of whitespace are collapsed');
  assert.equal(fromWorker.catalogueItemPlural.length, MAX_TERM_LENGTH, 'bounded, not stored whole');
});

test('a non-object term body is rejected rather than coerced', () => {
  for (const value of ['{}', 7, [], true]) {
    assert.equal(sanitizeTermOverrides(value), null, `${JSON.stringify(value)} must be rejected`);
  }
  assert.deepEqual(sanitizeTermOverrides({}), {});
  assert.deepEqual(sanitizeTermOverrides({ catalogue: '   ' }), {}, 'whitespace is not a name');
});

test('unit and dashboard override lists are bounded, de-duplicated and string-only', () => {
  assert.deepEqual(sanitizeIdList(['piece', 'bottle', 'piece', 42, null, '', 'crate']), ['piece', 'bottle', 'crate']);
  assert.equal(sanitizeIdList(new Array(500).fill(0).map((_, i) => `u${i}`)).length, MAX_OVERRIDE_LIST);
  assert.equal(sanitizeIdList(['x'.repeat(200)]).length, 0, 'an absurdly long id is dropped');
  for (const value of [null, undefined, 'piece', 7, {}]) {
    assert.equal(sanitizeIdList(value), null, `${JSON.stringify(value)} is not a list`);
  }
  assert.deepEqual(sanitizeIdList([]), [], 'an empty list is a real choice, not an absent one');
});

test('nothing an owner may override can widen what they may read or write', () => {
  // The industry layer is presentation. Nothing in any override map is
  // permitted to name a field that decides access, ownership or money.
  const forbidden = ['businessId', 'role', 'isAdmin', 'subscription', 'plan', 'entitlement', 'uid'];
  for (const key of forbidden) {
    assert.equal(OWNER_CONFIGURABLE_CAPABILITIES.includes(key), false);
    assert.equal(OVERRIDABLE_TERMS.includes(key), false);
    assert.deepEqual(sanitizeTermOverrides({ [key]: 'x' }), {});
    assert.deepEqual(sanitizeCapabilityOverrides({ [key]: true }), {});
  }
});
