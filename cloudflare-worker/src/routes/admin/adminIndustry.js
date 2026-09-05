// cloudflare-worker/src/routes/admin/adminIndustry.js
//
// POST /api/admin/businesses/:id/industry
//
// The server-authorised half of section 9 of the industry brief: an
// administrator may look at, change and reset a business's industry
// configuration.
//
// What this endpoint deliberately CANNOT do, and why it is written as a
// two-field patch rather than a general settings writer:
//
//   • It writes only `industryProfile` and `capabilityOverrides`. Nothing
//     else on the settings document, and nothing at all on
//     `businesses/{id}` — so it can never reach `subscription`, and a
//     profile change can never alter a plan, an entitlement or a licence.
//   • It touches no operational collection. Sales, credit, inventory,
//     batches, customers and payments are not read and not written here,
//     so changing a profile cannot delete or rewrite history. Records
//     belonging to a capability that has just been switched off simply
//     stop being displayed; they remain exactly where they were.
//   • It validates the profile against the Worker's own list and the
//     overrides against the Worker's own owner-configurable list, so a
//     forged request body cannot introduce a capability the product moves
//     only with the profile.
//
// Every call is audit-logged with the previous and next profile.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext } from '../../lib/adminAuth.js';
import { assertBusinessId } from '../../lib/validate.js';
import { getDocument, patchDocument } from '../../lib/firestore.js';
import { invalidate } from '../../lib/usageCache.js';
import {
  isKnownIndustryProfile, sanitizeCapabilityOverrides,
  sanitizeTermOverrides, sanitizeIdList,
  DEFAULT_INDUSTRY_PROFILE, INDUSTRY_PROFILE_IDS, OWNER_CONFIGURABLE_CAPABILITIES,
} from '../../lib/industry.js';

export async function handleAdminIndustryUpdate(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.industry');
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

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const settings = (await getDocument(env, 'businessSettings', businessId)) || {};
  const previousProfile = isKnownIndustryProfile(settings.industryProfile)
    ? settings.industryProfile
    : DEFAULT_INDUSTRY_PROFILE;

  const updates = {};

  // ── Profile ────────────────────────────────────────────────────────
  if (body.industryProfile !== undefined) {
    if (!isKnownIndustryProfile(body.industryProfile)) {
      return errorResponse(
        `Unknown industry profile. Expected one of: ${INDUSTRY_PROFILE_IDS.join(', ')}.`,
        400
      );
    }
    updates.industryProfile = body.industryProfile;
  }

  const nextProfile = updates.industryProfile || previousProfile;

  // ── Capability overrides ───────────────────────────────────────────
  //
  // `resetOverrides` and an explicit override map are the same write from
  // Firestore's point of view; they are two request shapes because they
  // are two different administrator intentions, and the audit log should
  // record which one happened.
  let overrideMode = 'unchanged';
  if (body.resetOverrides === true) {
    // Every override an owner can make, cleared together — the same set
    // resetOverridesPayload() clears on the client.
    updates.capabilityOverrides = {};
    updates.unitOverrides = null;
    updates.dashboardOverrides = null;
    updates.termOverrides = {};
    overrideMode = 'reset';
  } else if (body.capabilityOverrides !== undefined) {
    const sanitized = sanitizeCapabilityOverrides(body.capabilityOverrides);
    if (sanitized === null) {
      return errorResponse('capabilityOverrides must be an object of boolean values.', 400);
    }
    updates.capabilityOverrides = sanitized;
    overrideMode = 'set';
  } else if (updates.industryProfile && updates.industryProfile !== previousProfile) {
    // Overrides are expressed against the profile that was in force when
    // they were made. Carrying "tables off" out of a café and into a
    // hardware shop is meaningless, so a profile change clears them —
    // the same rule the client applies, enforced here too.
    updates.capabilityOverrides = {};
    updates.unitOverrides = null;
    updates.dashboardOverrides = null;
    updates.termOverrides = {};
    overrideMode = 'reset-with-profile';
  }

  // The presentation overrides, when an administrator sends them. Each is
  // sanitised against the Worker's OWN bounds, never the client's, and
  // each is optional — an absent key leaves what is stored alone.
  if (body.unitOverrides !== undefined) {
    updates.unitOverrides = sanitizeIdList(body.unitOverrides);
  }
  if (body.dashboardOverrides !== undefined) {
    updates.dashboardOverrides = sanitizeIdList(body.dashboardOverrides);
  }
  if (body.termOverrides !== undefined) {
    const terms = sanitizeTermOverrides(body.termOverrides);
    if (terms === null) {
      return errorResponse('termOverrides must be an object of short text values.', 400);
    }
    updates.termOverrides = terms;
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('Nothing to change. Send industryProfile, capabilityOverrides or resetOverrides.', 400);
  }

  // A business that has never had a settings document still needs one to
  // patch. `businessId` is stamped so the document satisfies the same
  // ownership shape every rule in firestore.rules checks for.
  if (!settings || Object.keys(settings).length === 0) {
    updates.businessId = businessId;
  }

  await patchDocument(env, 'businessSettings', businessId, updates);
  invalidate('directory:');

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'UPDATE_INDUSTRY_PROFILE', {
    targetBusinessId: businessId,
    details: {
      previousProfile,
      profile: nextProfile,
      overrideMode,
      capabilityOverrides: updates.capabilityOverrides || null,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 300) : null,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({
    success: true,
    industry: {
      industryProfile: nextProfile,
      capabilityOverrides:
        updates.capabilityOverrides !== undefined
          ? updates.capabilityOverrides
          : sanitizeCapabilityOverrides(settings.capabilityOverrides) || {},
      previousProfile,
      ownerConfigurableCapabilities: OWNER_CONFIGURABLE_CAPABILITIES,
    },
  });
}
