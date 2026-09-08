// src/lib/emailTemplates.js
//
// HTML + plain-text bodies for FlowBiz's transactional emails. Kept
// separate from resend.js on purpose: resend.js only knows how to talk
// to the Resend API, this file only knows what FlowBiz's emails say.
// Colors match the app's own Tailwind palette (moss/sand, see
// tailwind.config.js) so the email doesn't look like a different product.

// Support details, duplicated from the app's src/lib/support.js on
// purpose: the Worker is a separate deployment with its own bundle and
// cannot import across that boundary. Change both together.
const SUPPORT_EMAIL = 'support@flowbiz.co.ke';

const BRAND_BLUE = '#1D70F5';
const CANVAS = '#F4F6F9';
const INK_900 = '#0F1522';
const INK_700 = '#4A5468';
const INK_400 = '#7A8598';
const INK_100 = '#E2E6EC';

function shell(bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${BRAND_BLUE};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">FlowBiz</span>
        </td></tr>
        <tr><td style="padding:28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${INK_100};">
          <p style="margin:0 0 4px;font-size:12px;color:${INK_400};">FlowBiz Business Manager for Kenyan SMBs. This is an automated message, please don't reply to it.</p>
          <p style="margin:0;font-size:12px;color:${INK_400};">Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_BLUE};text-decoration:none;">${SUPPORT_EMAIL}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_BLUE};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:20px 0;">${label}</a>`;
}

// The HTML body shows the button ONLY — the raw URL used to be printed
// underneath it and was removed deliberately (commit "Remove the url
// link"), because a visible action URL reads like phishing to a customer.
//
// The plain-text part of every auth email below still carries the bare
// link, and that is what covers a mail client which strips styled
// anchors. Keep it that way: if the text part ever loses the link, a
// text-only client leaves the person with nothing to click at all.

export function verificationEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Welcome to FlowBiz</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">Please verify your email address to activate your FlowBiz account.</p>
    ${button(link, 'Verify my email')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};line-height:1.6;">This link can only be used once. If you didn't create a FlowBiz account, you can safely ignore this email.</p>
  `);

  const text = `Welcome to FlowBiz

Please verify your email address to activate your FlowBiz account:

${link}

This link can only be used once.

If you didn't create a FlowBiz account, you can safely ignore this email.

Need help? ${SUPPORT_EMAIL}`;

  return { subject: 'Verify your FlowBiz account', html, text };
}

export function passwordResetEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Reset your FlowBiz password</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">We received a request to reset the password for your FlowBiz account.</p>
    ${button(link, 'Reset password')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};line-height:1.6;">This link can only be used once. If you didn't request this, you can safely ignore this email &mdash; your password will not be changed.</p>
  `);

  const text = `Reset your FlowBiz password

We received a request to reset the password for your FlowBiz account. Open this link to choose a new one:

${link}

This link can only be used once.

If you didn't request this, you can safely ignore this email — your password will not be changed.

Need help? ${SUPPORT_EMAIL}`;

  return { subject: 'Reset your FlowBiz password', html, text };
}
// ── Annual cloud services renewal ─────────────────────────────────────
//
// THE ONE THING THESE EMAILS MUST NEVER GET WRONG. A renewal reminder
// that reads like a licence expiry notice would tell a customer their
// software is about to stop working, which is false and is the exact
// confusion the whole commercial model exists to avoid. Every message
// below therefore leads with the licence being permanent and only then
// mentions the services that are running out.

function renewalShell({ heading, lead, shopName, expiryLabel, priceLabel, renewUrl, closing }) {
  return shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">${heading}</h1>
    <p style="margin:0 0 12px;font-size:14px;color:${INK_700};line-height:1.6;">Hello${shopName ? ` ${shopName}` : ''},</p>
    <p style="margin:0 0 12px;font-size:14px;color:${INK_700};line-height:1.6;">${lead}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${INK_100};border-radius:8px;margin:16px 0;">
      <tr><td style="padding:14px 16px;border-bottom:1px solid ${INK_100};">
        <p style="margin:0;font-size:12px;color:${INK_400};text-transform:uppercase;letter-spacing:0.04em;">Your FlowBiz Lifetime Licence</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${INK_900};">Active. It does not expire, and this notice does not change that.</p>
      </td></tr>
      <tr><td style="padding:14px 16px;border-bottom:1px solid ${INK_100};">
        <p style="margin:0;font-size:12px;color:${INK_400};text-transform:uppercase;letter-spacing:0.04em;">Cloud services, maintenance, updates and support</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${INK_900};">${expiryLabel}</p>
      </td></tr>
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:12px;color:${INK_400};text-transform:uppercase;letter-spacing:0.04em;">Renewal</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:${INK_900};">${priceLabel}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;color:${INK_700};line-height:1.6;">Renewing keeps your cloud services, cloud synchronisation, cloud storage, backups, software maintenance, updates and support running.</p>
    ${button(renewUrl, 'Renew cloud services')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};line-height:1.6;">${closing}</p>
  `);
}

const LICENCE_SAFETY_NOTE =
  'If you choose not to renew, you keep your FlowBiz Lifetime Licence and you keep your business records. '
  + 'Your cloud services, maintenance, updates and support pause until you renew. Nothing is deleted.';

/**
 * A reminder at one of the configured stages before the service period
 * ends. `daysRemaining` is whole days to the expiry instant.
 */
export function serviceRenewalReminderEmail({
  shopName = '', daysRemaining = 0, lastCoveredDayLabel = '', priceKes = 0, renewUrl = '',
} = {}) {
  const dayWord = daysRemaining === 1 ? 'day' : 'days';
  const priceLabel = `KES ${Number(priceKes).toLocaleString('en-KE')} per year`;
  const expiryLabel = `Active until ${lastCoveredDayLabel}, ${daysRemaining} ${dayWord} remaining`;

  const html = renewalShell({
    heading: 'Your FlowBiz cloud services renew soon',
    lead: `Your annual Cloud Services, Maintenance, Updates and Support period ends in ${daysRemaining} ${dayWord}. Your Lifetime Licence is permanent and is not affected.`,
    shopName,
    expiryLabel,
    priceLabel,
    renewUrl,
    closing: LICENCE_SAFETY_NOTE,
  });

  const text = `Your FlowBiz cloud services renew soon

Your annual Cloud Services, Maintenance, Updates and Support period ends in ${daysRemaining} ${dayWord} (last covered day: ${lastCoveredDayLabel}).

Your FlowBiz Lifetime Licence is permanent and is not affected by this notice.

Renewal: ${priceLabel}
Renew here: ${renewUrl}

${LICENCE_SAFETY_NOTE}`;

  return { subject: `Your FlowBiz cloud services end in ${daysRemaining} ${dayWord}`, html, text };
}

/**
 * Sent once when the service period has ended. The customer is inside the
 * grace period at this point, so the message says what still works.
 */
export function serviceExpiredEmail({
  shopName = '', lastCoveredDayLabel = '', graceDays = 0, priceKes = 0, renewUrl = '',
} = {}) {
  const priceLabel = `KES ${Number(priceKes).toLocaleString('en-KE')} per year`;

  const html = renewalShell({
    heading: 'Your FlowBiz cloud services have ended',
    lead: `Your annual Cloud Services, Maintenance, Updates and Support period ended on ${lastCoveredDayLabel}. Your FlowBiz Lifetime Licence remains active and your business records remain yours.`,
    shopName,
    expiryLabel: `Ended ${lastCoveredDayLabel}. Services continue for a ${graceDays}-day grace period while you renew.`,
    priceLabel,
    renewUrl,
    closing: LICENCE_SAFETY_NOTE,
  });

  const text = `Your FlowBiz cloud services have ended

Your annual Cloud Services, Maintenance, Updates and Support period ended on ${lastCoveredDayLabel}.

Your FlowBiz Lifetime Licence remains active. You keep the software and you keep your business records.

Cloud services continue for a ${graceDays}-day grace period while you renew.

Renewal: ${priceLabel}
Renew here: ${renewUrl}

${LICENCE_SAFETY_NOTE}`;

  return { subject: 'Your FlowBiz cloud services have ended', html, text };
}

/**
 * Sent once when the grace period closes and hosted services actually
 * stop. The point of this message is its closing paragraph.
 */
export function cloudServicesSuspendedEmail({ shopName = '', priceKes = 0, renewUrl = '' } = {}) {
  const priceLabel = `KES ${Number(priceKes).toLocaleString('en-KE')} per year`;

  const html = renewalShell({
    heading: 'Your FlowBiz cloud services are paused',
    lead: 'The grace period on your annual Cloud Services, Maintenance, Updates and Support has ended, so those hosted services are now paused.',
    shopName,
    expiryLabel: 'Paused. Renew to switch them back on.',
    priceLabel,
    renewUrl,
    closing: 'Your FlowBiz Lifetime Licence is still active and FlowBiz still runs on your devices. Your products, sales, customers, stock records and product photos have not been deleted and will not be deleted because of this. Renewing restores cloud services immediately.',
  });

  const text = `Your FlowBiz cloud services are paused

The grace period on your annual Cloud Services, Maintenance, Updates and Support has ended, so those hosted services are now paused.

Your FlowBiz Lifetime Licence is still active and FlowBiz still runs on your devices. Your products, sales, customers, stock records and product photos have not been deleted and will not be deleted because of this.

Renewal: ${priceLabel}
Renew here: ${renewUrl}`;

  return { subject: 'Your FlowBiz cloud services are paused', html, text };
}
