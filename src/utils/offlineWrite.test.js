// src/utils/offlineWrite.test.js
//
// THE BUG THIS PINS: an online device was being told its work had been
// "saved offline" and would "sync when you reconnect". The cause was a
// hard clamp that cut every caller's timeout to 1.5s, plus the assumption
// that a timeout proves the device is offline. On a slow-but-live
// connection — the normal case on Kenyan mobile data — both fired, and
// the person was told they were offline while they were watching the
// page load.
//
// So the contract under test is: `queuedOffline` reports CONNECTIVITY,
// never latency, and `value` is absent whenever the write has not
// actually settled.

import test from 'node:test';
import assert from 'node:assert/strict';
import { raceWithTimeout } from './offlineWrite.js';

/** Drive navigator.onLine without needing a browser. */
function withOnline(online, run) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'navigator');
  const previous = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: online }, configurable: true, writable: true,
  });
  return (async () => {
    try { return await run(); }
    finally {
      if (had) {
        Object.defineProperty(globalThis, 'navigator', {
          value: previous, configurable: true, writable: true,
        });
      } else {
        delete globalThis.navigator;
      }
    }
  })();
}

const never = () => new Promise(() => {});
const slow = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

test('a resolved write reports online, settled, and carries its value', () => withOnline(true, async () => {
  const result = await raceWithTimeout(Promise.resolve({ id: 'abc' }), 4000);
  assert.equal(result.queuedOffline, false);
  assert.equal(result.pending, false);
  assert.deepEqual(result.value, { id: 'abc' });
  assert.equal(result.error, undefined);
}));

test('THE FIX: an online write that outruns the timeout is NOT reported as offline', () =>
  withOnline(true, async () => {
    const result = await raceWithTimeout(never(), 1000);
    assert.equal(result.queuedOffline, false,
      'a slow connection is not a missing one — this is the toast the user actually saw');
    assert.equal(result.pending, true, 'but it has not settled, and callers must know that');
  }));

test('a genuinely offline device is reported as offline, immediately', () =>
  withOnline(false, async () => {
    const started = Date.now();
    const result = await raceWithTimeout(never(), 15000);
    assert.equal(result.queuedOffline, true);
    assert.equal(result.pending, true);
    assert.ok(Date.now() - started < 500, 'offline must not wait out the timeout');
  }));

test('a pending result carries NO value, so nothing can dereference one', () =>
  withOnline(true, async () => {
    const timedOut = await raceWithTimeout(never(), 1000);
    assert.equal(timedOut.value, undefined);
    const offline = await withOnline(false, () => raceWithTimeout(never(), 1000));
    assert.equal(offline.value, undefined);
  }));

test('a rejected write is final — an error, never a pending queue', () => withOnline(true, async () => {
  const boom = new Error('permission-denied');
  const result = await raceWithTimeout(Promise.reject(boom), 4000);
  assert.equal(result.error, boom);
  assert.equal(result.pending, false);
  assert.equal(result.queuedOffline, false, 'a rejection must never be dressed up as an offline queue');
}));

test("the caller's timeout is honoured, not silently clamped down to 1.5s", () =>
  withOnline(true, async () => {
    // The regression: a 4s budget was cut to 1.5s, so a 2.5s write — an
    // ordinary write on mobile data — always "timed out".
    const result = await raceWithTimeout(slow(2000, { id: 'ok' }), 4000);
    assert.equal(result.pending, false, 'a 2s write must fit inside a 4s budget');
    assert.deepEqual(result.value, { id: 'ok' });
  }));

test('a timeout is bounded at both ends so no caller can hang the UI or skip the wait', () =>
  withOnline(true, async () => {
    const started = Date.now();
    await raceWithTimeout(never(), 0); // floors to 1s rather than resolving instantly
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 900, `a zero timeout must still wait about a second, waited ${elapsed}ms`);
    assert.ok(elapsed < 2000, `and must not have silently fallen back to the 4s default (${elapsed}ms)`);
  }));

test('a nonsense timeout falls back to the default rather than to zero', () =>
  withOnline(true, async () => {
    const result = await raceWithTimeout(slow(1500, { id: 'ok' }), 'soon');
    assert.equal(result.pending, false, 'the 4s default must apply, not a 0ms one');
    assert.deepEqual(result.value, { id: 'ok' });
  }));

test('a write that settles after the timeout cannot resolve the result twice', () =>
  withOnline(true, async () => {
    let resolveLate;
    const late = new Promise((r) => { resolveLate = r; });
    const result = await raceWithTimeout(late, 1000);
    assert.equal(result.pending, true);
    resolveLate({ id: 'late' });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(result.value, undefined, 'the already-returned result must not mutate');
  }));
