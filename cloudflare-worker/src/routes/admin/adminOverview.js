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
  let freeCount = 0;
  let activeCount = 0;

  const now = Date.now();
  const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
  let newBusinessesThisMonth = 0;

  const recentBusinesses = [];

  for (const b of allBusinesses) {
    const plan = b.subscription?.plan === 'pro' ? 'pro' : 'free';
    const status = b.subscription?.status || 'active';
    const expiresAt = b.subscription?.expiresAt ? new Date(b.subscription.expiresAt).getTime() : null;
    const isProActive = plan === 'pro' && status === 'active' && (!expiresAt || expiresAt > now);

    if (isProActive) proCount++;
    else freeCount++;

    if (status === 'active') activeCount++;

    const createdMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdMs >= thirtyDaysAgoMs) newBusinessesThisMonth++;

    recentBusinesses.push({
      id: b.id,
      name: b.name || 'Unnamed Shop',
      plan: isProActive ? 'pro' : 'free',
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

  return json({
    totalBusinesses: allBusinesses.length,
    activeBusinesses: activeCount,
    proBusinesses: proCount,
    freeBusinesses: freeCount,
    newBusinessesThisMonth,
    recentBusinesses: recentBusinesses.slice(0, 5),
    recentAuditLogs,
    adminRole: admin.role,
  });
}