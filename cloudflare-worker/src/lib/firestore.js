// cloudflare-worker/src/lib/firestore.js
import { getGoogleAccessToken } from './googleAuth.js';

function fieldsToObject(fields) {
  if (!fields) return {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = valueToJs(value);
  return out;
}

function valueToJs(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue !== undefined) return fieldsToObject(value.mapValue.fields);
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(valueToJs);
  return null;
}

export function jsToValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(jsToValue) } };
  if (typeof value === 'object') return { mapValue: { fields: objectToFields(value) } };
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

export function objectToFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) fields[key] = jsToValue(value);
  return fields;
}

function baseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

// Collection and document ids are interpolated into a REST URL PATH. An id
// carrying a `/` would silently re-point the request at a different
// document — `businesses/x/../../users/y` is a real address to Firestore.
// Callers are also expected to validate ids (lib/validate.js); this is the
// second lock on the same door.
function seg(value) {
  return encodeURIComponent(String(value));
}

function docPath(collection, docId) {
  return `${collection.split('/').map(seg).join('/')}/${seg(docId)}`;
}

export async function getDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${docPath(collection, docId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read failed (${collection}/${docId}): ${await res.text()}`);
  const data = await res.json();
  return { id: docId, ...fieldsToObject(data.fields) };
}

export async function patchDocument(env, collection, docId, updates) {
  const token = await getGoogleAccessToken(env);
  const fields = objectToFields(updates);
  const mask = Object.keys(updates).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${docPath(collection, docId)}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}

export async function createDocument(env, collection, docId, data) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection.split('/').map(seg).join('/')}?documentId=${seg(docId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: objectToFields(data) }),
  });
  if (res.status === 409) throw new Error('DOCUMENT_ALREADY_EXISTS');
  if (!res.ok) throw new Error(`Firestore create failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}

export async function deleteDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${docPath(collection, docId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Firestore delete failed (${collection}/${docId}): ${await res.text()}`);
}

export async function listDocuments(env, collection, { pageSize = 100, pageToken = null, orderBy = null } = {}) {
  const token = await getGoogleAccessToken(env);
  const params = new URLSearchParams();
  if (pageSize) params.set('pageSize', String(pageSize));
  if (pageToken) params.set('pageToken', pageToken);
  if (orderBy) params.set('orderBy', orderBy);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection.split('/').map(seg).join('/')}${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { documents: [], nextPageToken: null };
  if (!res.ok) throw new Error(`Firestore listDocuments failed (${collection}): ${await res.text()}`);
  const data = await res.json();
  const rawDocs = data.documents || [];
  const documents = rawDocs.map((d) => ({
    id: d.name.split('/').pop(),
    ...fieldsToObject(d.fields),
  }));
  return { documents, nextPageToken: data.nextPageToken || null };
}

export async function runStructuredQuery(env, structuredQuery) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery failed: ${await res.text()}`);
  const rawList = await res.json();
  const documents = [];
  for (const item of rawList) {
    if (item.document) {
      documents.push({
        id: item.document.name.split('/').pop(),
        ...fieldsToObject(item.document.fields),
      });
    }
  }
  return documents;
}

export async function queryCollection(env, collectionName, { filters = [], orderBy = null, orderDirection = 'DESCENDING', limit = 50, offset = null } = {}) {
  const structuredQuery = {
    from: [{ collectionId: collectionName }],
  };

  if (filters && filters.length > 0) {
    if (filters.length === 1) {
      const f = filters[0];
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: f.field },
          op: f.op || 'EQUAL',
          value: jsToValue(f.value),
        },
      };
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: 'AND',
          filters: filters.map((f) => ({
            fieldFilter: {
              field: { fieldPath: f.field },
              op: f.op || 'EQUAL',
              value: jsToValue(f.value),
            },
          })),
        },
      };
    }
  }

  if (orderBy) {
    structuredQuery.orderBy = [
      {
        field: { fieldPath: orderBy },
        direction: orderDirection,
      },
    ];
  }

  if (limit != null) structuredQuery.limit = limit;
  if (offset != null) structuredQuery.offset = offset;

  return runStructuredQuery(env, structuredQuery);
}
// ═══════════════════════════════════════════════════════════════════════
// Admin operations console primitives
// ═══════════════════════════════════════════════════════════════════════
//
// Everything below exists so the admin console can answer "how big is
// this business?" and "show me page 4 of their sales" WITHOUT reading
// whole collections into a Cloudflare Worker.
//
// Three ideas do all the work:
//
//   1. AGGREGATION QUERIES (`runAggregation`). Firestore can COUNT and
//      SUM server-side and return one number. Billing is roughly one
//      document read per 1000 index entries scanned, so counting a
//      4,000-product catalogue costs ~4 reads instead of 4,000 — and
//      transfers ~30 bytes instead of megabytes. This is why the usage
//      dashboard needs no counter documents and no telemetry writes at
//      all: the numbers are derived on demand from data that already
//      exists.
//
//   2. PROJECTIONS (`select`). `productImages` documents each carry up to
//      250KB of base64. Summing their `bytes` field with a projection (or
//      better, a SUM aggregation) never moves the image data.
//
//   3. CURSOR PAGINATION (`queryPage`). Firestore's `offset` is billed as
//      if the skipped documents were read, so page 40 of a sales log
//      would cost 1,000 reads to show 25 rows. A cursor costs 25.
//
// None of this writes anything. The monitoring system is read-derived by
// design.

function referenceValue(env, collection, docId) {
  return {
    referenceValue:
      `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/` +
      `${collection.split('/').map(seg).join('/')}/${seg(docId)}`,
  };
}

function buildWhere(filters) {
  if (!filters || filters.length === 0) return undefined;
  const toFieldFilter = (f) => ({
    fieldFilter: {
      field: { fieldPath: f.field },
      op: f.op || 'EQUAL',
      value: jsToValue(f.value),
    },
  });
  if (filters.length === 1) return toFieldFilter(filters[0]);
  return { compositeFilter: { op: 'AND', filters: filters.map(toFieldFilter) } };
}

/**
 * COUNT / SUM / AVG without reading the documents.
 *
 * @param {Array<{alias: string, count?: true, sum?: string, avg?: string}>} aggregations
 * @returns {Promise<Record<string, number>>} alias -> number
 */
export async function runAggregation(env, collectionName, { filters = [], aggregations = [], upTo = null } = {}) {
  const token = await getGoogleAccessToken(env);

  const structuredQuery = { from: [{ collectionId: collectionName }] };
  const where = buildWhere(filters);
  if (where) structuredQuery.where = where;
  // `upTo` caps how much index Firestore is allowed to walk. A COUNT with
  // a limit returns min(actual, limit), which is exactly what a "500+"
  // style display needs and bounds the cost of a pathological collection.
  if (upTo != null) structuredQuery.limit = upTo;

  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}:runAggregationQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: aggregations.map((a) => {
          if (a.count) return { alias: a.alias, count: {} };
          if (a.sum) return { alias: a.alias, sum: { field: { fieldPath: a.sum } } };
          if (a.avg) return { alias: a.alias, avg: { field: { fieldPath: a.avg } } };
          throw new Error(`Unsupported aggregation for alias ${a.alias}`);
        }),
      },
    }),
  });

  if (!res.ok) throw new Error(`Firestore aggregation failed (${collectionName}): ${await res.text()}`);

  const out = {};
  for (const item of await res.json()) {
    const fields = item.result?.aggregateFields || {};
    for (const [alias, value] of Object.entries(fields)) {
      const parsed = valueToJs(value);
      out[alias] = typeof parsed === 'number' ? parsed : Number(parsed) || 0;
    }
  }
  return out;
}

/**
 * A COUNT that never throws. Usage panels show many counters at once and
 * one missing composite index must degrade that panel to "—", not 500 the
 * whole page.
 *
 * @returns {Promise<{value: number|null, capped: boolean, error: string|null}>}
 */
export async function safeCount(env, collectionName, filters = [], upTo = null) {
  try {
    const { count } = await runAggregation(env, collectionName, {
      filters,
      aggregations: [{ alias: 'count', count: true }],
      upTo,
    });
    const value = Number(count) || 0;
    return { value, capped: upTo != null && value >= upTo, error: null };
  } catch (err) {
    console.warn(`[safeCount] ${collectionName}:`, err.message);
    return { value: null, capped: false, error: 'unavailable' };
  }
}

/** A SUM that never throws, same reasoning as safeCount. */
export async function safeSum(env, collectionName, field, filters = []) {
  try {
    const result = await runAggregation(env, collectionName, {
      filters,
      aggregations: [{ alias: 'total', sum: field }, { alias: 'count', count: true }],
    });
    return {
      total: Number(result.total) || 0,
      count: Number(result.count) || 0,
      error: null,
    };
  } catch (err) {
    console.warn(`[safeSum] ${collectionName}.${field}:`, err.message);
    return { total: null, count: null, error: 'unavailable' };
  }
}

function encodeCursor(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor) {
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * One page of a scoped collection, with a cursor for the next page.
 *
 * Ordering is always [<orderBy>, __name__] so the cursor is total and
 * stable even when many documents share a timestamp. When `select` is
 * given, the ordering field is added to it automatically — a projection
 * that omitted it could not produce a cursor.
 *
 * @returns {Promise<{documents: object[], nextCursor: string|null, hasMore: boolean}>}
 */
export async function queryPage(env, collectionName, {
  filters = [],
  orderBy = null,
  orderDirection = 'DESCENDING',
  limit = 25,
  cursor = null,
  select = null,
} = {}) {
  const token = await getGoogleAccessToken(env);
  const structuredQuery = { from: [{ collectionId: collectionName }] };

  const where = buildWhere(filters);
  if (where) structuredQuery.where = where;

  const order = [];
  if (orderBy) order.push({ field: { fieldPath: orderBy }, direction: orderDirection });
  order.push({ field: { fieldPath: '__name__' }, direction: orderDirection });
  structuredQuery.orderBy = order;

  if (select) {
    const fields = new Set(select);
    if (orderBy) fields.add(orderBy);
    structuredQuery.select = { fields: [...fields].map((f) => ({ fieldPath: f })) };
  }

  // Fetch one extra row: its presence is how we know another page exists
  // without a second round trip or a count.
  structuredQuery.limit = limit + 1;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && Array.isArray(decoded.v) && typeof decoded.n === 'string') {
      const values = decoded.v.map((raw) => raw);
      values.push(referenceValue(env, collectionName, decoded.n));
      structuredQuery.startAt = { values, before: false };
    }
  }

  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore queryPage failed (${collectionName}): ${await res.text()}`);

  const raw = [];
  for (const item of await res.json()) {
    if (item.document) raw.push(item.document);
  }

  const hasMore = raw.length > limit;
  const page = hasMore ? raw.slice(0, limit) : raw;

  let nextCursor = null;
  if (hasMore && page.length) {
    const last = page[page.length - 1];
    const lastId = last.name.split('/').pop();
    // The RAW Firestore Value is carried in the cursor, not the parsed JS
    // one — a timestamp round-tripped through a JS string would come back
    // as stringValue and silently stop matching the index.
    const orderValues = orderBy ? [last.fields?.[orderBy] ?? { nullValue: null }] : [];
    nextCursor = encodeCursor({ v: orderValues, n: lastId });
  }

  return {
    documents: page.map((d) => ({ id: d.name.split('/').pop(), ...fieldsToObject(d.fields) })),
    nextCursor,
    hasMore,
  };
}

/**
 * Every document in a small platform-level collection, walked page by
 * page up to a hard ceiling. `listDocuments` returns ONE page; the admin
 * directory silently truncated at 300 businesses before this existed.
 */
export async function listAllDocuments(env, collection, { pageSize = 300, maxDocs = 3000 } = {}) {
  const all = [];
  let pageToken = null;
  let truncated = false;

  do {
    const { documents, nextPageToken } = await listDocuments(env, collection, { pageSize, pageToken });
    all.push(...documents);
    pageToken = nextPageToken;
    if (all.length >= maxDocs) {
      truncated = Boolean(pageToken);
      break;
    }
  } while (pageToken);

  return { documents: all.slice(0, maxDocs), truncated };
}
