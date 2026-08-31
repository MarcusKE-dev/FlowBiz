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

export async function getDocument(env, collection, docId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}`, {
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
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed (${collection}/${docId}): ${await res.text()}`);
  return res.json();
}

export async function createDocument(env, collection, docId, data) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}?documentId=${encodeURIComponent(docId)}`, {
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
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}/${docId}`, {
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
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/${collection}${qs}`, {
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