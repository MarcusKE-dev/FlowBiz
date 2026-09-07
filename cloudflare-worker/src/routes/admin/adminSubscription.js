import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext } from '../../lib/adminAuth.js';
import { assertBusinessId } from '../../lib/validate.js';
import { invalidate } from '../../lib/usageCache.js';
import { getDocument, patchDocument } from '../../lib/firestore.js';
import { resolveEntitlements } from '../../lib/licensing.js';

export async function handleAdminSubscriptionUpdate(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.subscription');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { plan, status, reason = 'Administrative grant' } = body;
  if (!['pro', 'free', 'lifetime'].includes(plan)) return errorResponse('Plan must be "pro", "lifetime" or "free".', 400);
  if (!['active', 'expired', 'cancelled'].includes(status)) return errorResponse('Invalid status.', 400);

  // Bounded server-side. A browser asking for 99,999 days of Pro gets 365.
  const rawDays = Number.parseInt(body.durationDays, 10);
  const durationDays = Math.min(365, Math.max(1, Number.isFinite(rawDays) ? rawDays : 30));

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  // THIS ENDPOINT PREDATES THE LICENSING LAYER and only ever writes
  // `subscription`, which is the monthly plan's record. A business that
  // owns a perpetual licence has that licence recorded in `licensing`,
  // and nothing here can reach it — so granting such a business "free"
  // would leave two records disagreeing in the console while the customer
  // still, correctly, owned their software.
  //
  // Rather than let an administrator create that contradiction by
  // accident, the plan control steps aside for licensed businesses and
  // points at the tools that actually govern them. Revoking a licence is
  // a deliberate, SUPER_ADMIN action on the licensing endpoint; it is not
  // something anybody should be able to do by picking "free" from a
  // dropdown built for monthly subscriptions.
  const entitlements = resolveEntitlements(business, Date.now());
  if (entitlements.license.owned && plan !== 'lifetime') {
    return errorResponse(
      'This business owns a FlowBiz Lifetime Licence. Use the licensing controls to suspend cloud services, '
      + 'adjust the annual services period, or revoke the licence. The monthly plan control cannot change it.',
      409,
    );
  }

  const now = new Date();
  let expiresAt = null;

  if (plan === 'pro') {
    const currentExpiry = business.subscription?.expiresAt ? new Date(business.subscription.expiresAt) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }
  // 'lifetime' never expires — expiresAt stays null, same as 'free'.

  const updatedSubscription = {
    plan,
    status,
    expiresAt,
    updatedAt: now,
    updatedByAdmin: admin.email,
  };

  await patchDocument(env, 'businesses', businessId, {
    subscription: updatedSubscription,
  });

  invalidate('directory:');
  invalidate('overview:');
  invalidate('cloud:');

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'UPDATE_SUBSCRIPTION', {
    targetBusinessId: businessId,
    details: {
      plan,
      status,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      durationDays,
      previousPlan: business.subscription?.plan || 'free',
      reason: typeof reason === 'string' ? reason.slice(0, 300) : null,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    success: true,
    subscription: updatedSubscription,
  });
}

// POST /api/admin/businesses/:id/support-token
//
// NOT a token, despite the route name it has always had: nothing is
// signed and nothing is granted. It records that an administrator entered
// support mode for a business and echoes back what the banner needs to
// display. Every subsequent read still re-verifies the administrator's
// own Firebase ID token, so there is no credential here for anyone to
// steal or replay. The name is kept because the client already calls it.
export async function handleAdminSupportToken(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.inspect');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'ENTER_SUPPORT_MODE', {
    targetBusinessId: businessId,
    details: { shopName: business.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    success: true,
    supportSession: {
      businessId,
      businessName: business.name,
      shopName: settings.shopName || business.name,
      adminUid: admin.uid,
      adminName: admin.name,
      adminEmail: admin.email,
      mode: 'READ_ONLY',
      issuedAt: new Date().toISOString(),
    },
  });
}