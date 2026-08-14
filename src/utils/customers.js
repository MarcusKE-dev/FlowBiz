// src/utils/customers.js
import { doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { tenantCollection, withBusiness } from '../lib/tenant';
import { raceWithTimeout } from './offlineWrite';
import { normalizePhone } from './whatsapp'; // FIX: Corrected import path

export async function createCustomer(data, businessId) {
  if (!businessId) throw new Error('createCustomer() called with no businessId');
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Customer name is required.');

  const phone = data.phone ? normalizePhone(data.phone) : '';
  const customerCode = `CUS-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

  const customerPayload = withBusiness({
    name,
    phone: phone || '',
    customerCode,
    email: data.email || '',
    address: data.address || '',
    notes: data.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, businessId);

  const write = addDoc(tenantCollection('customers'), customerPayload);
  const { queuedOffline, value: ref, error } = await raceWithTimeout(write, 4000);
  if (error) throw error;

  return {
    id: ref ? ref.id : null,
    customerCode,
    name,
    phone,
    queuedOffline,
  };
}

export async function updateCustomer(customerId, data, businessId) {
  if (!businessId) throw new Error('updateCustomer() called with no businessId');
  if (!customerId) throw new Error('updateCustomer() called with no customerId');

  const customerRef = doc(db, 'customers', customerId);
  const { businessId: _ignored, id: _ignoredId, ...updates } = data;

  if (updates.phone) {
    updates.phone = normalizePhone(updates.phone);
  }

  const write = updateDoc(customerRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  const { queuedOffline, error } = await raceWithTimeout(write, 4000);
  if (error) throw error;

  return { queuedOffline };
}