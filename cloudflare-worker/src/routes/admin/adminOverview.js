// cloudflare-worker/src/routes/admin/adminOverview.js
//
// GET /api/admin/overview
//
// The one screen an administrator should be able to look at and know
// whether FlowBiz is healthy. Four bands: businesses, usage, operations,
// security — deliberately not thirty cards.
//
// Cost: the directory is one paged listing (shared, cached), platform
// usage is eleven aggregation queries (shared with the cloud-usage page
// through the same cache key, so opening both costs one set), payment
// health is three aggregations plus two small paged reads, and the
// security band is two capped reads. Nothing subscribes, nothing polls,
// and the whole page is memoised for a minute.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, can } from '../../lib/adminAuth.js';
import { listAllDocuments, queryPage, safeCount } from '../../lib/firestore.js';
import { cached } from '../../lib/usageCache.js';
import { platformTotals } from './adminCloudUsage.js';
import { computePaymentHealth } from './adminOperations.js';

const OVERVIEW_TTL_MS = 60 * 1000;
const PLATFORM_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function effectivePlanOf(business, now) {
  const rawPlan = business.subscription?.plan;
  const subStatus = business.subscription?.status || 'active';
  const expiresAt = business.subscription?.expiresAt ? Date.parse(business.subscription.expiresAt) : null;
  const isLifetime = rawPlan === 'lifetime' && subStatus === 'active';
  const isPro = rawPlan === 'pro' && subStatus === 'active' && (!expiresAt || expiresAt > now);
  return isLifetime ? 'lifetime' : isPro ? 'pro' : 'free';
}

/** Businesses created per day over the trailing window, for the chart. */
function signupSeries(businesses, days) {
  const buckets = new Map();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(start.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(day, 0);
  }
  for (const b of businesses) {
    if (!b.createdAt) continue;
    const day = new Date(Date.parse(b.createdAt)).toISOString().slice(0, 10);
    if (buckets.has(day)) buckets.set(day, buckets.get(day) + 1);
  }
  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

async function businessBand(env) {
  const now = Date.now();
  const { documents, truncated } = await listAllDocuments(env, 'businesses', { pageSize: 300, maxDocs: 3000 });

  const counts = { total: documents.length, active: 0, suspended: 0, lifetime: 0, pro: 0, free: 0, new7: 0, new30: 0 };
  const recent = [];

  for (const b of documents) {
    const plan = effectivePlanOf(b, now);
    counts[plan]++;

    // `status` is the platform's own suspension flag; `subscription.status`
    // is the billing state. They are different things and are not merged.
    if (b.status === 'suspended') counts.suspended++;
    else counts.active++;

    const createdMs = b.createdAt ? Date.parse(b.createdAt) : NaN;
    if (Number.isFinite(createdMs)) {
      if (createdMs >= now - 7 * DAY_MS) counts.new7++;
      if (createdMs >= now - 30 * DAY_MS) counts.new30++;
    }

    recent.push({
      id: b.id,
      name: b.name || 'Unnamed business',
      plan,
      status: b.status || 'active',
      subscriptionStatus: b.subscription?.status || 'active',
      createdAt: b.createdAt || null,
    });
  }

  recent.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

  return {
    counts,
    truncated,
    recent: recent.slice(0, 6),
    signups30: signupSeries(recent, 30),
  };
}

async function securityBand(env) {
  let recentAdminEvents = [];
  let sensitiveCount;

  try {
    const page = await queryPage(env, 'adminAuditLogs', {
      orderBy: 'timestamp',
      orderDirection: 'DESCENDING',
      limit: 12,
      select: ['adminEmail', 'adminName', 'adminRole', 'action', 'targetBusinessId', 'targetResource', 'timestamp'],
    });
    recentAdminEvents = page.documents;
  } catch (err) {
    console.warn('[overview] audit read failed:', err.message);
  }

  // "Sensitive" here means the actions that change a merchant's account
  // rather than merely look at it.
  try {
    const cutoff = new Date(Date.now() - 7 * DAY_MS);
    const results = await Promise.all([
      safeCount(env, 'adminAuditLogs', [
        { field: 'action', value: 'TOGGLE_BUSINESS_STATUS' },
        { field: 'timestamp', op: 'GREATER_THAN_OR_EQUAL', value: cutoff },
      ], 2000),
      safeCount(env, 'adminAuditLogs', [
        { field: 'action', value: 'UPDATE_SUBSCRIPTION' },
        { field: 'timestamp', op: 'GREATER_THAN_OR_EQUAL', value: cutoff },
      ], 2000),
    ]);
    const values = results.map((r) => r.value).filter((v) => typeof v === 'number');
    sensitiveCount = values.length ? values.reduce((a, b) => a + b, 0) : null;
  } catch {
    sensitiveCount = null;
  }

  return { recentAdminEvents, sensitiveActions7d: sensitiveCount };
}

export async function handleAdminOverview(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const showPayments = can(admin, 'payments.read');
  const showAudit = can(admin, 'audit.read');

  const businesses = await cached('overview:businesses', OVERVIEW_TTL_MS, () => businessBand(env));
  const usage = await cached('cloud:totals', PLATFORM_TTL_MS, () => platformTotals(env));

  let payments = null;
  if (showPayments) {
    try {
      const result = await cached('ops:payments', OVERVIEW_TTL_MS, () => computePaymentHealth(env));
      const p = result.value;
      payments = {
        counts: p.counts,
        successRate: p.successRate,
        stuckPendingCount: p.stuckPendingCount,
        webhookProblems: p.webhookEvents.length,
        recent: p.recent.slice(0, 5),
        computedAt: new Date(result.computedAt).toISOString(),
        note: p.note,
      };
    } catch (err) {
      console.warn('[overview] payment band failed:', err.message);
    }
  }

  let errors;
  try {
    const result = await cached('overview:errors', OVERVIEW_TTL_MS, async () => {
      const page = await queryPage(env, 'opsEvents', {
        orderBy: 'createdAt',
        orderDirection: 'DESCENDING',
        limit: 8,
      });
      const day = await safeCount(env, 'opsEvents', [
        { field: 'createdAt', op: 'GREATER_THAN_OR_EQUAL', value: new Date(Date.now() - DAY_MS) },
      ], 5000);
      return { recent: page.documents, last24h: day.value };
    });
    errors = result.value;
  } catch (err) {
    console.warn('[overview] ops events failed:', err.message);
    errors = { recent: [], last24h: null };
  }

  const security = showAudit
    ? (await cached('overview:security', OVERVIEW_TTL_MS, () => securityBand(env))).value
    : null;

  return json({
    admin: { uid: admin.uid, email: admin.email, name: admin.name, role: admin.role },
    businesses: businesses.value,
    usage: usage.value,
    payments,
    errors,
    security,
    computedAt: new Date(businesses.computedAt).toISOString(),
    realtime: false,
    note: 'Computed when this page was requested and cached briefly. Nothing on this page is a live subscription, and no figure is a provider bill.',
  });
}
