// cloudflare-worker/src/routes/admin/adminCommunications.js
import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction } from '../../lib/adminAuth.js';
import { sendEmail } from '../../lib/resend.js';

function supportEmailShell(bodyHtml, {
  title = 'FlowBiz Support & Customer Success',
  badge = 'Customer Support',
  whatsappNumber = '254741104469',
  whatsappText = 'Hello FlowBiz Support, I need assistance with my store.',
  showWhatsappButton = true,
  whatsappButtonLabel = 'WhatsApp Us',
} = {}) {
  const BRAND_GREEN = '#1a623c';
  const BRAND_SAND = '#faf6ef';
  const WHATSAPP_GREEN = '#25D366';
  const INK_900 = '#15171d';
  const INK_700 = '#363b48';
  const INK_400 = '#767f8f';
  const INK_100 = '#e8eaed';

  const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @media only screen and (max-width: 600px) {
      .outer-table { padding: 4px 0 !important; }
      .main-card { border-radius: 0 !important; border-left: none !important; border-right: none !important; width: 100% !important; max-width: 100% !important; }
      .header-cell { padding: 16px 18px !important; }
      .body-cell { padding: 22px 18px 16px !important; }
      .footer-cell { padding: 18px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND_SAND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer-table" style="background:${BRAND_SAND};padding:24px 8px;">
    <tr><td align="center">
      <table role="presentation" width="100%" class="main-card" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid ${INK_100};">
        
        <!-- Header Banner -->
        <tr><td class="header-cell" style="background:${BRAND_GREEN};padding:20px 26px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="left" style="vertical-align:middle;">
                <span style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.02em;">FlowBiz</span>
                ${badge ? `<span style="color:#c3eed3;font-size:11px;font-weight:600;margin-left:10px;text-transform:uppercase;letter-spacing:0.06em;">${badge}</span>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Main Body -->
        <tr><td class="body-cell" style="padding:30px 26px 20px;">
          <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:${INK_900};line-height:1.35;">
            ${title}
          </h2>
          <div style="font-size:14px;color:${INK_700};line-height:1.65;">
            ${bodyHtml}
          </div>

          ${showWhatsappButton ? `
          <!-- Minimal WhatsApp Action Button -->
          <div style="margin:26px 0 10px;text-align:center;">
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${WHATSAPP_GREEN};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;box-shadow:0 2px 8px rgba(37,211,102,0.25);">
              ${whatsappButtonLabel}
            </a>
          </div>
          ` : ''}
        </td></tr>

        <!-- Support Footer -->
        <tr><td class="footer-cell" style="padding:20px 26px;border-top:1px solid ${INK_100};background:#fafbfc;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${INK_900};">
            Need help or have questions?
          </p>
          <p style="margin:0 0 10px;font-size:12px;color:${INK_400};line-height:1.4;">
            Reply to this email or chat with our team on WhatsApp: 
            <a href="${waUrl}" style="color:${BRAND_GREEN};font-weight:700;text-decoration:none;">+254 741 104 469</a>.
          </p>
          <p style="margin:0;font-size:11px;color:#9aa2b1;">
            FlowBiz Business Manager · Nairobi, Kenya · support@flowbiz.co.ke
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function handleAdminSendEmail(request, env) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'ADMIN') {
    return errorResponse('Only Super Admins or Admins can send platform communications.', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const {
    to,
    subject,
    htmlContent,
    plainText,
    businessId = null,
    title,
    badge = 'Customer Support',
    whatsappNumber = '254741104469',
    whatsappText,
    showWhatsappButton = true,
    whatsappButtonLabel = 'WhatsApp Us',
  } = body;

  if (!to || !subject || !htmlContent) {
    return errorResponse('Recipient (to), subject, and htmlContent are required.', 400);
  }

  const wrappedHtml = supportEmailShell(htmlContent, {
    title: title || subject,
    badge,
    whatsappNumber,
    whatsappText: whatsappText || `Hello FlowBiz Support, I received your email regarding "${subject}" and need help with my store.`,
    showWhatsappButton,
    whatsappButtonLabel,
  });

  try {
    await sendEmail(env, {
      to,
      subject,
      html: wrappedHtml,
      text: plainText || htmlContent.replace(/<[^>]+>/g, ''),
    });
  } catch (err) {
    return errorResponse(`Failed to send communication: ${err.message}`, 502);
  }

  await logAdminAction(env, admin, 'SEND_COMMUNICATION', {
    targetBusinessId: businessId,
    details: { to, subject, title: title || subject },
  });

  return json({ success: true });
}