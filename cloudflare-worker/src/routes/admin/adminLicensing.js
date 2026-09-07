// cloudflare-worker/src/routes/admin/adminLicensing.js
//
// Platform control over perpetual licences and annual cloud services.
//
// FIVE ACTIONS, AND THE LINES BETWEEN THEM ARE THE WHOLE POINT:
//
//   suspend-cloud / restore-cloud
//       Switches a business's HOSTED SERVICES off and back on. Reversible.
//       Deletes nothing. Does NOT touch the licence, so a suspended
//       business still owns its software and still runs locally. This is
//       the action an operator reaches for; the two below are not.
//
//   set-service
//       Moves the service expiry date or the grace window. A goodwill
//       extension, a correction after a failed payment, a support
//       concession. Bounded server-side.
//
//   migrate
//       Brings a licence sold before the annual service model existed
//       into it, by GRANTING a fresh service period. It can only ever add
//       time; see migrationPayload.
//
//   revoke-license / reinstate-license
//       Takes away, or gives back, a licence somebody bought outright.
//       SUPER_ADMIN only, never automatic, never reachable from an expiry
//       or a suspension, and it is the only action in FlowBiz that can
//       make `license.owned` false.
//
// Every one of them writes an audit entry carrying who did it, to which
// business, the previous state, the new state, and the stated reason.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext, can } from '../../lib/adminAuth.js';
import { assertBusinessId } from '../../lib/validate.js';
import { invalidate } from '../../lib/usageCache.js';
import { getDocument, patchDocument, queryPage } from '../../lib/firestore.js';
import { recordOpsEvent, EVENT_TYPES } from '../../lib/opsEvents.js';
import {
  resolveEntitlements,
  cloudSuspensionPayload,
  licenseRevocationPayload,
  serviceOverridePayload,
  migrationPayload,
  toDate,
  addMonths,
  GRACE_PERIOD_DAYS,
  ANNUAL_SERVICE_PRICE_KES,
  LIFETIME_LICENSE_PRICE_KES,
  SERVICE_STATUS,
} from '../../lib/licensing.js';

/** How far into the future an administrator may push a service expiry. */
const MAX_OVERRIDE_MONTHS = 60;
const MAX_GRACE_DAYS = 365;

const ACTIONS = {
  'suspend-cloud': 'licensing.cloud',
  'restore-cloud': 'licensing.cloud',
  'set-service': 'licensing.service',
  migrate: 'licensing.service',
  'revoke-license': 'licensing.revoke',
  'reinstate-license': 'licensing.revoke',
};

/**
 * The shape every licensing surface reads — the admin console, the
 * business detail page and the reminder mailer all take their view of a
 * business from here, so none of them can disagree about a date.
 *
 * Dates go out as ISO strings: this crosses JSON, and a Date that
 * round-trips through it silently becomes a string anyway.
 */
export function licensingSummary(business, now = Date.now()) {
  const e = resolveEntitlements(business, now);
  const iso = (d) => (d ? new Date(d).toISOString() : null);

  return {
    license: {
      type: e.license.type,
      status: e.license.status,
      owned: e.license.owned,
      // A perpetual licence has no expiry. Sent explicitly so a console
      // that renders "expires: —" is stating a fact, not a missing field.
      expiresAt: null,
      purchasedAt: iso(e.license.purchasedAt),
      purchaseReference: e.license.purchaseReference,
      purchaseAmountKes: LIFETIME_LICENSE_PRICE_KES,
      revokedAt: iso(e.license.revokedAt),
      revokedReason: e.license.revokedReason,
    },
    service: {
      status: e.service.status,
      entitled: e.service.entitled,
      startDate: iso(e.service.startDate),
      expiryDate: iso(e.service.expiryDate),
      lastCoveredDay: iso(e.service.lastCoveredDay),
      graceDays: e.service.graceDays,
      graceEndsAt: iso(e.service.graceEndsAt),
      inGracePeriod: e.service.inGracePeriod,
      daysRemaining: e.service.daysRemaining,
      daysRemainingInGrace: e.service.daysRemainingInGrace,
      renewalPriceKes: ANNUAL_SERVICE_PRICE_KES,
      lastPaymentAt: iso(e.service.lastPaymentAt),
      lastPaymentReference: e.service.lastPaymentReference,
      renewalCount: e.service.renewalCount,
      needsMigration: e.needsServiceMigration,
    },
    cloud: {
      status: e.cloud.status,
      entitled: e.cloud.entitled,
      suspendedByAdmin: e.cloud.suspendedByAdmin,
      suspendedAt: iso(e.cloud.suspendedAt),
      suspendedBy: e.cloud.suspendedBy,
      suspendedReason: e.cloud.suspendedReason,
      restoredAt: iso(e.cloud.restoredAt),
      restoredBy: e.cloud.restoredBy,
      // Named individually because the console shows them as a list and
      // an operator needs to see exactly what a suspension took away.
      synchronisation: e.can('cloud.sync'),
      storage: e.can('cloud.storage'),
      backups: e.can('cloud.backup'),
      documents: e.can('cloud.documents'),
    },
    maintenance: {
      maintenance: e.can('maintenance'),
      updates: e.can('updates'),
      support: e.can('support'),
    },
    // The promise the model rests on, restated where an operator can see
    // it before they click something.
    localApplicationAvailable: e.localApplicationAvailable,
    proFeatures: e.can('features.pro'),
    plan: e.plan,
    entitlements: e.entitlements,
    renewal: { stage: e.renewal.stage, level: e.renewal.level, priceKes: e.renewal.priceKes },
  };
}

/** GET /api/admin/businesses/:id/licensing */
export async function handleAdminLicensingRead(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'licensing.read');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  // Payment history is a finance surface, exactly as it is on the detail
  // endpoint. A SUPPORT administrator sees the entitlement, not the money.
  let payments = [];
  if (can(admin, 'payments.read')) {
    try {
      const page = await queryPage(env, 'payments', {
        filters: [{ field: 'businessId', value: businessId }],
        orderBy: 'createdAt',
        orderDirection: 'DESCENDING',
        limit: 25,
        select: ['plan', 'kind', 'description', 'amountKes', 'status', 'createdAt', 'confirmedAt',
          'paystackTransactionId', 'businessId', 'applied', 'unappliedReason', 'serviceExpiryAfter'],
      });
      payments = page.documents;
    } catch (err) {
      console.warn('[licensing] payment history read failed:', err.message);
    }
  }

  return json({
    businessId,
    licensing: licensingSummary(business, Date.now()),
    payments,
    permissions: {
      canSuspendCloud: can(admin, 'licensing.cloud'),
      canOverrideService: can(admin, 'licensing.service'),
      canRevokeLicense: can(admin, 'licensing.revoke'),
      canSeePayments: can(admin, 'payments.read'),
    },
  });
}

/** POST /api/admin/businesses/:id/licensing */
export async function handleAdminLicensingAction(request, env, rawBusinessId) {
  let admin;
  let businessId;
  let body;

  try {
    admin = await verifyAdminAuth(request, env);
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  // hasOwnProperty, not a plain lookup. `ACTIONS['__proto__']` returns
  // Object.prototype, which is truthy, so a bare lookup would let a
  // client past this guard with a key that is not an action at all and
  // land on an unhelpful 500 further down instead of a clean refusal.
  const capability = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!capability) {
    return errorResponse(`Unknown licensing action: ${String(action).slice(0, 40)}`, 400);
  }

  try {
    requirePermission(admin, capability);
  } catch (err) {
    return errorResponse(err.message, err.status || 403);
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  // Every action here changes what a paying customer gets. A reason is
  // not paperwork; it is the only thing that makes the audit entry
  // answerable six months later.
  if (!reason) return errorResponse('A reason is required for every licensing action.', 400);

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const now = new Date();
  const before = licensingSummary(business, now);

  let licensing;
  // Assigned by every branch of the switch below, which is exhaustive.
  let opsEvent;
  let auditAction;
  const details = { reason };

  switch (action) {
    case 'suspend-cloud': {
      if (!before.cloud.entitled && before.cloud.suspendedByAdmin) {
        return errorResponse('Cloud services are already suspended for this business.', 400);
      }
      licensing = cloudSuspensionPayload(business, { suspended: true, admin, reason, now });
      auditAction = 'SUSPEND_CLOUD_SERVICES';
      opsEvent = {
        type: EVENT_TYPES.CLOUD_SUSPENDED,
        severity: 'warning',
        message: 'An administrator suspended cloud services for a business. The perpetual licence was not affected.',
      };
      break;
    }

    case 'restore-cloud': {
      licensing = cloudSuspensionPayload(business, { suspended: false, admin, reason, now });
      auditAction = 'RESTORE_CLOUD_SERVICES';
      opsEvent = {
        type: EVENT_TYPES.CLOUD_RESTORED,
        severity: 'info',
        message: 'An administrator restored cloud services for a business.',
      };
      break;
    }

    case 'set-service': {
      const expiry = toDate(body.serviceExpiryDate);
      if (!expiry) return errorResponse('A valid serviceExpiryDate is required.', 400);
      const ceiling = addMonths(now, MAX_OVERRIDE_MONTHS);
      if (expiry.getTime() > ceiling.getTime()) {
        return errorResponse(`A service period may not be extended more than ${MAX_OVERRIDE_MONTHS} months ahead.`, 400);
      }
      const rawGrace = Number.parseInt(body.graceDays, 10);
      const graceDays = Number.isFinite(rawGrace)
        ? Math.min(MAX_GRACE_DAYS, Math.max(0, rawGrace))
        : before.service.graceDays;

      licensing = serviceOverridePayload(business, { expiryDate: expiry, graceDays, admin, reason, now });
      auditAction = 'OVERRIDE_SERVICE_PERIOD';
      details.serviceExpiryDate = expiry.toISOString();
      details.graceDays = graceDays;
      opsEvent = {
        type: EVENT_TYPES.SERVICE_OVERRIDDEN,
        severity: 'info',
        message: 'An administrator adjusted a business\'s annual services period.',
      };
      break;
    }

    case 'migrate': {
      if (before.service.status !== SERVICE_STATUS.GRANDFATHERED) {
        return errorResponse('This business is already on the annual services model.', 400);
      }
      const rawMonths = Number.parseInt(body.months, 10);
      const months = Number.isFinite(rawMonths) ? Math.min(36, Math.max(1, rawMonths)) : 12;
      licensing = migrationPayload(business, { now, months, admin });
      auditAction = 'MIGRATE_LIFETIME_LICENCE';
      details.months = months;
      opsEvent = {
        type: EVENT_TYPES.SERVICE_MIGRATED,
        severity: 'info',
        message: 'A pre-model Lifetime licence was migrated onto the annual services model with a granted service period.',
      };
      break;
    }

    case 'revoke-license': {
      if (!before.license.owned) return errorResponse('This business does not own a licence to revoke.', 400);
      licensing = licenseRevocationPayload(business, { revoked: true, admin, reason, now });
      auditAction = 'REVOKE_LIFETIME_LICENCE';
      opsEvent = {
        type: EVENT_TYPES.LICENSE_REVOKED,
        severity: 'error',
        message: 'An administrator revoked a perpetual FlowBiz licence.',
      };
      break;
    }

    case 'reinstate-license': {
      licensing = licenseRevocationPayload(business, { revoked: false, admin, reason, now });
      auditAction = 'REINSTATE_LIFETIME_LICENCE';
      opsEvent = {
        type: EVENT_TYPES.LICENSE_REINSTATED,
        severity: 'info',
        message: 'An administrator reinstated a previously revoked perpetual FlowBiz licence.',
      };
      break;
    }

    default:
      return errorResponse('Unsupported action.', 400);
  }

  await patchDocument(env, 'businesses', businessId, { licensing });

  invalidate('directory:');
  invalidate('overview:');
  invalidate(`usage:${businessId}`);
  invalidate('cloud:');

  const after = licensingSummary({ ...business, licensing }, now);

  const ctx = requestContext(request);
  await logAdminAction(env, admin, auditAction, {
    targetBusinessId: businessId,
    details: {
      ...details,
      shopName: business.name || null,
      // Previous state and new state, in the two dimensions that matter.
      // An auditor reading this must be able to see that a cloud
      // suspension left the licence exactly where it was.
      previousLicenseStatus: before.license.status,
      newLicenseStatus: after.license.status,
      previousServiceStatus: before.service.status,
      newServiceStatus: after.service.status,
      previousCloudStatus: before.cloud.status,
      newCloudStatus: after.cloud.status,
      previousServiceExpiry: before.service.expiryDate,
      newServiceExpiry: after.service.expiryDate,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (opsEvent) {
    await recordOpsEvent(env, {
      type: opsEvent.type,
      severity: opsEvent.severity,
      source: 'admin',
      message: opsEvent.message,
      businessId,
      dedupe: false,
      context: {
        admin: admin.email,
        licenseStatus: after.license.status,
        serviceStatus: after.service.status,
        cloudStatus: after.cloud.status,
      },
    });
  }

  return json({ success: true, licensing: after, previous: before });
}

export { GRACE_PERIOD_DAYS };
