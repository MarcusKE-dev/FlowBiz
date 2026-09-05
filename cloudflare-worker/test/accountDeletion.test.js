// Who is allowed to delete what.
//
// `POST /api/auth/delete-own-profile` takes a `mode` from the request
// body, and `full-wipe` deletes the whole tenant. The mode is therefore
// attacker-chosen input: these tests prove the Worker re-derives the
// right to use it from the caller's own profile, not from what the
// caller asked for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { installStub, mintIdToken, env, adminRequest } from './helpers/adminHarness.js';

const { handleDeleteOwnProfile } = await import('../src/routes/deleteOwnProfile.js');

function seedBusiness(state, { extraUsers = {} } = {}) {
  state.store['businesses/biz-1'] = { name: 'Mama Njeri Stores', createdBy: 'owner-uid' };
  state.store['businessSettings/biz-1'] = { currency: 'KES' };
  state.store['users/owner-uid'] = { businessId: 'biz-1', role: 'owner', active: true };
  state.store['users/cashier-uid'] = { businessId: 'biz-1', role: 'cashier', active: true };
  for (const [k, v] of Object.entries(extraUsers)) state.store[k] = v;
}

const wipeRequest = (uid) => adminRequest('/api/auth/delete-own-profile', {
  token: mintIdToken({ uid }),
  method: 'POST',
  body: { mode: 'full-wipe' },
});

test('a CASHIER cannot wipe the business by asking for full-wipe', async () => {
  const state = installStub();
  seedBusiness(state);

  const res = await handleDeleteOwnProfile(wipeRequest('cashier-uid'), env);

  assert.equal(res.status, 403);
  assert.ok(state.store['businesses/biz-1'], 'the business must survive');
  assert.ok(state.store['businessSettings/biz-1'], 'the settings must survive');
  assert.ok(state.store['users/cashier-uid'], 'nothing is deleted on a refused request');
});

test('a DEACTIVATED owner cannot wipe the business', async () => {
  const state = installStub();
  seedBusiness(state);
  state.store['users/owner-uid'].active = false;

  const res = await handleDeleteOwnProfile(wipeRequest('owner-uid'), env);

  assert.equal(res.status, 403);
  assert.ok(state.store['businesses/biz-1']);
});

test('an owner cannot wipe a business that still has another active owner', async () => {
  const state = installStub();
  seedBusiness(state, {
    extraUsers: { 'users/owner-2': { businessId: 'biz-1', role: 'owner', active: true } },
  });

  const res = await handleDeleteOwnProfile(wipeRequest('owner-uid'), env);

  assert.equal(res.status, 409);
  assert.ok(state.store['businesses/biz-1'], 'the co-owner keeps the business');
  assert.ok(state.store['users/owner-uid'], 'and the request is refused whole');
});

test('an owner who is the last one standing CAN wipe the business', async () => {
  const state = installStub();
  seedBusiness(state, {
    // An owner who was switched off does not veto the wipe.
    extraUsers: { 'users/owner-2': { businessId: 'biz-1', role: 'owner', active: false } },
  });

  const res = await handleDeleteOwnProfile(wipeRequest('owner-uid'), env);

  assert.equal(res.status, 200);
  assert.equal(state.store['businesses/biz-1'], undefined);
  assert.equal(state.store['businessSettings/biz-1'], undefined);
  assert.equal(state.store['users/owner-uid'], undefined);
});

test("another business's owner is never counted, and never touched", async () => {
  const state = installStub();
  seedBusiness(state, {
    extraUsers: { 'users/other-owner': { businessId: 'biz-2', role: 'owner', active: true } },
  });
  state.store['businesses/biz-2'] = { name: 'Other Shop' };

  const res = await handleDeleteOwnProfile(wipeRequest('owner-uid'), env);

  assert.equal(res.status, 200);
  assert.ok(state.store['businesses/biz-2'], 'the other tenant is untouched');
  assert.ok(state.store['users/other-owner']);
});

test('self-only removes the caller and nothing else, whatever their role', async () => {
  const state = installStub();
  seedBusiness(state);

  const res = await handleDeleteOwnProfile(adminRequest('/api/auth/delete-own-profile', {
    token: mintIdToken({ uid: 'cashier-uid' }),
    method: 'POST',
    body: { mode: 'self-only' },
  }), env);

  assert.equal(res.status, 200);
  assert.equal(state.store['users/cashier-uid'], undefined);
  assert.ok(state.store['businesses/biz-1']);
  assert.ok(state.store['users/owner-uid']);
});

test('an unknown mode is refused before anything is read', async () => {
  const state = installStub();
  seedBusiness(state);

  const res = await handleDeleteOwnProfile(adminRequest('/api/auth/delete-own-profile', {
    token: mintIdToken({ uid: 'owner-uid' }),
    method: 'POST',
    body: { mode: 'wipe-everything' },
  }), env);

  assert.equal(res.status, 400);
  assert.ok(state.store['users/owner-uid']);
});

test('a request with no token is refused', async () => {
  const state = installStub();
  seedBusiness(state);

  const res = await handleDeleteOwnProfile(adminRequest('/api/auth/delete-own-profile', {
    method: 'POST',
    body: { mode: 'full-wipe' },
  }), env);

  assert.equal(res.status, 401);
  assert.ok(state.store['businesses/biz-1']);
});
