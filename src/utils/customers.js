// src/utils/customers.js
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { tenantCollection, withBusiness } from '../lib/tenant';
import { raceWithTimeout } from './offlineWrite';
import { normalizePhone } from './whatsapp';

export async function createCustomer(data, businessId) {
  if (!businessId) throw new Error('createCustomer() called with no businessId');
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Customer name is required.');

  const phone = data.phone ? normalizePhone(data.phone) : '';
  const customerCode = `CUS-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

  // Generate reference synchronously so the ID is immediately available offline
  const customerRef = doc(tenantCollection('customers'));
  const customerId = customerRef.id;

  const customerPayload = withBusiness({
    name,
    phone: phone || '',
    customerCode,
    email: data.email || '',
    address: data.address || '',
    notes: data.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  }, businessId);

  const write = setDoc(customerRef, customerPayload);
  const { queuedOffline, error } = await raceWithTimeout(write, 1500);
  if (error) throw error;

  return {
    id: customerId,
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
  const updates = { ...data };
  delete updates.businessId;
  delete updates.id;

  if (updates.phone) {
    updates.phone = normalizePhone(updates.phone);
  }

  updates.updatedAt = new Date();

  const write = updateDoc(customerRef, updates);
  const { queuedOffline, error } = await raceWithTimeout(write, 1500);
  if (error) throw error;

  return { queuedOffline };
}