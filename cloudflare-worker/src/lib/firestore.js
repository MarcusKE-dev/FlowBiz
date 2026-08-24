// src/lib/firestore.js
//
// Minimal Firestore REST API client — just enough for this backend's
// needs (read-by-id, patch-by-id, create-by-id). Deliberately NOT a
// general Firestore SDK: no queries, no transactions. Every route in this
// project only ever needs to read/write documents it already knows the ID
// of (a uid, a businessId, a Paystack reference), so this stays small.
//
// Auth is via the OAuth2 access token from googleAuth.js, which — like
// the Firebase Admin SDK — bypasses Firestore Security Rules entirely.
// That's expected and required: this is the privileged, server-side path.

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
  if (value.timestampValue !== undefined) return value.timestampValue; // ISO string
  if (value.mapValue !== undefined) return fieldsToObject(value.mapValue.fields);
  if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(valueToJs);
  return null;
}

function jsToValue(value) {
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

function objectToFields(obj) {
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