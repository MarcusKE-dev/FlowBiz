// src/demo/localFirestore.test.js
//
// THE BUG THIS FILE EXISTS FOR: the demo looked broken on exactly the
// screens the demo is for.
//
// A restaurant demo is shown on several windows at once — the waiter's
// tablet, the kitchen rail, the customer display at the pass. Each of
// those is its own copy of localFirestore.js, with its own in-memory
// `cache` and its own `listeners`. Writes were persisted to localStorage
// and announced to nobody, and localStorage notifies neither the tab
// that wrote it nor a tab that had already read the collection into
// memory. So an order rung up on one screen appeared on the others only
// after a RELOAD, and the honest conclusion a person draws from that is
// that the product does not sync.
//
// Nothing here touches a browser. Two imports of the same module with
// different query strings are two module instances — which is exactly
// what two tabs are — and a stub stands in for each transport.

import test from 'node:test';
import assert from 'node:assert/strict';

const MODULE = new URL('./localFirestore.js', import.meta.url).pathname;

/**
 * A localStorage every "tab" shares, as a browser origin does — and one
 * whose stored keys are own enumerable properties, because the real
 * Storage object's are and `clearAllDemoData` walks them with
 * Object.keys(). A plain object here would have made that function look
 * like it worked while removing nothing.
 */
function installStorage() {
  const store = new Map();
  const api = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  globalThis.localStorage = new Proxy(api, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (target, k) => (store.has(k)
      ? { value: store.get(k), enumerable: true, configurable: true, writable: true }
      : Reflect.getOwnPropertyDescriptor(target, k)),
    get: (target, k) => (k in target ? target[k] : store.get(k)),
  });
  return store;
}

/**
 * A BroadcastChannel that behaves like the real one in the one respect
 * this code depends on: a message reaches every OTHER channel on the
 * name and never echoes to its sender.
 */
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

/** The fallback transport: no BroadcastChannel, only `storage` events. */
function installStorageEvents(store) {
  const handlers = new Set();
  globalThis.BroadcastChannel = undefined;
  globalThis.window = { addEventListener: (type, fn) => { if (type === 'storage') handlers.add(fn); } };
  // Real storage events fire only in the OTHER tabs, so the writer is
  // identified by the localStorage proxy that performed the write.
  let writer = null;
  const raw = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: raw.getItem,
    setItem: (k, v) => { raw.setItem(k, v); handlers.forEach((fn) => { if (fn.owner !== writer) fn({ key: k }); }); },
    removeItem: (k) => { raw.removeItem(k); handlers.forEach((fn) => { if (fn.owner !== writer) fn({ key: k }); }); },
  };
  return {
    store,
    tagLast: (owner) => { [...handlers].at(-1).owner = owner; },
    asTab: (owner, fn) => { writer = owner; try { return fn(); } finally { writer = null; } },
  };
}

const openLines = (m) => m.query(
  m.collection(null, 'orderLines'), m.where('open', '==', true), m.orderBy('seq', 'asc'),
);

function watch(m) {
  const frames = [];
  m.onSnapshot(openLines(m), (snap) => frames.push(snap.docs.map((d) => d.data().stage)));
  return frames;
}

const settle = () => new Promise((r) => setTimeout(r, 5));

test('A TICKET REACHES EVERY OPEN WINDOW WITHOUT A RELOAD — waiter, kitchen, display', async () => {
  installStorage();
  const reset = installBroadcastChannel();

  const waiter  = await import(`${MODULE}?bc=waiter`);
  const kitchen = await import(`${MODULE}?bc=kitchen`);
  const display = await import(`${MODULE}?bc=display`);

  const seen = { waiter: watch(waiter), kitchen: watch(kitchen), display: watch(display) };
  await settle();

  // The waiter fires a line.
  const ref = await waiter.addDoc(
    waiter.collection(null, 'orderLines'),
    { open: true, seq: 1, name: 'Cheeseburger', stage: 'sent' },
  );
  await settle();
  assert.deepEqual(seen.kitchen.at(-1), ['sent'], 'the kitchen rail must show a line the moment it is fired');
  assert.deepEqual(seen.display.at(-1), ['sent'], 'the customer display must show it too');

  // The kitchen bumps it.
  await kitchen.updateDoc(kitchen.doc(kitchen.collection(null, 'orderLines'), ref.id), { stage: 'ready' });
  await settle();
  assert.deepEqual(seen.waiter.at(-1), ['ready'], "the waiter's tablet must see the bump");
  assert.deepEqual(seen.display.at(-1), ['ready'], 'the customer display must see the bump');

  // Served closes the line and it leaves every screen's query at once.
  await waiter.updateDoc(waiter.doc(waiter.collection(null, 'orderLines'), ref.id), { stage: 'served', open: false });
  await settle();
  assert.deepEqual(seen.kitchen.at(-1), [], 'a served line must leave the rail everywhere');
  assert.deepEqual(seen.display.at(-1), [], 'a served line must leave the display everywhere');

  reset();
});

test('A BATCH LANDS EVERYWHERE AS ONE CHANGE — a ticket and its lines never arrive apart', async () => {
  installStorage();
  const reset = installBroadcastChannel();

  const till = await import(`${MODULE}?batch=till`);
  const rail = await import(`${MODULE}?batch=rail`);

  const headers = [];
  rail.onSnapshot(rail.query(rail.collection(null, 'orders')), (s) => headers.push(s.size));
  const lines = watch(rail);
  await settle();

  const batch = till.writeBatch();
  batch.set(till.doc(till.collection(null, 'orders'), 't1'), { status: 'open', table: 'T4' });
  batch.set(till.doc(till.collection(null, 'orderLines'), 'l1'), { open: true, seq: 1, stage: 'sent', orderId: 't1' });
  await batch.commit();
  await settle();

  assert.equal(headers.at(-1), 1, 'the ticket header must reach the other window');
  assert.deepEqual(lines.at(-1), ['sent'], 'and so must its lines, from the same commit');

  reset();
});

test('WITHOUT BroadcastChannel THE STORAGE EVENT CARRIES IT — the fallback is not decorative', async () => {
  const store = installStorage();
  const env = installStorageEvents(store);

  const waiter  = await import(`${MODULE}?se=waiter`);
  env.tagLast('waiter');
  const kitchen = await import(`${MODULE}?se=kitchen`);
  env.tagLast('kitchen');

  const seen = watch(kitchen);
  await settle();

  env.asTab('waiter', () => waiter.addDoc(
    waiter.collection(null, 'orderLines'),
    { open: true, seq: 1, stage: 'sent' },
  ));
  await settle();

  assert.deepEqual(seen.at(-1), ['sent'], 'a browser without BroadcastChannel must still see the order');

  delete globalThis.window;
});

test('A DEMO RESET CLEARS EVERY WINDOW — one tab must not keep showing data another wiped', async () => {
  installStorage();
  const reset = installBroadcastChannel();

  const owner = await import(`${MODULE}?clear=owner`);
  const rail  = await import(`${MODULE}?clear=rail`);

  const seen = watch(rail);
  await owner.addDoc(owner.collection(null, 'orderLines'), { open: true, seq: 1, stage: 'sent' });
  await settle();
  assert.deepEqual(seen.at(-1), ['sent']);

  owner.clearAllDemoData();
  await settle();
  assert.deepEqual(seen.at(-1), [], 'the other window must empty without being reloaded');

  reset();
});
