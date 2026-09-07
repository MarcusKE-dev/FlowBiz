// cloudflare-worker/src/routes/licensingReminders.js
//
// Renewal reminders for the annual cloud services entitlement.
//
// WHAT STOPS THIS BEING SPAM. A business is emailed AT MOST ONCE PER
// STAGE PER SERVICE PERIOD. The stage last sent and the period it was
// sent for are recorded on the business's own licensing document
// (`reminderStageSent` + `reminderPeriodKey`, where the key is the expiry
// date), so re-running the job an hour later, a day later, or twice
// through overlapping cron triggers sends nothing at all. A renewal
// clears both fields, which is what arms the next period's reminders.
//
// Stages come from RENEWAL_REMINDER_DAYS — 30, 14, 7, 3, 1 — plus two
// one-off messages: 'expired' when the paid period ends and the grace
// window opens, and 'suspended' when the grace window closes.
//
// The job is idempotent, bounded, and best-effort per business: one
// merchant with a broken email address must not stop the other 400 from
// being told their services are about to lapse.

import { json, errorResponse } from '../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext } from '../lib/adminAuth.js';
import { listAllDocuments, getDocument, patchDocument } from '../lib/firestore.js';
import { sendEmail } from '../lib/resend.js';
import {
  serviceRenewalReminderEmail,
  serviceExpiredEmail,
  cloudServicesSuspendedEmail,
} from '../lib/emailTemplates.js';
import { recordOpsEvent, EVENT_TYPES, maskEmail } from '../lib/opsEvents.js';
import {
  resolveEntitlements,
  servicePeriodKey,
  reminderStageFor,
  ANNUAL_SERVICE_PRICE_KES,
  SERVICE_STATUS,
} from '../lib/licensing.js';

const MAX_BUSINESSES = 3000;
const MAX_SENDS_PER_RUN = 200;

function formatDay(date) {
  if (!date) return 'unknown';
  return new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Which single message, if any, this business is due right now.
 *
 * Returns null far more often than not — that is the design. A business
 * 200 days from expiry, or one already told about this stage, gets
 * nothing.
 */
export function dueReminder(business, now = Date.now()) {
  const e = resolveEntitlements(business, now);
  if (!e.license.owned) return null;

  const licensing = business?.licensing || {};
  const periodKey = servicePeriodKey(licensing);
  const alreadySent = licensing.reminderPeriodKey === periodKey ? licensing.reminderStageSent : null;

  // Every branch below either assigns a stage or returns.
  let stage;
  if (e.service.status === SERVICE_STATUS.ACTIVE) {
    stage = reminderStageFor(e.service.daysRemaining);
    if (stage === null) return null;
  } else if (e.service.status === SERVICE_STATUS.GRACE) {
    stage = 'expired';
  } else if (e.service.status === SERVICE_STATUS.EXPIRED) {
    stage = 'suspended';
  } else {
    // not_applicable or grandfathered: nothing is running out.
    return null;
  }

  if (alreadySent === String(stage)) return null;

  // A stage only ever moves forward within a period. Numeric stages
  // descend (30 → 14 → 7 → 3 → 1), so a smaller number is later; the two
  // string stages come after all of them. This is what stops a clock
  // adjustment or a backfilled document re-sending the 30-day notice
  // after the 7-day one has gone out.
  const order = (s) => (s === 'suspended' ? -2 : s === 'expired' ? -1 : Number(s));
  if (alreadySent !== null && alreadySent !== undefined && order(String(stage)) > order(alreadySent)) {
    return null;
  }

  return { stage: String(stage), periodKey, entitlements: e };
}

function buildMessage(stage, { shopName, entitlements, renewUrl }) {
  const priceKes = ANNUAL_SERVICE_PRICE_KES;
  const lastCoveredDayLabel = formatDay(entitlements.service.lastCoveredDay);

  if (stage === 'expired') {
    return serviceExpiredEmail({
      shopName, lastCoveredDayLabel, graceDays: entitlements.service.graceDays, priceKes, renewUrl,
    });
  }
  if (stage === 'suspended') {
    return cloudServicesSuspendedEmail({ shopName, priceKes, renewUrl });
  }
  return serviceRenewalReminderEmail({
    shopName,
    daysRemaining: Math.max(0, entitlements.service.daysRemaining ?? 0),
    lastCoveredDayLabel,
    priceKes,
    renewUrl,
  });
}

/**
 * Walks every business, sends what is due, records what it sent.
 *
 * @param {object} env
 * @param {{ dryRun?: boolean, now?: number }} options
 */
export async function runRenewalReminders(env, { dryRun = false, now = Date.now() } = {}) {
  const renewUrl = `${env.APP_BASE_URL || 'https://flowbiz.co.ke'}/pro`;
  const { documents } = await listAllDocuments(env, 'businesses', { pageSize: 300, maxDocs: MAX_BUSINESSES });

  const sent = [];
  const skipped = { notDue: 0, noEmail: 0, failed: 0 };

  for (const business of documents) {
    if (sent.length >= MAX_SENDS_PER_RUN) break;

    const due = dueReminder(business, now);
    if (!due) { skipped.notDue += 1; continue; }

    const ownerUid = business.createdBy || (Array.isArray(business.ownerIds) ? business.ownerIds[0] : null);
    const owner = ownerUid ? await getDocument(env, 'users', ownerUid).catch(() => null) : null;
    const to = owner?.email;
    if (!to) { skipped.noEmail += 1; continue; }

    const settings = await getDocument(env, 'businessSettings', business.id).catch(() => null);
    const shopName = settings?.shopName || business.name || '';

    const message = buildMessage(due.stage, { shopName, entitlements: due.entitlements, renewUrl });

    if (dryRun) {
      sent.push({ businessId: business.id, stage: due.stage, recipient: maskEmail(to), dryRun: true });
      continue;
    }

    try {
      await sendEmail(env, { to, subject: message.subject, html: message.html, text: message.text });
    } catch (err) {
      skipped.failed += 1;
      await recordOpsEvent(env, {
        type: EVENT_TYPES.RENEWAL_REMINDER_FAILED,
        severity: 'warning',
        source: 'licensing',
        message: 'A renewal reminder email could not be delivered.',
        businessId: business.id,
        context: { stage: due.stage, recipient: maskEmail(to) || 'unknown', reason: err.message },
      });
      // Deliberately NOT recorded as sent: the next run tries again.
      continue;
    }

    // Recorded only after a successful send, and merged into the existing
    // map rather than replacing it — `patchDocument` masks on `licensing`,
    // so a partial object here would wipe the service dates.
    await patchDocument(env, 'businesses', business.id, {
      licensing: {
        ...(business.licensing || {}),
        reminderStageSent: due.stage,
        reminderPeriodKey: due.periodKey,
        reminderSentAt: new Date(now),
      },
    });

    await recordOpsEvent(env, {
      type: EVENT_TYPES.RENEWAL_REMINDER_SENT,
      severity: 'info',
      source: 'licensing',
      message: `A ${due.stage} renewal reminder was sent.`,
      businessId: business.id,
      dedupe: false,
      context: { stage: due.stage, recipient: maskEmail(to) || 'unknown' },
    });

    sent.push({ businessId: business.id, stage: due.stage, recipient: maskEmail(to) });
  }

  return { scanned: documents.length, sent, skipped };
}

/**
 * POST /api/admin/licensing/reminders
 *
 * The manual handle on the same job the cron trigger runs. `dryRun: true`
 * reports what WOULD go out without sending or recording anything, which
 * is how an operator checks the job before letting it loose.
 */
export async function handleAdminRunReminders(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'licensing.service');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  let body = {};
  try {
    if (request.headers.get('content-length') !== '0') body = await request.json();
  } catch {
    body = {};
  }
  const dryRun = body?.dryRun === true;

  const result = await runRenewalReminders(env, { dryRun });

  const ctx = requestContext(request);
  await logAdminAction(env, admin, dryRun ? 'PREVIEW_RENEWAL_REMINDERS' : 'RUN_RENEWAL_REMINDERS', {
    details: {
      scanned: result.scanned,
      sentCount: result.sent.length,
      stages: result.sent.map((s) => s.stage),
      skipped: result.skipped,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return json({ success: true, dryRun, ...result });
}
