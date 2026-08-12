// src/lib/tenant.js
//
// Multi-tenant helper. Every "business data" collection (sales, products,
// expenses, ...) stores a `businessId` field on every document, and every
// query MUST filter on it — otherwise you'd be reading every business's
// data mixed together in one list. These two helpers make that mistake
// hard to make: you cannot build a query or a write payload without
// passing a businessId in.
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Use this instead of `query(collection(db, name), ...)` for ANY
// collection that holds business-owned data.
export function tenantQuery(collectionName, businessId, ...constraints) {
  if (!businessId) {
    throw new Error(`tenantQuery('${collectionName}') called with no businessId — is the profile loaded yet?`);
  }
  return query(collection(db, collectionName), where('businessId', '==', businessId), ...constraints);
}

// Use this instead of `collection(db, name)` when you need the raw
// CollectionReference (e.g. to pass to addDoc/doc()).
export function tenantCollection(collectionName) {
  return collection(db, collectionName);
}

// Stamps businessId onto data you're about to write with addDoc/setDoc.
export function withBusiness(data, businessId) {
  if (!businessId) throw new Error('withBusiness() called with no businessId');
  return { ...data, businessId };
}
