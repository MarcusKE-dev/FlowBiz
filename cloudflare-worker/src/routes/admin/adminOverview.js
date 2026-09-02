import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth } from '../../lib/adminAuth.js';
import { listDocuments, queryCollection } from '../../lib/firestore.js';

export async function handleAdminOverview(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { documents: allBusinesses } = await listDocuments(env, 'businesses', { pageSize: 300 });

  let proCount = 0;
  let lifetimeCount = 0;
  let freeCount = 0;
  let activeCount = 0;

  const now = Date.now();
  const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
  let newBusinessesThisMonth = 0;

  const recentBusinesses = [];

  for (const b of allBusinesses) {
    const rawPlan = b.subscription?.plan;
    const status = b.subscription?.status || 'active';
    const expiresAt = b.subscription?.expiresAt ? new Date(b.subscription.expiresAt).getTime() : null;
    const isProActive = rawPlan === 'pro' && status === 'active' && (!expiresAt || expiresAt > now);
    const isLifetime = rawPlan === 'lifetime' && status === 'active';
    const effectivePlan = isLifetime ? 'lifetime' : isProActive ? 'pro' : 'free';

    if (isLifetime) lifetimeCount++;
    else if (isProActive) proCount++;
    else freeCount++;

    if (status === 'active') activeCount++;

    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdMs >= thirtyDaysAgoMs) newBusinessesThisMonth++;

    recentBusinesses.push({
      id: b.id,
      name: b.name || 'Unnamed Shop',
      plan: effectivePlan,
      status,
      createdAt: b.createdAt || null,
      createdBy: b.createdBy || null,
    });
  }

  recentBusinesses.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  let recentAuditLogs = [];
  try {
    recentAuditLogs = await queryCollection(env, 'adminAuditLogs', {
      orderBy: 'timestamp',
      orderDirection: 'DESCENDING',
      limit: 10,
    });
  } catch (err) {
    console.warn('[AdminOverview] Could not fetch audit logs:', err.message);
  }

  // Application-measured revenue rollup from our own `payments` records —
  // NOT provider-billed data (Paystack's own dashboard is authoritative for
  // that). Only successful, confirmed payments count.
  let lifetimeRevenueKes = 0;
  let proRevenueKes = 0;
  try {
    const successfulPayments = await queryCollection(env, 'payments', {
      filters: [{ field: 'status', value: 'success' }],
      limit: 500,
    });
    for (const p of successfulPayments) {
      if (p.plan === 'lifetime') lifetimeRevenueKes += Number(p.amountKes) || 0;
      else if (p.plan === 'pro') proRevenueKes += Number(p.amountKes) || 0;
    }
  } catch (err) {
    console.warn('[AdminOverview] Could not compute revenue rollup:', err.message);
  }

  return json({
    totalBusinesses: allBusinesses.length,
    activeBusinesses: activeCount,
    proBusinesses: proCount,
    lifetimeBusinesses: lifetimeCount,
    freeBusinesses: freeCount,
    newBusinessesThisMonth,
    recentBusinesses: recentBusinesses.slice(0, 5),
    recentAuditLogs,
    adminRole: admin.role,
    revenue: {
      lifetimeRevenueKes,
      proRevenueKes,
      note: 'Application-measured from confirmed FlowBiz payment records, not Paystack-reconciled billing totals.',
    },
  });
}