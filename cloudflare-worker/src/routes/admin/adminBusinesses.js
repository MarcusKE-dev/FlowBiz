// cloudflare-worker/src/routes/admin/adminBusinesses.js
//
// The business directory and the account actions that hang off it.
//
// Three things changed here beyond the new usage summary:
//
//   1. AUTHORISATION. Suspending a business (which also deactivates every
//      one of its staff accounts), granting a plan, and triggering an
//      email into the owner's inbox were all reachable by ANY
//      administrator, including a SUPPORT account whose whole purpose is
//      to look and not touch. Each of those now asks the PERMISSIONS
//      table for the capability it needs.
//
//   2. ID VALIDATION. Every businessId is checked before it reaches a
//      Firestore path. See lib/validate.js for why that matters.
//
//   3. PAGINATION. The directory read one 300-document page and called it
//      the platform, so business 301 was invisible and every count was
//      quietly wrong. It now walks the collection to a stated ceiling and
//      says when it hit one.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext, can } from '../../lib/adminAuth.js';
import { listAllDocuments, getDocument, queryCollection, queryPage, deleteDocument, patchDocument } from '../../lib/firestore.js';
import { deleteAuthUser, generateActionLink } from '../../lib/identityToolkit.js';
import { sendEmail } from '../../lib/resend.js';
import { passwordResetEmail, verificationEmail } from '../../lib/emailTemplates.js';
import { assertBusinessId, intParam, searchParam, enumParam } from '../../lib/validate.js';
import { computeBusinessUsage } from './adminBusinessUsage.js';
import { cached, invalidate } from '../../lib/usageCache.js';
import { recordOpsEvent, EVENT_TYPES, maskEmail } from '../../lib/opsEvents.js';

const DIRECTORY_TTL_MS = 60 * 1000;
const DETAIL_TTL_MS = 3 * 60 * 1000;

function effectivePlanOf(business, now) {
  const rawPlan = business.subscription?.plan;
  const subStatus = business.subscription?.status || 'active';
  const expiresAt = business.subscription?.expiresAt ? Date.parse(business.subscription.expiresAt) : null;
  const isLifetime = rawPlan === 'lifetime' && subStatus === 'active';
  const isPro = rawPlan === 'pro' && subStatus === 'active' && (!expiresAt || expiresAt > now);
  return isLifetime ? 'lifetime' : isPro ? 'pro' : 'free';
}

// ── Directory ────────────────────────────────────────────────────────
export async function handleAdminBusinesses(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const search = searchParam(url, 'search');
  const planFilter = enumParam(url, 'plan', ['all', 'free', 'pro', 'lifetime'], 'all');
  const statusFilter = enumParam(url, 'status', ['all', 'active', 'suspended', 'expired', 'cancelled'], 'all');
  const accountFilter = enumParam(url, 'account', ['all', 'active', 'suspended'], 'all');
  const sort = enumParam(url, 'sort', ['newest', 'oldest', 'name'], 'newest');
  const page = intParam(url, 'page', { fallback: 1, min: 1, max: 500 });
  const pageSize = intParam(url, 'pageSize', { fallback: 25, min: 10, max: 100 });

  // The whole directory is small (one document per business) and shared
  // by every filter combination, so it is read once and memoised rather
  // than re-read per filter change.
  const listResult = await cached('directory:businesses', DIRECTORY_TTL_MS, async () => {
    const { documents, truncated } = await listAllDocuments(env, 'businesses', { pageSize: 300, maxDocs: 3000 });
    const now = Date.now();
    return {
      truncated,
      rows: documents.map((b) => ({
        id: b.id,
        name: b.name || 'Unnamed Shop',
        plan: effectivePlanOf(b, now),
        subscriptionStatus: b.subscription?.status || 'active',
        accountStatus: b.status || 'active',
        expiresAt: b.subscription?.expiresAt || null,
        createdAt: b.createdAt || null,
        createdBy: b.createdBy || null,
        ownerIds: b.ownerIds || [],
      })),
    };
  });

  let filtered = listResult.value.rows;
  if (planFilter !== 'all') filtered = filtered.filter((b) => b.plan === planFilter);
  if (statusFilter !== 'all') filtered = filtered.filter((b) => b.subscriptionStatus === statusFilter);
  if (accountFilter !== 'all') filtered = filtered.filter((b) => b.accountStatus === accountFilter);
  if (search) {
    filtered = filtered.filter((b) =>
      b.name.toLowerCase().includes(search) || b.id.toLowerCase().includes(search)
    );
  }

  filtered = [...filtered];
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'oldest') filtered.sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
  else filtered.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  // Owner and shop details, only for the page being shown. Two document
  // reads per visible row, never per business on the platform.
  const enriched = await Promise.all(
    paginated.map(async (b) => {
      const [ownerUser, settings] = await Promise.all([
        b.createdBy ? getDocument(env, 'users', b.createdBy).catch(() => null) : null,
        getDocument(env, 'businessSettings', b.id).catch(() => null),
      ]);
      return {
        ...b,
        // Kept for compatibility with the previous response shape.
        status: b.subscriptionStatus,
        owner: ownerUser ? {
          uid: ownerUser.id,
          name: ownerUser.displayName || 'Owner',
          email: ownerUser.email || '',
          phone: ownerUser.phone || '',
        } : null,
        settings: settings ? {
          shopName: settings.shopName || b.name,
          phone: settings.phone || '',
          email: settings.email || '',
          address: settings.address || '',
        } : null,
      };
    })
  );

  return json({
    businesses: enriched,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    directoryTruncated: listResult.value.truncated,
    computedAt: new Date(listResult.computedAt).toISOString(),
    permissions: {
      canSuspend: can(admin, 'business.status'),
      canDelete: can(admin, 'business.delete'),
      canChangePlan: can(admin, 'business.subscription'),
      canChangeIndustry: can(admin, 'business.industry'),
    },
  });
}

// ── Business overview (the Inspector's first tab) ────────────────────
//
// The old version of this handler pulled 100 documents from each of seven
// collections — up to 700 documents, most of them discarded, and every
// metric silently wrong for any business bigger than 100 of anything. It
// now takes its numbers from Firestore aggregations (exact, and a couple
// of dozen reads) and fetches only the small samples the page actually
// renders.
export async function handleAdminBusinessDetail(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.read');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  const showPayments = can(admin, 'payments.read');

  const [staff, invites] = await Promise.all([
    queryCollection(env, 'users', { filters: [{ field: 'businessId', value: businessId }], limit: 25 }),
    queryCollection(env, 'staffInvites', { filters: [{ field: 'businessId', value: businessId }], limit: 25 }),
  ]);

  let payments = [];
  if (showPayments) {
    try {
      const page = await queryPage(env, 'payments', {
        filters: [{ field: 'businessId', value: businessId }],
        orderBy: 'createdAt',
        orderDirection: 'DESCENDING',
        limit: 10,
        select: ['plan', 'amountKes', 'status', 'createdAt', 'confirmedAt', 'paystackTransactionId', 'businessId'],
      });
      payments = page.documents;
    } catch (err) {
      console.warn('[detail] payments read failed:', err.message);
    }
  }

  const { value: usage, computedAt } = await cached(
    `usage:${businessId}:${showPayments ? 'p' : 'n'}`,
    DETAIL_TTL_MS,
    () => computeBusinessUsage(env, businessId, { includePayments: showPayments })
  );

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'VIEW_BUSINESS', {
    targetBusinessId: businessId,
    details: { shopName: business.name },
    ip: ctx.ip,
  });

  // The `metrics` block preserves the field names the previous console
  // read, so nothing that already consumed this endpoint breaks.
  const metrics = {
    productsCount: usage.counts.products.value,
    totalInventoryCost: usage.inventory.inventoryCost?.value ?? null,
    totalInventoryRetail: usage.inventory.inventoryRetail?.value ?? null,
    lowStockCount: usage.inventory.lowStockCount?.value ?? null,
    outOfStockCount: usage.inventory.outOfStockCount?.value ?? null,
    salesCount: usage.counts.sales.value,
    totalSalesRevenue: usage.money.grossSalesVolume.value,
    totalGrossProfit: usage.money.grossProfit.value,
    creditSalesCount: usage.counts.creditSales.value,
    totalOutstandingDebt: usage.money.outstandingCredit.value,
    customersCount: usage.counts.customers.value,
    expensesCount: usage.counts.expenses.value,
    totalExpensesAmount: usage.money.expenseTotal.value,
    purchasesCount: usage.counts.purchases.value,
    suppliersCount: usage.counts.suppliers.value,
  };

  return json({
    business: {
      ...business,
      effectivePlan: effectivePlanOf(business, Date.now()),
    },
    settings,
    staff,
    invites,
    sessions: usage.sync.devices,
    payments,
    metrics,
    usage,
    usageComputedAt: new Date(computedAt).toISOString(),
    permissions: {
      canSuspend: can(admin, 'business.status'),
      canDelete: can(admin, 'business.delete'),
      canChangePlan: can(admin, 'business.subscription'),
      canChangeIndustry: can(admin, 'business.industry'),
      // The per-account override in the Team table. It runs through the
      // security-actions endpoint, so it is that endpoint's capability
      // that decides — not the suspension one.
      canReactivateAccount: can(admin, 'security.act'),
      canEmailOwner: can(admin, 'business.accountEmail'),
      canSeePayments: showPayments,
      canInspect: can(admin, 'business.inspect'),
    },
  });
}

// ── Complete business purge (SUPER_ADMIN only) ───────────────────────

// EVERY tenant-scoped collection must be listed here. The authority on
// what that set is, is firestore.rules: a collection whose rules read
// `owns(resource.data)` is tenant data and belongs in this list. When a
// new one is added there, add it here in the same change — a purge that
// silently skips a collection leaves a deleted customer's records live in
// the database, which is the one outcome this endpoint exists to prevent.
// (`payments` is the exception that is not in the rules at all: it is
// written by the Worker alone, and carries businessId.)
//
// Exported so test/businessPurge.test.js can hold it against
// firestore.rules and fail the moment the two drift.
export const PURGE_COLLECTIONS = [
  'products', 'productImages', 'productBatches', 'productions', 'sales', 'orders',
  'creditSales', 'customers', 'debtPaymentReceipts',
  'repayments', 'expenses', 'purchases', 'suppliers', 'supplierPayments',
  'stockAdjustments', 'dailySessions', 'sessions', 'staffInvites',
  'sharedDocuments', 'barcodeIndex', 'refunds', 'payments',
];

export async function handleAdminDeleteBusiness(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.delete');
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

  const { confirmationText } = body;
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const expected1 = `DELETE ${business.name || ''}`.trim().toUpperCase();
  const expected2 = `DELETE ${businessId}`.trim().toUpperCase();
  const input = (confirmationText || '').trim().toUpperCase();

  if (input !== expected1 && input !== expected2) {
    return errorResponse(`Confirmation phrase mismatch. Type "${expected1}" to confirm.`, 400);
  }

  const deletedCounts = {};
  for (const collName of PURGE_COLLECTIONS) {
    try {
      let hasMore = true;
      let count = 0;
      while (hasMore) {
        const docs = await queryCollection(env, collName, {
          filters: [{ field: 'businessId', value: businessId }],
          limit: 100,
        });
        if (!docs.length) {
          hasMore = false;
          break;
        }
        for (const d of docs) {
          await deleteDocument(env, collName, d.id);
          count++;
        }
        if (docs.length < 100) hasMore = false;
      }
      deletedCounts[collName] = count;
    } catch (collErr) {
      console.error(`[Purge] Error cleaning ${collName}:`, collErr.message);
      deletedCounts[collName] = 0;
    }
  }

  // Drained in pages, exactly like the collections above: a single
  // capped read would leave the staff beyond the cap with a live sign-in
  // to a business that no longer exists.
  const users = [];
  while (true) {
    const page = await queryCollection(env, 'users', {
      filters: [{ field: 'businessId', value: businessId }],
      limit: 100,
      offset: users.length || null,
    });
    users.push(...page);
    if (page.length < 100) break;
  }

  for (const u of users) {
    try {
      await deleteAuthUser(env, u.id);
    } catch (authErr) {
      console.warn(`[Purge] Auth deletion for ${u.id}:`, authErr.message);
    }
    try {
      await deleteDocument(env, 'users', u.id);
    } catch (docErr) {
      console.warn(`[Purge] User doc deletion for ${u.id}:`, docErr.message);
    }
  }

  await deleteDocument(env, 'businessSettings', businessId);
  await deleteDocument(env, 'productCodeCounters', businessId);
  await deleteDocument(env, 'businesses', businessId);

  invalidate('directory:');
  invalidate(`usage:${businessId}`);
  invalidate('cloud:');
  invalidate('overview:');

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'DELETE_BUSINESS_COMPLETELY', {
    targetBusinessId: businessId,
    details: { shopName: business.name, deletedCounts, staffCount: users.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    success: true,
    deletedBusinessId: businessId,
    deletedCounts,
    staffRemoved: users.length,
  });
}

// ── Suspend / reactivate ─────────────────────────────────────────────
//
// SUSPENSION IS REVERSIBLE, AND THAT IS THE WHOLE DESIGN CONSTRAINT.
// Nothing is deleted: the workspace, its staff and every record stay
// exactly where they are, and the only thing that changes is whether the
// people in it may sign in.
//
// THE BUG THIS REPLACES. Suspending set `active: false` on every staff
// account. Reactivating set the business back to `active` and stopped
// there — nothing ever set those accounts back — so the merchant hit
// "Account deactivated" forever and the only way out was to edit user
// documents by hand. Suspension was a one-way door pretending to be a
// switch.
//
// The fix is to record WHY each account was deactivated, and to reverse
// exactly and only what the suspension itself did:
//
//   suspend    → every account that was ACTIVE is deactivated and stamped
//                `deactivatedByWorkspace: true`. An account an owner had
//                already switched off is left alone and NOT stamped.
//   reactivate → every account carrying that stamp is switched back on
//                and the stamp is cleared.
//
// AND A SECOND ONE-WAY DOOR, CLOSED. Restoring ONLY stamped accounts is
// correct for a suspension this code performed — and useless for one it
// did not. A workspace suspended by an earlier deployment has staff with
// `active: false` and no stamp at all, so a stamp-only reactivation
// restores nothing, leaves the merchant on "Account deactivated", and
// offers no way back through the console. That is the same defect as the
// original, one layer down.
//
// So there is a second, EXPLICIT path: `restoreStaff: true` switches back
// on every account that is inactive and carries no marker of an
// individual decision — no `deactivationReason: 'owner_deactivated'` from
// an owner, no `disabledByPlatform: true` from a security action.
//
// IT IS NOT AUTOMATIC, and that is the point. Once a suspension left no
// stamp, nothing can distinguish "the suspension switched this person
// off" from "the owner switched this person off with a client that
// predates the marker" — the suspension deactivates everyone, so even
// "all accounts are off" is not a signature. An ordinary reactivation
// therefore restores ONLY what it can prove it took, and a human being
// asks for the inference, from a console that tells them it is one. The
// audit entry counts the two paths separately for the same reason.
//
// `deactivationReason` rides along so the merchant's own screen can say
// "this workspace is suspended" rather than "your account was
// deactivated" — a user may always read their own profile document, so
// this is the one place that message can honestly come from.
//
// Sessions are revoked on suspension so the block takes effect on a
// device that is already open, not just at the next sign-in. They are
// deliberately NOT un-revoked: a revoked session is a dead credential,
// and the correct way back in is a fresh sign-in, which mints a new
// session document (see registerSession in AuthContext).

const WORKSPACE_SUSPENSION_REASON = 'workspace_suspended';
const OWNER_DEACTIVATION_REASON = 'owner_deactivated';
const STAFF_PAGE = 300;

/**
 * Should reactivating this workspace switch this account back on?
 *
 * `stamped` is certain: this code switched it off. `legacy` is the
 * evidence case — an inactive account with no marker of an individual
 * decision, in a workspace that was suspended. Anything an owner or a
 * platform security action switched off is left exactly as it is, in
 * both cases.
 */
function restoreDecision(user, { sweepUnstamped }) {
  if (user.active !== false) return 'already-active';
  // A platform security action is not this suspension's doing, and a
  // workspace reactivation must never quietly undo one.
  if (user.disabledByPlatform === true) return 'no';
  if (user.deactivatedByWorkspace === true) return 'stamped';
  // Everything below this line is an INFERENCE, and only runs when an
  // administrator explicitly asked for one.
  if (!sweepUnstamped) return 'no';
  // The marker an individual decision leaves behind. `deactivatedByWorkspace:
  // false` is NOT one of them and must not veto the sweep: an owner switching
  // somebody off writes the flag false AND the reason together (see
  // toggleMemberActive), so the reason alone carries the owner's intent, while
  // the flag on its own is just what a PREVIOUS restore left behind. Vetoing on
  // it stranded exactly the account this path exists to rescue — the console
  // offered "Restore staff access", the sweep refused it, and the merchant
  // stayed locked out with no error to explain why. The console's own
  // stranded-account filter tests these same two markers and nothing else;
  // the two must agree or the button lies.
  if (user.deactivationReason === OWNER_DEACTIVATION_REASON) return 'no';
  return 'legacy';
}

/** Every user document in a business, however many there are. */
async function allStaff(env, businessId) {
  const out = [];
  for (let offset = 0; offset < 5000; offset += STAFF_PAGE) {
    const page = await queryCollection(env, 'users', {
      filters: [{ field: 'businessId', value: businessId }],
      limit: STAFF_PAGE,
      offset: offset || null,
    });
    out.push(...page);
    if (page.length < STAFF_PAGE) break;
  }
  return out;
}

async function revokeStaffSessions(env, businessId) {
  let revoked = 0;
  for (let offset = 0; offset < 5000; offset += STAFF_PAGE) {
    const page = await queryCollection(env, 'sessions', {
      filters: [{ field: 'businessId', value: businessId }],
      limit: STAFF_PAGE,
      offset: offset || null,
    });
    for (const session of page) {
      if (session.revoked === true) continue;
      await patchDocument(env, 'sessions', session.id, {
        revoked: true,
        revokedReason: WORKSPACE_SUSPENSION_REASON,
      });
      revoked += 1;
    }
    if (page.length < STAFF_PAGE) break;
  }
  return revoked;
}

export async function handleAdminToggleBusinessStatus(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    // Suspension deactivates every staff account in the business. That is
    // not an inspection, and a read-only support role must not be able to
    // do it.
    requirePermission(admin, 'business.status');
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

  const { status, reason } = body;
  if (!['active', 'suspended', 'expired'].includes(status)) {
    return errorResponse('Invalid status value.', 400);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  // Read BEFORE the patch below: whether the workspace was suspended is
  // what decides whether an unstamped deactivation is attributable to the
  // suspension.
  const previousStatus = business.status || 'active';

  await patchDocument(env, 'businesses', businessId, {
    status,
    statusReason: typeof reason === 'string' ? reason.slice(0, 300) : null,
    statusUpdatedAt: new Date(),
    statusUpdatedBy: admin.email,
  });

  let staffDeactivated = 0;
  let staffRestored = 0;
  let staffRestoredUnstamped = 0;
  let staffLeftInactive = 0;
  let sessionsRevoked = 0;
  const skipped = [];

  if (status === 'suspended') {
    const staff = await allStaff(env, businessId);
    for (const u of staff) {
      // An account the owner had already switched off is not this
      // suspension's doing, so it is not stamped and will not be switched
      // back on by the reactivation below.
      if (u.active === false) continue;
      await patchDocument(env, 'users', u.id, {
        active: false,
        deactivatedByWorkspace: true,
        deactivationReason: WORKSPACE_SUSPENSION_REASON,
      });
      staffDeactivated += 1;
    }
    sessionsRevoked = await revokeStaffSessions(env, businessId);
  } else if (status === 'active') {
    const sweepUnstamped = body.restoreStaff === true;
    const staff = await allStaff(env, businessId);
    for (const u of staff) {
      const decision = restoreDecision(u, { sweepUnstamped });
      if (decision === 'already-active') continue;
      if (decision === 'no') {
        staffLeftInactive += 1;
        // WHY it was left, not just that it was. An account that stays
        // locked out after an administrator asked for a restore is the
        // failure this whole path exists to prevent, and a bare count
        // gives the console nothing to say about it.
        skipped.push({
          uid: u.id,
          email: u.email || null,
          reason: u.disabledByPlatform === true
            ? 'platform_security'
            : u.deactivationReason === OWNER_DEACTIVATION_REASON
              ? 'owner_deactivated'
              : 'not_attributable',
        });
        continue;
      }
      await patchDocument(env, 'users', u.id, {
        active: true,
        deactivatedByWorkspace: false,
        deactivationReason: null,
      });
      staffRestored += 1;
      if (decision === 'legacy') staffRestoredUnstamped += 1;
    }
  }

  invalidate('directory:');
  invalidate('overview:');

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'TOGGLE_BUSINESS_STATUS', {
    targetBusinessId: businessId,
    details: {
      status,
      reason: reason || null,
      shopName: business.name,
      previousStatus,
      staffDeactivated,
      staffRestored,
      // How many were restored without a stamp — a suspension performed
      // by an earlier deployment. Recorded separately because it is an
      // inference, not a certainty, and an auditor should see which it was.
      staffRestoredUnstamped,
      staffLeftInactive,
      skipped,
      sessionsRevoked,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    success: true,
    status,
    staffDeactivated,
    staffRestored,
    staffRestoredUnstamped,
    staffLeftInactive,
    skipped,
    sessionsRevoked,
  });
}

// ── Owner account emails ─────────────────────────────────────────────
async function sendOwnerActionEmail(request, env, rawBusinessId, kind) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    // Both of these put a link into a merchant's inbox using FlowBiz's
    // identity. That is an account action, not support inspection.
    requirePermission(admin, 'business.accountEmail');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business || !business.createdBy) return errorResponse('Owner account not found.', 404);

  const owner = await getDocument(env, 'users', business.createdBy);
  if (!owner || !owner.email) return errorResponse('Owner email not found.', 404);

  const isReset = kind === 'reset';
  const continueUrl = `${env.APP_BASE_URL}/auth/action?flow=${isReset ? 'resetPassword' : 'verifyEmail'}`;

  try {
    const result = await generateActionLink(env, {
      requestType: isReset ? 'PASSWORD_RESET' : 'VERIFY_EMAIL',
      email: owner.email,
      continueUrl,
    });
    const { subject, html, text } = isReset
      ? passwordResetEmail(result.oobLink)
      : verificationEmail(result.oobLink);
    await sendEmail(env, { to: owner.email, subject, html, text });
  } catch (err) {
    await recordOpsEvent(env, {
      type: EVENT_TYPES.EMAIL_SEND_FAILED,
      severity: 'error',
      source: 'admin',
      message: `Could not send ${isReset ? 'password reset' : 'verification'} email to a business owner.`,
      businessId,
      context: { recipient: maskEmail(owner.email) || 'unknown', reason: err.message },
    });
    return errorResponse(`Could not send email: ${err.message}`, 502);
  }

  const ctx = requestContext(request);
  await logAdminAction(env, admin,
    isReset ? 'ADMIN_TRIGGERED_PASSWORD_RESET' : 'ADMIN_TRIGGERED_VERIFICATION_EMAIL', {
      targetBusinessId: businessId,
      // The audit trail records WHO was emailed in masked form. A support
      // ticket needs to know an email went out, not to be a mailing list.
      details: { recipient: maskEmail(owner.email) },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

  return json({ success: true, email: owner.email });
}

export function handleAdminSendPasswordReset(request, env, businessId) {
  return sendOwnerActionEmail(request, env, businessId, 'reset');
}

export function handleAdminSendVerification(request, env, businessId) {
  return sendOwnerActionEmail(request, env, businessId, 'verify');
}
