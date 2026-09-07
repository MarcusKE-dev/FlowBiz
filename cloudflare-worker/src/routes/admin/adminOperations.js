// cloudflare-worker/src/routes/admin/adminOperations.js
//
// Operational monitoring: payment/webhook health, the operational event
// log, and the System Health roll-up that sits on top of both.
//
//   GET /api/admin/payments/health
//   GET /api/admin/ops-events
//   GET /api/admin/system-health
//
// ── The rule this file is written against ─────────────────────────────
// A monitoring page that shows a green tick for something it did not
// actually check is worse than no monitoring page, because it is
// believed. So every indicator here reports one of four states and says
// which check produced it:
//
//   ok       a real check ran and passed
//   warn     a real check ran and something needs a look
//   down     a real check ran and failed
//   unknown  FlowBiz cannot observe this from here — said out loud,
//            never dressed up as ok
//
// Nothing polls. Nothing streams. Every indicator is computed when an
// administrator opens the page, and every one carries the timestamp it
// was computed at, so the UI can say "checked 14:32", never "live".

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, can } from '../../lib/adminAuth.js';
import { safeCount, queryPage, listAllDocuments } from '../../lib/firestore.js';
import { intParam, enumParam } from '../../lib/validate.js';
import { cached } from '../../lib/usageCache.js';

const HEALTH_TTL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// A payment that Paystack never confirmed is normal for a few minutes
// (the customer is still on the checkout page) and abnormal after a day.
const STUCK_PAYMENT_AGE_MS = DAY_MS;

function since(days) {
  return new Date(Date.now() - days * DAY_MS);
}

// ═══════════════════════════════════════════════════════════════════════
// Payment / webhook health
// ═══════════════════════════════════════════════════════════════════════
//
// Read-only, over the `payments` documents the Paystack routes already
// write. This file does not touch initialisation, HMAC verification,
// re-verification against Paystack, amount checking or idempotency — it
// reports on their results. Paystack's own dashboard remains the
// authority on settled money; nothing here is a reconciliation.

export async function computePaymentHealth(env) {
  const checkedAt = new Date().toISOString();

  const [success, pending, failed] = await Promise.all([
    safeCount(env, 'payments', [{ field: 'status', value: 'success' }], 20000),
    safeCount(env, 'payments', [{ field: 'status', value: 'pending' }], 20000),
    safeCount(env, 'payments', [{ field: 'status', value: 'failed' }], 20000),
  ]);

  // Pending payments, newest first. A pending record older than a day
  // means a customer started a checkout that never completed — either
  // they abandoned it (common and harmless) or a webhook never arrived
  // (rare and worth investigating). We report the count and let a human
  // decide; we do NOT auto-resolve anything.
  let stuck = [];
  let pendingSample = [];
  try {
    const page = await queryPage(env, 'payments', {
      filters: [{ field: 'status', value: 'pending' }],
      orderBy: 'createdAt',
      orderDirection: 'DESCENDING',
      limit: 50,
      select: ['businessId', 'plan', 'amountKes', 'status', 'createdAt', 'initializedBy'],
    });
    pendingSample = page.documents;
    const cutoff = Date.now() - STUCK_PAYMENT_AGE_MS;
    stuck = page.documents.filter((p) => {
      const ms = p.createdAt ? Date.parse(p.createdAt) : NaN;
      return Number.isFinite(ms) && ms < cutoff;
    });
  } catch (err) {
    console.warn('[paymentHealth] pending scan failed:', err.message);
  }

  let recent = [];
  try {
    const page = await queryPage(env, 'payments', {
      orderBy: 'createdAt',
      orderDirection: 'DESCENDING',
      limit: 15,
      select: ['businessId', 'plan', 'amountKes', 'status', 'createdAt', 'confirmedAt', 'paystackTransactionId'],
    });
    recent = page.documents;
  } catch (err) {
    console.warn('[paymentHealth] recent scan failed:', err.message);
  }

  // Webhook problems as actually recorded by the webhook route.
  const webhookEvents = await recentOpsEvents(env, { typePrefix: 'webhook.', limit: 20 });

  const successValue = success.value ?? 0;
  const failedValue = failed.value ?? 0;
  const settled = successValue + failedValue;

  return {
    checkedAt,
    counts: {
      success: success.value,
      pending: pending.value,
      failed: failed.value,
    },
    successRate: settled > 0
      ? { value: Math.round((successValue / settled) * 1000) / 10, source: 'derived', available: true,
          note: 'Share of FlowBiz payment records that reached "success", out of those that reached a final state. Not a Paystack-reconciled figure.' }
      : { value: null, source: 'derived', available: false },
    stuckPendingCount: stuck.length,
    stuckPending: stuck.slice(0, 10),
    pendingSample: pendingSample.slice(0, 10),
    recent,
    webhookEvents,
    note: 'Read from FlowBiz payment records only. Paystack’s dashboard remains authoritative for settlement; no figure here is a provider reconciliation.',
  };
}

export async function handleAdminPaymentHealth(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'payments.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { value, computedAt, fromCache } = await cached('ops:payments', HEALTH_TTL_MS, () => computePaymentHealth(env));
  return json({ ...value, computedAt: new Date(computedAt).toISOString(), fromCache });
}

// ═══════════════════════════════════════════════════════════════════════
// Operational event log
// ═══════════════════════════════════════════════════════════════════════

async function recentOpsEvents(env, { typePrefix = null, severity = null, businessId = null, limit = 25 } = {}) {
  try {
    const filters = [];
    if (severity) filters.push({ field: 'severity', value: severity });
    if (businessId) filters.push({ field: 'businessId', value: businessId });

    const page = await queryPage(env, 'opsEvents', {
      filters,
      orderBy: 'createdAt',
      orderDirection: 'DESCENDING',
      // A prefix filter has no Firestore equivalent, so we over-fetch a
      // little and filter here. The bound keeps that honest.
      limit: typePrefix ? Math.min(100, limit * 4) : limit,
    });

    const rows = typePrefix
      ? page.documents.filter((e) => String(e.type || '').startsWith(typePrefix))
      : page.documents;

    return rows.slice(0, limit);
  } catch (err) {
    console.warn('[opsEvents] read failed:', err.message);
    return [];
  }
}

export async function handleAdminOpsEvents(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'ops.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const limit = intParam(url, 'limit', { fallback: 40, min: 5, max: 100 });
  const severity = enumParam(url, 'severity', ['info', 'warning', 'error'], null);
  const cursor = url.searchParams.get('cursor') || null;

  try {
    const filters = [];
    if (severity) filters.push({ field: 'severity', value: severity });

    const page = await queryPage(env, 'opsEvents', {
      filters,
      orderBy: 'createdAt',
      orderDirection: 'DESCENDING',
      limit,
      cursor,
    });

    return json({
      events: page.documents,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      note: 'Meaningful failures and security events only. Never page views, reads or ordinary requests.',
    });
  } catch (err) {
    console.error('[opsEvents] listing failed:', err.message);
    return json({ events: [], nextCursor: null, hasMore: false, error: 'The operational event log could not be read.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// System health
// ═══════════════════════════════════════════════════════════════════════

function indicator(id, label, status, detail, extra = {}) {
  return { id, label, status, detail, checkedAt: new Date().toISOString(), ...extra };
}

async function computeSystemHealth(env, admin) {
  const indicators = [];

  // ── Cloudflare Worker ──
  // This code is running, which is the check. Nothing more is claimed.
  indicators.push(indicator(
    'worker', 'Cloudflare Worker', 'ok',
    'The API worker served this request.',
    { measure: 'This request', link: null }
  ));

  // ── Authentication ──
  // The caller's Firebase ID token was cryptographically verified against
  // Google's published keys to get this far. That is a real end-to-end
  // check of the auth path this console depends on. It says nothing about
  // merchant sign-ins, and does not pretend to.
  indicators.push(indicator(
    'auth', 'Administrator authentication', 'ok',
    `Verified this request’s Firebase ID token against Google’s public keys (signed in as ${admin.email}).`,
    { measure: 'Live token verification', scope: 'Admin sign-in path only. Merchant sign-in failures are not observable from the Worker.' }
  ));

  // ── Firestore ──
  // A real round trip, timed. If it fails, the console says down and the
  // rest of the page degrades rather than lying.
  const firestoreStart = Date.now();
  const businessCount = await safeCount(env, 'businesses', []);
  const firestoreMs = Date.now() - firestoreStart;
  indicators.push(
    businessCount.value === null
      ? indicator('firestore', 'Firestore', 'down',
          'A test aggregation query against the businesses collection failed.',
          { latencyMs: firestoreMs })
      : indicator('firestore', 'Firestore', firestoreMs > 2500 ? 'warn' : 'ok',
          `Aggregation round trip completed in ${firestoreMs}ms (${businessCount.value} businesses).`,
          { latencyMs: firestoreMs, link: '/admin/cloud-usage' })
  );

  // ── Payments / webhooks ──
  let paymentIndicator;
  try {
    const payments = await computePaymentHealth(env);
    const webhookFailures = payments.webhookEvents.length;
    const stuck = payments.stuckPendingCount;
    const status = webhookFailures > 0 ? 'warn' : stuck > 0 ? 'warn' : 'ok';
    paymentIndicator = indicator('payments', 'Payments & webhooks', status,
      webhookFailures > 0
        ? `${webhookFailures} recorded webhook problem${webhookFailures === 1 ? '' : 's'} in the operational log.`
        : stuck > 0
          ? `${stuck} payment${stuck === 1 ? '' : 's'} still pending after 24 hours (usually an abandoned checkout).`
          : 'No recorded webhook failures and no long-pending payments.',
      { link: '/admin/system-health', counts: payments.counts });
  } catch (err) {
    paymentIndicator = indicator('payments', 'Payments & webhooks', 'unknown',
      `Payment records could not be read: ${err.message}`);
  }
  indicators.push(paymentIndicator);

  // ── Synchronisation ──
  // FlowBiz is offline-first: a quiet device is a NORMAL state, not a
  // fault. So this reports observed device liveness and refuses to call
  // it a sync failure. There is no sync-error feed to surface, because
  // the client does not record one — saying that plainly is better than
  // inventing a green tick.
  let syncIndicator;
  try {
    const [totalSessions, liveSessions] = await Promise.all([
      safeCount(env, 'sessions', [], 50000),
      safeCount(env, 'sessions', [
        { field: 'lastActiveAt', op: 'GREATER_THAN_OR_EQUAL', value: since(1) },
      ], 50000),
    ]);
    syncIndicator = liveSessions.value === null
      ? indicator('sync', 'Synchronisation', 'unknown',
          'Device activity could not be measured.')
      : indicator('sync', 'Synchronisation', 'ok',
          `${liveSessions.value} of ${totalSessions.value ?? '-'} registered devices reached Firestore in the last 24 hours.`,
          {
            measure: 'sessions.lastActiveAt heartbeats',
            scope: 'Observation only. FlowBiz is offline-first, so a quiet device may simply be working offline as designed. This is not a sync error feed.',
          });
  } catch (err) {
    syncIndicator = indicator('sync', 'Synchronisation', 'unknown', err.message);
  }
  indicators.push(syncIndicator);

  // ── Storage / images ──
  let storageIndicator;
  try {
    const images = await safeCount(env, 'productImages', [], 100000);
    storageIndicator = images.value === null
      ? indicator('storage', 'Product image storage', 'unknown', 'Image documents could not be counted.')
      : indicator('storage', 'Product image storage', 'ok',
          `${images.value} product photos stored in Firestore (FlowBiz is on the Spark plan, so there is no Cloud Storage bucket).`,
          { link: '/admin/cloud-usage' });
  } catch (err) {
    storageIndicator = indicator('storage', 'Product image storage', 'unknown', err.message);
  }
  indicators.push(storageIndicator);

  // ── Application errors ──
  let errorIndicator;
  try {
    const [errors24h, warnings24h] = await Promise.all([
      safeCount(env, 'opsEvents', [
        { field: 'severity', value: 'error' },
        { field: 'createdAt', op: 'GREATER_THAN_OR_EQUAL', value: since(1) },
      ], 5000),
      safeCount(env, 'opsEvents', [
        { field: 'severity', value: 'warning' },
        { field: 'createdAt', op: 'GREATER_THAN_OR_EQUAL', value: since(1) },
      ], 5000),
    ]);
    const errorCount = errors24h.value ?? 0;
    errorIndicator = indicator('errors', 'Operational errors', errorCount > 0 ? 'warn' : 'ok',
      errorCount > 0
        ? `${errorCount} error-level event${errorCount === 1 ? '' : 's'} recorded in the last 24 hours.`
        : `No error-level events in the last 24 hours (${warnings24h.value ?? 0} warnings).`,
      {
        link: '/admin/system-health',
        scope: 'Server-side events only. FlowBiz ships no client error reporter, so browser-side errors are not collected.',
      });
  } catch (err) {
    errorIndicator = indicator('errors', 'Operational errors', 'unknown', err.message);
  }
  indicators.push(errorIndicator);

  // ── Admin system ──
  let adminIndicator;
  try {
    const { documents } = await listAllDocuments(env, 'systemAdmins', { pageSize: 100, maxDocs: 200 });
    const active = documents.filter((a) => a.active !== false);
    const supers = active.filter((a) => a.role === 'SUPER_ADMIN');
    adminIndicator = indicator('admins', 'Administrator register',
      supers.length === 0 ? 'warn' : 'ok',
      `${active.length} active administrator${active.length === 1 ? '' : 's'}, ${supers.length} with SUPER_ADMIN.`,
      { link: can(admin, 'admins.read') ? '/admin/admins' : null });
  } catch (err) {
    adminIndicator = indicator('admins', 'Administrator register', 'unknown', err.message);
  }
  indicators.push(adminIndicator);

  return {
    indicators,
    unobservable: [
      {
        label: 'Firebase / Google Cloud billing',
        reason: 'FlowBiz holds no Cloud Billing API credential. Read actual spend from the Google Cloud console; it is deliberately not estimated here.',
      },
      {
        label: 'Merchant-side sign-in failures',
        reason: 'Authentication happens between the browser and Firebase directly. The Worker never sees a failed merchant sign-in, so it cannot count them.',
      },
      {
        label: 'Client-side application errors',
        reason: 'No browser error reporter is installed in the merchant app. Adding one is a separate decision with its own privacy and cost trade-offs.',
      },
      {
        label: 'Paystack settlement and payouts',
        reason: 'Paystack’s own dashboard is authoritative. FlowBiz records what its webhook confirmed, not what was settled.',
      },
    ],
  };
}

export async function handleAdminSystemHealth(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'ops.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  // Health is computed per request (it is a health check, after all) but
  // memoised briefly so a refresh-happy admin does not re-run every probe.
  // Keyed by uid, not role: the authentication indicator names the signed-in
  // administrator, and two admins sharing a role must not see each other's
  // address in a cached message.
  const { value, computedAt, fromCache } = await cached(
    `ops:health:${admin.uid}`,
    HEALTH_TTL_MS,
    () => computeSystemHealth(env, admin)
  );

  return json({
    ...value,
    computedAt: new Date(computedAt).toISOString(),
    fromCache,
    realtime: false,
    note: 'Every indicator is computed when this page is requested. Nothing here is a live stream, and nothing is polled in the background.',
  });
}
