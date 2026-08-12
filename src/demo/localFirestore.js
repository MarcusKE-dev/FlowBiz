// src/demo/localFirestore.js
//
// A minimal Firestore-compatible engine backed by localStorage. It exposes
// the same function names/signatures as the subset of the `firebase/firestore`
// SDK this app actually uses (collection, doc, addDoc, setDoc, updateDoc,
// deleteDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit,
// writeBatch, runTransaction, increment, serverTimestamp, deleteField) so
// that src/firebase.js can route to either implementation without any
// calling code knowing the difference.
//
// DEMO MODE WIRING: `npm run dev:demo` (vite --mode demo) aliases the
// package name 'firebase/firestore' itself to THIS FILE (see
// vite.config.js). That means every `import { collection, doc, ... } from
// 'firebase/firestore'` anywhere in the app — every page, every hook, and
// src/firebase.js itself — resolves to the functions below instead of the
// real Firebase SDK, with zero changes needed in any of those files. This
// is what actually connects this engine to the rest of the app; previously
// nothing did.
//
// Scope is deliberately limited to the query shapes this app actually
// issues (==, in, >=, <= filters; single orderBy; limit) — this is not a
// general-purpose Firestore clone, just enough to power FlowBiz's demo data
// correctly.

const STORAGE_PREFIX = 'flowbiz_demo_data:';

const cache = new Map();     // collectionName -> Map(docId -> data)
const listeners = new Map(); // collectionName -> Set(callback)
let idCounter = 0;

function generateId() {
  idCounter += 1;
  return `demo_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ── Timestamp (mimics Firestore's Timestamp: toDate()/toMillis()) ─────────
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

// ── Storage / cache ─────────────────────────────────────────────────────
function ensureLoaded(name) {
  if (!cache.has(name)) {
    let obj = {};
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (raw) obj = JSON.parse(raw, reviver);
    } catch { /* corrupt or missing — start empty */ }
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

// ── Write sentinels ─────────────────────────────────────────────────────
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

// ── Refs ─────────────────────────────────────────────────────────────────
export function collection(_db, name) { return { __type: 'collection', name }; }
export function doc(a, b, c) {
  if (a && a.__type === 'collection') {
    return { __type: 'doc', name: a.name, id: b || generateId() };
  }
  return { __type: 'doc', name: b, id: c || generateId() };
}

// ── Snapshots ────────────────────────────────────────────────────────────
function makeDocSnapshot(id, data) {
  return { id, exists: () => !!data, data: () => (data ? { ...data } : undefined) };
}
function makeQuerySnapshot(rows) {
  const docs = rows.map(([id, data]) => makeDocSnapshot(id, data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach(fn) { docs.forEach(fn); } };
}

// ── Query engine ─────────────────────────────────────────────────────────
function getField(data, field) { return data ? data[field] : undefined; }
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
    rows = rows.filter(([, data]) => matchWhere(getField(data, c.field), c.op, c.value));
  });
  const orderC = constraints.find((c) => c.kind === 'orderBy');
  if (orderC) {
    rows = [...rows].sort(
      (a, b) => compareField(getField(a[1], orderC.field), getField(b[1], orderC.field)) * (orderC.dir === 'desc' ? -1 : 1)
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

// ── CRUD ─────────────────────────────────────────────────────────────────
export async function addDoc(collRef, data) {
  const id = generateId();
  writeRaw(collRef.name, id, resolveWriteData(data, null));
  persistTouched([collRef.name]);
  notify([collRef.name]);
  return { __type: 'doc', name: collRef.name, id };
}
export async function setDoc(ref, data, opts) {
  const base = opts?.merge ? getRaw(ref.name, ref.id) : null;
  writeRaw(ref.name, ref.id, resolveWriteData(data, base));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function updateDoc(ref, data) {
  const existing = getRaw(ref.name, ref.id);
  if (!existing) throw new Error(`[demo] No document to update at ${ref.name}/${ref.id}`);
  writeRaw(ref.name, ref.id, resolveWriteData(data, existing));
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function deleteDoc(ref) {
  deleteRaw(ref.name, ref.id);
  persistTouched([ref.name]);
  notify([ref.name]);
}
export async function getDoc(ref) {
  return makeDocSnapshot(ref.id, getRaw(ref.name, ref.id));
}
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
  const timer = setTimeout(deliver, 0); // async initial delivery, matches real onSnapshot
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
      persistTouched([...touched]);
      notify([...touched]);
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
  persistTouched([...touched]);
  notify([...touched]);
  return result;
}

// ── Init-time stubs ──────────────────────────────────────────────────────
// src/firebase.js calls these three real-SDK functions at module load time
// (initializeFirestore(app, {...}), inside a persistentLocalCache(...) with
// a persistentMultipleTabManager()). Because Demo Mode aliases the whole
// 'firebase/firestore' package to this file (see the top-of-file comment),
// those calls resolve here too — without these three stubs, firebase.js
// would throw immediately on import in Demo Mode ("initializeFirestore is
// not exported"). They don't need to do anything: this file's storage is
// already always "local" (localStorage) and doesn't use the real SDK's
// cache/tab-manager concepts at all.
export function initializeFirestore() { return { __demo: true }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }

// ── Seeding helpers (used only by src/demo/seedData.js) ────────────────────
export function seedDoc(name, id, data) { writeRaw(name, id, data); }
export function seedCommit(names) { persistTouched(names); notify(names); }
export function clearAllDemoData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  const touched = [...cache.keys()];
  cache.clear();
  notify(touched);
}
export { makeTimestamp };