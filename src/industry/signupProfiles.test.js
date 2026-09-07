// The food family is DE-SURFACED from sign-up, not deleted. These tests pin
// both halves of that: a new business cannot land on a food profile, and
// everything about those profiles still exists for the businesses already on
// them and for the admin console.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES, PROFILE_IDS, FAMILIES, DEFAULT_PROFILE_ID,
  SIGNUP_DEFERRED_FAMILIES, isSignupSelectable, resolveSignupProfile,
  signupProfilesByFamily, profilesByFamily, getProfile,
} from './profiles.js';

const FOOD_IDS = ['RESTAURANT', 'CAFE', 'FAST_FOOD', 'BAKERY', 'BAR'];
const NON_FOOD_IDS = PROFILE_IDS.filter((id) => PROFILES[id].family !== 'FOOD');

test('every deferred profile is exactly the food family', () => {
  assert.deepEqual(SIGNUP_DEFERRED_FAMILIES, ['FOOD']);
  const deferred = PROFILE_IDS.filter((id) => !isSignupSelectable(id)).sort();
  assert.deepEqual(deferred, [...FOOD_IDS].sort());
});

test('no food profile is offered by the sign-up picker', () => {
  const groups = signupProfilesByFamily();
  assert.ok(groups.length > 0, 'sign-up must still offer something');
  assert.ok(!groups.some((g) => g.id === 'FOOD'), 'FOOD group must not be offered');
  const offered = groups.flatMap((g) => g.profiles.map((p) => p.id));
  for (const id of FOOD_IDS) assert.ok(!offered.includes(id), `${id} must not be offered`);
});

test('every non-food profile IS still offered', () => {
  const offered = signupProfilesByFamily().flatMap((g) => g.profiles.map((p) => p.id));
  for (const id of NON_FOOD_IDS) assert.ok(offered.includes(id), `${id} must be offered`);
  assert.equal(offered.length, NON_FOOD_IDS.length);
});

test('a hand-crafted food profile collapses to the default rather than being written', () => {
  for (const id of FOOD_IDS) assert.equal(resolveSignupProfile(id), DEFAULT_PROFILE_ID);
});

test('a garbage or absent profile also collapses to the default', () => {
  for (const junk of ['', null, undefined, 'PHARMACY_ADMIN', '__proto__', 0, {}, []]) {
    assert.equal(resolveSignupProfile(junk), DEFAULT_PROFILE_ID);
  }
});

test('a legitimate non-food choice passes through untouched', () => {
  for (const id of NON_FOOD_IDS) assert.equal(resolveSignupProfile(id), id);
});

test('the default profile is itself selectable — sign-up can never dead-end', () => {
  assert.ok(isSignupSelectable(DEFAULT_PROFILE_ID));
});

// --- the de-surfacing must NOT have deleted anything ---

test('food profiles still resolve fully for businesses already on them', () => {
  for (const id of FOOD_IDS) {
    const p = getProfile(id);
    assert.equal(p.id, id, `${id} must still resolve to itself, not the default`);
    assert.equal(p.family, 'FOOD');
    assert.ok(p.label && p.tagline, `${id} must keep its wording`);
  }
});

test('the admin picker still sees the food family', () => {
  const groups = profilesByFamily();
  const food = groups.find((g) => g.id === 'FOOD');
  assert.ok(food, 'admin must still be able to see and set food profiles');
  assert.deepEqual(food.profiles.map((p) => p.id).sort(), [...FOOD_IDS].sort());
});

test('FAMILIES still declares FOOD', () => {
  assert.ok(FAMILIES.FOOD, 'the food family must remain in the codebase');
});
