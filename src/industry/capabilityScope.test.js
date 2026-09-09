// src/industry/capabilityScope.test.js
//
// A HARDWARE SHOP WAS BEING OFFERED "MODIFIERS" AND "RECIPES" in its own
// settings — extra cheese, no onions, and building an item out of
// ingredients — because both capabilities have no prerequisite and so
// passed every filter the settings page applied. A switch that means
// nothing in the trade reading it is not a feature; it is an invitation
// to turn on something that will then behave strangely.
//
// These tests pin the scoping and, just as importantly, pin what it must
// NOT do: it is presentation scoping, so it may not force anything off,
// may not change what an existing business resolves to, and may not strand
// a setting somewhere nobody can reach.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, isCapabilityInFamily, capabilityFamily } from './capabilities.js';
import { resolveIndustryConfig, ownerConfigurableCapabilities } from './config.js';
import { PROFILE_IDS, PROFILES } from './profiles.js';

const offered = (settings) =>
  ownerConfigurableCapabilities(resolveIndustryConfig(settings)).map((c) => c.key);

const FOOD_ONLY = [
  'orders', 'tables', 'modifiers', 'diningModes', 'kitchen',
  // Where an item is made, and when it is served. Both are refinements of
  // `kitchen` and `tables`, and both are meaningless outside food service
  // — a hardware shop has no grill and no dessert course.
  'kitchenStations', 'courses',
  // Every food business throws food away, including the ones with no
  // recipes — which is why this is not folded into `recipes`.
  'waste',
  'recipes', 'production',
];

test('the food-service capabilities are the ones scoped to the food family', () => {
  for (const key of FOOD_ONLY) {
    assert.equal(capabilityFamily(key), 'FOOD', `${key} must be scoped to FOOD`);
  }
  const scoped = Object.keys(CAPABILITIES).filter((k) => capabilityFamily(k) !== null);
  assert.deepEqual(scoped.sort(), [...FOOD_ONLY].sort(),
    'nothing else may be scoped without a deliberate decision here');
});

test('an unscoped capability is offered to every trade', () => {
  for (const key of ['units', 'variants', 'barcodeLabels', 'services', 'packSizes', 'ageRestriction']) {
    assert.equal(capabilityFamily(key), null);
    for (const family of ['RETAIL', 'FOOD', 'SERVICES', 'SPECIALIZED']) {
      assert.ok(isCapabilityInFamily(key, family), `${key} must stay offered to ${family}`);
    }
  }
});

// ── The actual complaint ──────────────────────────────────────────────

test('THE FIX: no non-food business is offered modifiers or recipes', () => {
  for (const id of PROFILE_IDS) {
    if (PROFILES[id].family === 'FOOD') continue;
    const keys = offered({ industryProfile: id });
    assert.ok(!keys.includes('modifiers'), `${id} must not be offered modifiers`);
    assert.ok(!keys.includes('recipes'), `${id} must not be offered recipes`);
    assert.ok(!keys.includes('production'), `${id} must not be offered production`);
    assert.ok(!keys.includes('kitchen'), `${id} must not be offered a kitchen queue`);
    assert.ok(!keys.includes('tables'), `${id} must not be offered tables`);
    assert.ok(!keys.includes('diningModes'), `${id} must not be offered dining modes`);
  }
});

test('a general retail shop is still offered the settings that DO mean something to it', () => {
  const keys = offered({ industryProfile: 'GENERAL_RETAIL' });
  for (const key of ['units', 'variants', 'barcodeLabels', 'services', 'ageRestriction']) {
    assert.ok(keys.includes(key), `a shop must keep ${key}`);
  }
  assert.ok(keys.length > 0, 'the settings page must not go empty');
});

test('a food business still gets its own switches — nothing was deleted', () => {
  const keys = offered({ industryProfile: 'RESTAURANT' });
  for (const key of ['modifiers', 'recipes', 'tables', 'diningModes', 'kitchen']) {
    assert.ok(keys.includes(key), `a restaurant must keep ${key}`);
  }
});

// ── What the scoping must NOT do ──────────────────────────────────────

test('SCOPING IS PRESENTATION ONLY: it never forces a capability off', () => {
  // A shop with modifiers switched on resolves with modifiers ON. Hiding
  // a switch must not silently change what the business already does.
  const config = resolveIndustryConfig({
    industryProfile: 'HARDWARE',
    capabilityOverrides: { modifiers: true },
  });
  assert.equal(config.capabilities.modifiers, true,
    'the stored override still decides behaviour — this is a settings-page rule, not a resolver rule');
  assert.equal(config.can('modifiers'), true);
});

test('NOTHING IS STRANDED: an out-of-family capability that is ON stays visible so it can be turned off', () => {
  const keys = offered({
    industryProfile: 'HARDWARE',
    capabilityOverrides: { modifiers: true },
  });
  assert.ok(keys.includes('modifiers'),
    'hiding a switch that is on would leave a setting nobody could reach');
});

test('and once it is off again, it goes away', () => {
  const keys = offered({
    industryProfile: 'HARDWARE',
    capabilityOverrides: { modifiers: false },
  });
  assert.ok(!keys.includes('modifiers'));
});

test('every offered capability is still owner-configurable and has its prerequisites met', () => {
  for (const id of PROFILE_IDS) {
    const config = resolveIndustryConfig({ industryProfile: id });
    for (const capability of ownerConfigurableCapabilities(config)) {
      assert.equal(CAPABILITIES[capability.key].ownerConfigurable, true);
      for (const dep of CAPABILITIES[capability.key].requires || []) {
        assert.equal(config.capabilities[dep], true,
          `${id}: ${capability.key} was offered with ${dep} off`);
      }
    }
  }
});
