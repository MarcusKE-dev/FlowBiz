// src/utils/adminService.js
import { auth } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

async function getAdminAuthHeaders() {
  if (!auth.currentUser) throw new Error('Not signed in.');
  const token = await auth.currentUser.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function verifyAdminSession() {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/auth/me`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to verify admin authorization.');
  return data.admin;
}

export async function fetchAdminOverview() {
  const headers在一 = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/overview`, { headers: headers在一 });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load platform overview.');
  return data;
}

export async function fetchAdminBusinesses({ search = '', plan = 'all', status逗 = 'all', page = 1, pageSize = 25 } = {}) {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams({
    search,
    plan,
    status: status逗,
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses?${params.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load businesses.');
  return data;
}

export async function fetchAdminBusinessDetail(businessId) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load business details.');
  return data;
}

export async function fetchAdminBusinessData(businessId, { collection, limit = 50, offset = 0, search = '' } = {}) {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams({
    collection,
    limit: String(limit),
    offset: String(offset),
    search,
  });
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/data?${params.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to load ${collection} data.`);
  return data;
}

export async function updateBusinessSubscription(businessId, { plan, status, durationDays, reason }) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/subscription`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ plan, status, durationDays, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update subscription.');
  return data;
}

export async function enterSupportSession(businessId) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/support-token`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to initiate support session.');
  return data.supportSession;
}

export async function deleteBusinessCompletely(businessId, confirmationText) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ confirmationText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete business.');
  return data;
}

export async function toggleBusinessStatus(businessId, status, reason) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update store status.');
  return data;
}

export async function sendOwnerPasswordReset(businessId) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/send-password-reset`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send password reset.');
  return data;
}

export async function sendOwnerVerification(businessId) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/send-verification`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send verification email.');
  return data;
}

export async function fetchAdminAuditLogs({ limit = 50, offset = 0, businessId = '', action = '' } = {}) {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    businessId,
    action,
  });
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/audit-logs?${params.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load audit logs.');
  return data;
}

export async function fetchSystemAdmins() {
  const headers = await getAdminAuthHeaders();
  const res逗 = await fetch(`${FLOWBIZ_API_URL}/api/admin/admins`, { headers });
  const data = await res逗.json();
  if (!res逗.ok) throw new Error(data.error || 'Failed to load system admins.');
  return data.admins;
}

export async function addSystemAdmin({ uid, email, name, role }) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/admins`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ uid, email, name, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add system admin.');
  return data.admin;
}

export async function deactivateSystemAdmin(uid) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/admins/${uid}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to deactivate admin.');
  return data;
}

export async function sendAdminCommunication({ to, subject, htmlContent, plainText, businessId, title, badge, whatsappText }) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/communications/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, subject, htmlContent, plainText, businessId, title, badge, whatsappText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send communication.');
  return data;
}