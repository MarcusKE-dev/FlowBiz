// src/utils/adminService.js
//
// Every admin screen talks to the Cloudflare Worker through this file and
// nowhere else. It is deliberately a thin transport layer: it attaches the
// caller's Firebase ID token and parses the response, and it makes NO
// authorisation decision of its own.
//
// That distinction matters. Nothing here — and nothing in the admin UI —
// is a security control. The `permissions` map the Worker returns only
// decides which buttons get rendered; the Worker re-derives the same
// answer from the systemAdmins register on every single request, so
// editing this file in a browser devtools console changes what the page
// looks like and nothing else.
import { auth } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

// ── Version skew ──────────────────────────────────────────────────────
//
// The admin console and the Cloudflare Worker deploy separately, so there
// is always a window where the browser is newer than the API. Seven
// endpoints below exist only in the newer Worker; against an older one
// they return a bare 404 "Not found.", which told the operator nothing
// about what was actually wrong.
//
// Worse, the overview endpoint does not 404 — it answers with the OLD
// response shape, and a page that destructured it crashed into the error
// boundary with "Something went wrong". A client that white-screens
// whenever it is ahead of its server is a defect in the client, not just a
// deployment step, so every call that needs the newer Worker now says so
// in words the person reading it can act on.
export class ApiOutdatedError extends Error {
  constructor(what) {
    super(
      `${what} needs a newer version of the FlowBiz API worker than the one deployed at ` +
      `${FLOWBIZ_API_URL}. Deploy it with "npm --prefix cloudflare-worker run deploy", then reload this page.`
    );
    this.name = 'ApiOutdatedError';
    this.apiOutdated = true;
  }
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Throws a version-skew error for a 404 on an endpoint the new Worker adds. */
function assertEndpointExists(res, what) {
  if (res.status === 404) throw new ApiOutdatedError(what);
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

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
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/overview`, { headers });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load platform overview.');
  // An older Worker answers 200 with the previous flat shape
  // ({ totalBusinesses, proBusinesses, … }) and no `businesses` object.
  // Detect that here rather than letting the page destructure undefined.
  if (!data.businesses || !data.businesses.counts) {
    throw new ApiOutdatedError('The platform overview');
  }
  return data;
}

export async function fetchAdminBusinesses({
  search = '', plan = 'all', status = 'all', account = 'all',
  sort = 'newest', page = 1, pageSize = 25,
} = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses${buildQuery({ search, plan, status, account, sort, page, pageSize })}`, { headers });
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

// Industry profile and capability overrides. Presentation and behaviour
// only — the endpoint behind this cannot reach a plan, an entitlement or
// any operational record, and it refuses any profile or capability that
// is not on the Worker's own list. See routes/admin/adminIndustry.js.
export async function updateBusinessIndustry(businessId, { industryProfile, capabilityOverrides, resetOverrides, reason } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/industry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ industryProfile, capabilityOverrides, resetOverrides, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update the business type.');
  return data.industry;
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

/**
 * `restoreStaff` asks the Worker to switch every account the suspension
 * took back on, even the ones it cannot prove it took — the repair path
 * for a workspace whose status was already flipped back to active while
 * its staff stayed locked out. See the Worker's handler for exactly which
 * accounts that sweep will and will not touch.
 */
export async function toggleBusinessStatus(businessId, status, reason, { restoreStaff = false } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${businessId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status, reason, restoreStaff }),
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

export async function fetchAdminAuditLogs({ limit = 50, cursor = null, businessId = '', action = '' } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/audit-logs${buildQuery({ limit, cursor, businessId, action })}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load audit logs.');
  return data;
}

export async function fetchSystemAdmins() {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/admins`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load system admins.');
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

// ═══════════════════════════════════════════════════════════════════════
// Business Inspector
// ═══════════════════════════════════════════════════════════════════════

/**
 * One page of one section of one business.
 *
 * `cursor` is opaque and comes from the previous response. It replaces
 * offset paging deliberately: Firestore charges for the documents an
 * offset skips, so page 20 of a sales log used to cost 500 reads to show
 * 25 rows.
 */
export async function fetchInspectorSection(businessId, {
  section,
  limit = 25,
  cursor = null,
  search = '',
  from = null,
  to = null,
} = {}) {
  const headers = await getAdminAuthHeaders();
  const qs = buildQuery({ section, limit, cursor, search, from, to });
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${encodeURIComponent(businessId)}/inspect${qs}`, { headers });
  assertEndpointExists(res, 'Business inspection');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Failed to load ${section}.`);
  return data;
}

/** The full document behind one row — including fields the list omits. */
export async function fetchInspectorRecord(businessId, { section, id }) {
  const headers = await getAdminAuthHeaders();
  const qs = buildQuery({ section, id });
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${encodeURIComponent(businessId)}/record${qs}`, { headers });
  assertEndpointExists(res, 'Opening a single record');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load record.');
  return data.record;
}

/** Counts, storage and sync signals for one business. */
export async function fetchBusinessUsage(businessId) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/businesses/${encodeURIComponent(businessId)}/usage`, { headers });
  assertEndpointExists(res, 'Business usage');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load usage.');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// Platform operations
// ═══════════════════════════════════════════════════════════════════════

export async function fetchCloudUsage({ sample = 12, offset = 0 } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/cloud-usage${buildQuery({ sample, offset })}`, { headers });
  assertEndpointExists(res, 'Cloud usage');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load cloud usage.');
  return data;
}

export async function fetchSystemHealth() {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/system-health`, { headers });
  assertEndpointExists(res, 'System health');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load system health.');
  return data;
}

export async function fetchPaymentHealth() {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/payments/health`, { headers });
  assertEndpointExists(res, 'Payment health');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load payment health.');
  return data;
}

export async function fetchOpsEvents({ limit = 40, severity = '', cursor = null } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/ops-events${buildQuery({ limit, severity, cursor })}`, { headers });
  assertEndpointExists(res, 'The operational event log');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load operational events.');
  return data;
}

// ── Security / login activity ─────────────────────────────────────────
//
// The console's read of the platform's authentication log. Every call is
// re-authorised by the Worker on `security.read`, and every ACTION on
// `security.act`; what comes back includes the Worker's own answer about
// which of those this administrator holds, so the page renders what it
// can actually do rather than offering a button that will be refused.

export async function fetchSecurityOverview({ scan = 300 } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/security${buildQuery({ scan })}`, { headers });
  assertEndpointExists(res, 'The security activity log');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load security activity.');
  return data;
}

export async function fetchSecurityEvents({ outcome = 'all', reason = 'all', businessId = '', search = '', limit = 100 } = {}) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(
    `${FLOWBIZ_API_URL}/api/admin/security/events${buildQuery({ outcome, reason, businessId, search, limit })}`,
    { headers }
  );
  assertEndpointExists(res, 'The security activity log');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'Failed to load login activity.');
  return data;
}

/**
 * One of: disableUser, enableUser, revokeSessions, resolveEvent.
 * Nothing here decides whether it is allowed — the Worker does, on every
 * call, from the systemAdmins register.
 */
export async function performSecurityAction({ action, uid, eventId, resolved, reason }) {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(`${FLOWBIZ_API_URL}/api/admin/security/actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, uid, eventId, resolved, reason }),
  });
  assertEndpointExists(res, 'Security actions');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || 'That security action could not be completed.');
  return data;
}
