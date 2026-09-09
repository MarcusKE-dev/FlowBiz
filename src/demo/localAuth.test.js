// src/demo/localAuth.test.js
//
// THE BUG THIS FILE EXISTS FOR: the Sign out button in the demo ran and
// nothing happened.
//
// `signOut()` resolved without changing any state, and
// `onAuthStateChanged` had delivered the demo user once and then gone
// silent forever — so AuthContext was never told, `firebaseUser` stayed
// set, and ProtectedRoute had no reason to move. Every layer above was
// working correctly on an answer that was never updated.
//
// The second half is getting back IN. AuthContext.login() asks the
// credential for an ID token the moment sign-in returns; the demo user
// had no getIdToken, so the call threw a TypeError, login()'s own catch
// re-threw it, and the sign-in screen reported "Something went wrong
// signing in" on a sign-in that had succeeded. A sign-out you cannot
// reverse is worse than one that never fired.

import test from 'node:test';
import assert from 'node:assert/strict';

const MODULE = new URL('./localAuth.js', import.meta.url).pathname;

function installStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  return store;
}

function installBroadcastChannel() {
  const open = new Set();
  globalThis.BroadcastChannel = class {
    constructor(name) { this.name = name; open.add(this); }
    postMessage(data) {
      open.forEach((c) => { if (c !== this && c.name === this.name) c.onmessage?.({ data }); });
    }
  };
  return () => open.clear();
}

const settle = () => new Promise((r) => setTimeout(r, 5));

test('SIGN OUT ACTUALLY SIGNS OUT — the subscriber is told, which is the whole mechanism', async () => {
  installStorage();
  installBroadcastChannel();
  const auth = await import(`${MODULE}?case=basic`);

  const seen = [];
  auth.onAuthStateChanged(auth.getAuth(), (user) => seen.push(user ? user.uid : null));
  await settle();
  assert.deepEqual(seen, ['demo-admin'], 'the first state arrives asynchronously, as Firebase does it');

  await auth.signOut();
  assert.deepEqual(seen.at(-1), null, 'signing out must reach the subscriber');
  assert.equal(auth.getAuth().currentUser, null, 'and auth.currentUser must agree');

  await auth.signInWithEmailAndPassword(auth.getAuth(), 'anything@example.com', 'anything');
  assert.equal(seen.at(-1), 'demo-admin', 'signing back in must reach it too');
  assert.equal(auth.getAuth().currentUser?.uid, 'demo-admin');
});

test('SIGNING IN RETURNS A CREDENTIAL AuthContext CAN USE — it asks for an ID token immediately', async () => {
  installStorage();
  installBroadcastChannel();
  const auth = await import(`${MODULE}?case=token`);

  const credential = await auth.signInWithEmailAndPassword(auth.getAuth(), 'a@b.c', 'x');
  assert.equal(typeof credential.user.getIdToken, 'function',
    'AuthContext.login() calls credential.user.getIdToken() and reported a failed sign-in without it');
  assert.equal(await credential.user.getIdToken(), 'demo-id-token');
});

test('SIGNED OUT SURVIVES A RELOAD — otherwise the button un-presses itself', async () => {
  const store = installStorage();
  installBroadcastChannel();
  const before = await import(`${MODULE}?case=reload-a`);

  await before.signOut();
  assert.equal(store.get('flowbiz_demo_signed_out'), 'true');

  // A fresh module instance is what a reloaded page gets.
  const after = await import(`${MODULE}?case=reload-b`);
  assert.equal(after.getAuth().currentUser, null, 'a reload must not sign the visitor back in');

  await after.signInWithEmailAndPassword(after.getAuth(), 'a@b.c', 'x');
  const later = await import(`${MODULE}?case=reload-c`);
  assert.equal(later.getAuth().currentUser?.uid, 'demo-admin', 'and signing in must stick the same way');
});

test('SIGN OUT REACHES THE OTHER SCREENS — the kitchen rail must not stay signed in', async () => {
  installStorage();
  const reset = installBroadcastChannel();
  const counter = await import(`${MODULE}?case=tabs-counter`);
  const rail    = await import(`${MODULE}?case=tabs-rail`);

  const onRail = [];
  rail.onAuthStateChanged(rail.getAuth(), (user) => onRail.push(user ? user.uid : null));
  await settle();
  assert.deepEqual(onRail, ['demo-admin']);

  await counter.signOut();
  assert.equal(onRail.at(-1), null, 'the other window must be signed out without being reloaded');
  assert.equal(rail.getAuth().currentUser, null);

  await counter.signInWithEmailAndPassword(counter.getAuth(), 'a@b.c', 'x');
  assert.equal(onRail.at(-1), 'demo-admin');

  reset();
});

test('UNSUBSCRIBING STOPS DELIVERY — including the very first, still-pending state', async () => {
  installStorage();
  installBroadcastChannel();
  const auth = await import(`${MODULE}?case=unsub`);

  const seen = [];
  const unsub = auth.onAuthStateChanged(auth.getAuth(), (u) => seen.push(u));
  unsub();
  await settle();
  await auth.signOut();
  assert.deepEqual(seen, [], 'a torn-down listener must never fire');
});
