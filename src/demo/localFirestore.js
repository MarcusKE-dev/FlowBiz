// src/demo/localFirestore.js
const STORAGE_PREFIX = 'flowbiz_demo_data:';

const cache = new Map();
const listeners = new Map();
let idCounter = 0;

function generateId() {
  idCounter += 1;
  return `demo_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function makeTimestamp(millis) {
  return {
    __ts: true,
    millis,
    toDate() { return new Date(millis); },
    toMillis() { return millis; },
  };
}

function reviver(key, value) {
  if (value && typeof value === 'object' && value.__ts === true && typeof value.millis === 'number') {
    return makeTimestamp(value.millis);
  }
  return value;
}

function ensureLoaded(name) {
  if (!cache.has(name)) {
    let obj = {};
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (raw) obj = JSON.parse(raw, reviver);
    } catch { /* corrupt or unreadable demo data falls back to the empty object */ }
    cache.set(name, new Map(Object.entries(obj)));
  }
  return cache.get(name);
}

function getRaw(name, id) { return ensureLoaded(name).get(id) || null; }
function writeRaw(name, id, data) { ensureLoaded(name).set(id, data); }
function deleteRaw(name, id) { ensureLoaded(name).delete(id); }

function persistTouched(names) {
  names.forEach((name) => {
    const map = ensureLoaded(name);
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(Object.fromEntries(map)));
  });
}

function subscribe(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

function notify(names) { names.forEach((name) => listeners.get(name)?.forEach((fn) => fn())); }

// ── CROSS-TAB / CROSS-WINDOW DELIVERY ────────────────────────────────
//
// A restaurant demo runs on more than one screen at once. The waiter
// rings the order up on a tablet, the rail is on a wall in the kitchen,
// the customer display is on a monitor at the pass — three windows, and
// in a browser that is three separate copies of THIS module, each with
// its own `cache` and its own `listeners`.
//
// Persisting to localStorage was never enough to join them. localStorage
// does not notify the tab that wrote it, and the other tabs had already
// read the collection into memory, so a second window only ever saw the
// first window's writes by being RELOADED. That is exactly the "I have
// to refresh" the demo was showing, and it was never anything about
// those screens — the same two listeners drive all three.
//
// So a local write is ANNOUNCED, and a tab that hears the announcement
// DROPS its cached copy of the named collections and then re-notifies.
// Dropping rather than patching, because the next ensureLoaded() then
// re-reads the authoritative copy straight out of localStorage: one code
// path, and no way for what a tab was told to drift from what was
// stored. The listeners downstream re-run their queries against the
// fresh rows and render. No reload anywhere.
//
// TWO TRANSPORTS, because either one alone has a hole:
//
//   BroadcastChannel is the fast path, and deliberately does NOT echo to
//   the sender — exactly right here, since the writing tab has already
//   notified itself synchronously.
//
//   The `storage` event is the fallback for anything without
//   BroadcastChannel, and likewise fires only in the OTHER tabs.
//
// Both are wired. A change that arrives over both is harmless: dropping
// an already-dropped cache entry and re-running a query is idempotent.

const CHANNEL_NAME = 'flowbiz_demo_firestore';

let channel = null;
try {
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
} catch {
  channel = null; // unavailable — the storage event still covers us
}

// Everything in this tab forgets what it knew about these collections
// and re-reads. Called ONLY for changes made by another tab; a tab's own
// writes are already in its cache and have already been notified.
function adoptExternal(names) {
  names.forEach((name) => cache.delete(name));
  notify(names);
}

function adoptExternalClear() {
  const touched = [...cache.keys()];
  cache.clear();
  notify(touched);
}

function announce(message) {
  try { channel?.postMessage(message); } catch { /* closed — the storage event still fires */ }
}

if (channel) {
  channel.onmessage = (event) => {
    const msg = event?.data;
    if (!msg) return;
    if (msg.type === 'cleared') adoptExternalClear();
    else if (msg.type === 'changed' && Array.isArray(msg.names)) adoptExternal(msg.names);
  };
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    // A whole-storage clear reports a null key, and invalidates the lot.
    if (event.key === null) { adoptExternalClear(); return; }
    if (!event.key.startsWith(STORAGE_PREFIX)) return;
    adoptExternal([event.key.slice(STORAGE_PREFIX.length)]);
  });
}

// THE ONE WAY A WRITE REACHES EVERYTHING WATCHING IT: persist it, tell
// this tab, tell the others. Every mutating export below ends here, so a
// write cannot be added that some screen fails to see.
//
// Persisting rewrites the whole collection from this tab's cache, so a
// tab holding a stale cache could in principle overwrite another tab's
// row. It does not in practice: the announcement that invalidates a
// tab's cache is delivered when it is SENT, not when that tab next
// writes, so by the time a write here reloads the collection it reloads
// the other tab's row along with it.
function publish(names) {
  if (names.length === 0) return;
  persistTouched(names);
  notify(names);
  announce({ type: 'changed', names });
}

function isSentinel(v, kind) { return !!v && typeof v === 'object' && v.__sentinel === kind; }

function resolveWriteData(data, base) {
  const out = base ? { ...base } : {};
  Object.entries(data).forEach(([k, v]) => {
    if (isSentinel(v, 'serverTimestamp')) out[k] = makeTimestamp(Date.now());
    else if (isSentinel(v, 'increment')) out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v.n;
    else if (isSentinel(v, 'deleteField')) delete out[k];
    else out[k] = v;
  });
  return out;
}

export function increment(n) { return { __sentinel: 'increment', n }; }
export function serverTimestamp() { return { __sentinel: 'serverTimestamp' }; }
export function deleteField() { return { __sentinel: 'deleteField' }; }

export function collection(_db, name) { return { __type: 'collection', name }; }
export function doc(a, b, c) {
  if (a && a.__type === 'collection') {
    return { __type: 'doc', name: a.name, id: b || generateId() };
  }
  return { __type: 'doc', name: b, id: c || generateId() };
}

function makeDocSnapshot(id, data) {
  return { id, exists: () => !!data, data: () => (data ? { ...data } : undefined) };
}

function makeQuerySnapshot(rows) {
  const docs = rows.map(([id, data]) => makeDocSnapshot(id, data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach(fn) { docs.forEach(fn); } };
}

function getField(data, docId, field) {
  if (field === '__name__') return docId;
  return data ? data[field] : undefined;
}

function toComparable(v) {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return v;
}

function matchWhere(fieldVal, op, value) {
  const a = toComparable(fieldVal);
  const b = toComparable(value);
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '<':  return a < b;
    case 'in': return Array.isArray(value) && value.includes(fieldVal);
    case 'array-contains': return Array.isArray(fieldVal) && fieldVal.includes(value);
    default: return true;
  }
}

function compareField(a, b) {
  const av = toComparable(a); const bv = toComparable(b);
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function runQuery(target) {
  const name = target.__type === 'query' ? target.__collName : target.name;
  let rows = [...ensureLoaded(name).entries()];
  const constraints = target.__type === 'query' ? target.constraints : [];
  constraints.filter((c) => c.kind === 'where').forEach((c) => {
    rows = rows.filter(([id, data]) => matchWhere(getField(data, id, c.field), c.op, c.value));
  });
  const orderC = constraints.find((c) => c.kind === 'orderBy');
  if (orderC) {
    rows = [...rows].sort(
      (a, b) => compareField(getField(a[1], a[0], orderC.field), getField(b[1], b[0], orderC.field)) * (orderC.dir === 'desc' ? -1 : 1)
    );
  }
  const limitC = constraints.find((c) => c.kind === 'limit');
  if (limitC) rows = rows.slice(0, limitC.n);
  return rows;
}

export function query(collRef, ...constraints) {
  return { __type: 'query', __collName: collRef.name, constraints };
}
export function where(field, op, value) { return { kind: 'where', field, op, value }; }
export function orderBy(field, dir = 'asc') { return { kind: 'orderBy', field, dir }; }
export function limit(n) { return { kind: 'limit', n }; }

export async function addDoc(collRef, data) {
  const id = generateId();
  writeRaw(collRef.name, id, resolveWriteData(data, null));
  publish([collRef.name]);
  return { __type: 'doc', name: collRef.name, id };
}
export async function setDoc(ref, data, opts) {
  const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
  writeRaw(ref.name, ref.id, resolveWriteData(data, base));
  publish([ref.name]);
}
export async function updateDoc(ref, data) {
  const existing = getRaw(ref.name, ref.id);
  if (!existing) throw new Error(`[demo] No document to update at ${ref.name}/${ref.id}`);
  writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
  publish([ref.name]);
}
export async function deleteDoc(ref) {
  deleteRaw(ref.name, ref.id);
  publish([ref.name]);
}
export async function getDoc(ref) {
  return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id));
}
// The demo store is entirely local, so "from cache" and "from server"
// are the same read. Exported because utils/productImages.js imports it
// from 'firebase/firestore', and this module is aliased over that in
// demo builds — a missing export here is a build failure, not a runtime
// fallback.
export async function getDocFromCache(ref) { return getDoc(ref); }

export async function getDocs(target) {
  return makeQuerySnapshot(runQuery(target));
}
export function onSnapshot(target, onNext, onError) {
  const isDocRef = target.__type === 'doc';
  const key = isDocRef ? target.name : target.__collName;
  const deliver = () => {
    try {
      if (isDocRef) onNext(makeDocSnapshot(target.id, getRaw(target.name, target.id)));
      else onNext(makeQuerySnapshot(runQuery(target)));
    } catch (err) {
      onError?.(err);
    }
  };
  const timer = setTimeout(deliver, 0);
  const unsub = subscribe(key, deliver);
  return () => { clearTimeout(timer); unsub(); };
}

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push({ type: 'set', ref, data, opts }); },
    update(ref, data) { ops.push({ type: 'update', ref, data }); },
    delete(ref) { ops.push({ type: 'delete', ref }); },
    async commit() {
      const touched = new Set();
      for (const op of ops) {
        if (op.type === 'set') {
          const base = op.opts?.merge ? getRaw(op.ref.name, op.ref.id) : null;
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, base));
        } else if (op.type === 'update') {
          const existing = getRaw(op.ref.name, op.ref.id) || {};
          writeRaw(op.ref.name, op.ref.id, resolveWriteData(op.data, existing));
        } else if (op.type === 'delete') {
          deleteRaw(op.ref.name, op.ref.id);
        }
        touched.add(op.ref.name);
      }
      publish([...touched]);
    },
  };
}

export async function runTransaction(_db, updateFn) {
  const touched = new Set();
  const tx = {
    async get(ref) { return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id)); },
    set(ref, data, opts) {
      const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
      writeRaw(ref.name, ref.id, resolveWriteData(data, base));
      touched.add(ref.name);
    },
    update(ref, data) {
      const existing = getRaw(ref.name, ref.id) || {};
      writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
      touched.add(ref.name);
    },
    delete(ref) { deleteRaw(ref.name, ref.id); touched.add(ref.name); },
  };
  const result = await updateFn(tx);
  publish([...touched]);
  return result;
}

export function initializeFirestore() { return { __demo: true }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function connectFirestoreEmulator() {}

export function seedDoc(name, id, data) { writeRaw(name, id, data); }
export function seedCommit(names) { publish(names); }
export function clearAllDemoData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  adoptExternalClear();
  announce({ type: 'cleared' });
}
export { makeTimestamp };