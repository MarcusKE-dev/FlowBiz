// src/lib/emailTemplates.js
//
// HTML + plain-text bodies for FlowBiz's transactional emails. Kept
// separate from resend.js on purpose: resend.js only knows how to talk
// to the Resend API, this file only knows what FlowBiz's emails say.
// Colors match the app's own Tailwind palette (moss/sand, see
// tailwind.config.js) so the email doesn't look like a different product.

const BRAND_GREEN = '#1a623c';
const BRAND_SAND = '#faf6ef';
const INK_900 = '#15171d';
const INK_700 = '#363b48';
const INK_400 = '#767f8f';
const INK_100 = '#e8eaed';

function shell(bodyHtml) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${BRAND_SAND};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_SAND};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${BRAND_GREEN};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.02em;">FlowBiz</span>
        </td></tr>
        <tr><td style="padding:28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${INK_100};">
          <p style="margin:0;font-size:12px;color:${INK_400};">FlowBiz Business Manager for Kenyan SMBs. This is an automated message, please don't reply to it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;margin:20px 0;">${label}</a>`;
}

export function verificationEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Welcome to FlowBiz</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">Please verify your email address to activate your FlowBiz account.</p>
    ${button(link, 'Verify my email')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};">If you didn't create a FlowBiz account, you can safely ignore this email.</p>
  `);

  const text = `Welcome to FlowBiz

Please verify your email address to activate your FlowBiz account.

If you didn't create a FlowBiz account, you can safely ignore this email.`;

  return { subject: 'Verify your FlowBiz account', html, text };
}

export function passwordResetEmail(link) {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${INK_900};">Reset your FlowBiz password</h1>
    <p style="margin:0 0 8px;font-size:14px;color:${INK_700};line-height:1.6;">We received a request to reset the password for your FlowBiz account.</p>
    ${button(link, 'Reset password')}
    <p style="margin:16px 0 0;font-size:12px;color:${INK_400};">If you didn't request this, you can safely ignore this email your password will not be changed.</p>
  `);

  const text = `Reset your FlowBiz password

We received a request to reset the password for your FlowBiz account.

If you didn't request this, you can safely ignore this email your password will not be changed.`;

  return { subject: 'Reset your FlowBiz password', html, text };
}