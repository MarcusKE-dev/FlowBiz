import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction } from '../../lib/adminAuth.js';
import { getDocument, patchDocument } from '../../lib/firestore.js';

export async function handleAdminSubscriptionUpdate(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
    return errorResponse('Only Super Admins or Admins can modify platform subscriptions.', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const { plan, status, durationDays = 30, reason = 'Administrative grant' } = body;
  if (!['pro', 'free'].includes(plan)) return errorResponse('Plan must be "pro" or "free".', 400);
  if (!['active', 'expired', 'cancelled'].includes(status)) return errorResponse('Invalid status.', 400);

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const now = new Date();
  let expiresAt = null;

  if (plan === 'pro') {
    const currentExpiry = business.subscription?.expiresAt ? new Date(business.subscription.expiresAt) : null;
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    expiresAt = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

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

  await logAdminAction(env, admin, 'UPDATE_SUBSCRIPTION', {
    targetBusinessId: businessId,
    details: { plan, status, expiresAt: expiresAt?.toISOString(), reason },
  });

  return json({
    success: true,
    subscription: updatedSubscription,
  });
}

export async function handleAdminSupportToken(request, env, businessId) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};

  await logAdminAction(env, admin, 'ENTER_SUPPORT_MODE', {
    targetBusinessId: businessId,
    details: { shopName: business.name },
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
      expiresInMinutes: 60,
    },
  });
}