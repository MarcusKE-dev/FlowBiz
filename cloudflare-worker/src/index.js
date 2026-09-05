// cloudflare-worker/src/index.js
import { corsHeaders, handleOptions } from './lib/cors.js';
import { errorResponse } from './lib/response.js';
import { checkAdminRateLimit } from './lib/adminRateLimiter.js';

import { handleDeleteStaff } from './routes/deleteStaff.js';
import { handlePaystackInitialize } from './routes/paystackInitialize.js';
import { handlePaystackWebhook } from './routes/paystackWebhook.js';
import { handlePublicDocument } from './routes/publicDocument.js';
import { handleProPrice, handlePricing } from './routes/proPrice.js';
import { handleSendVerificationEmail } from './routes/sendVerificationEmail.js';
import { handleSendPasswordReset } from './routes/sendPasswordResetEmail.js';
import { handleDeleteOwnProfile } from './routes/deleteOwnProfile.js';
import { handleLoginEvent } from './routes/authLoginEvent.js';

// Admin Control Center Routes
import { handleAdminVerify } from './routes/admin/adminVerify.js';
import { handleAdminOverview } from './routes/admin/adminOverview.js';
import {
  handleAdminBusinesses,
  handleAdminBusinessDetail,
  handleAdminDeleteBusiness,
  handleAdminToggleBusinessStatus,
  handleAdminSendPasswordReset,
  handleAdminSendVerification,
} from './routes/admin/adminBusinesses.js';
import { handleAdminBusinessData } from './routes/admin/adminBusinessData.js';
import { handleAdminInspect, handleAdminInspectRecord } from './routes/admin/adminInspector.js';
import { handleAdminBusinessUsage } from './routes/admin/adminBusinessUsage.js';
import { handleAdminCloudUsage } from './routes/admin/adminCloudUsage.js';
import {
  handleAdminSystemHealth,
  handleAdminPaymentHealth,
  handleAdminOpsEvents,
} from './routes/admin/adminOperations.js';
import { handleAdminSubscriptionUpdate, handleAdminSupportToken } from './routes/admin/adminSubscription.js';
import { handleAdminIndustryUpdate } from './routes/admin/adminIndustry.js';
import { handleAdminAuditLogs } from './routes/admin/adminAuditLogs.js';
import { handleAdminListAdmins, handleAdminAddAdmin, handleAdminRemoveAdmin } from './routes/admin/adminSystemAdmins.js';
import { handleAdminSendEmail } from './routes/admin/adminCommunications.js';
import {
  handleAdminSecurityOverview,
  handleAdminSecurityEvents,
  handleAdminSecurityAction,
} from './routes/admin/adminSecurity.js';

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── Paystack Webhook (Server-to-Server) ───────────────────────────
    if (url.pathname === '/api/paystack/webhook' && request.method === 'POST') {
      try {
        return await handlePaystackWebhook(request, env);
      } catch (err) {
        console.error('Webhook error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    // ── Public Receipts / Invoices (/r/<token>) ───────────────────────
    if (url.pathname.startsWith('/r/') && request.method === 'GET') {
      const token = url.pathname.slice('/r/'.length);
      try {
        return await handlePublicDocument(request, env, token);
      } catch (err) {
        console.error('Public document error:', err);
        return errorResponse('Internal server error.', 500);
      }
    }

    const allowedOrigins = getAllowedOrigins(env);
    if (request.method === 'OPTIONS') return handleOptions(request, allowedOrigins);

    const origin = request.headers.get('Origin') || '';
    const extraHeaders = corsHeaders(origin, allowedOrigins);

    // ── Edge Rate Limiting for Admin Routes ───────────────────────────
    if (url.pathname.startsWith('/api/admin/')) {
      const rateCheck = checkAdminRateLimit(request);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ error: `Too many administrative requests. Retry after ${rateCheck.retryAfter}s.` }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(rateCheck.retryAfter),
              ...extraHeaders,
            },
          }
        );
      }
    }

    // /api/admin/businesses/<businessId>[/<action>] — and nothing deeper.
    // Anything with extra path segments is refused rather than guessed at.
    const businessRoute = (() => {
      const prefix = '/api/admin/businesses/';
      if (!url.pathname.startsWith(prefix)) return null;
      const rest = url.pathname.slice(prefix.length);
      if (!rest) return null;
      const parts = rest.split('/');
      if (parts.length > 2) return null;
      let businessId;
      try {
        businessId = decodeURIComponent(parts[0]);
      } catch {
        // A malformed percent-escape is not a business id.
        return null;
      }
      return { businessId, action: parts[1] || null };
    })();

    let response;
    try {
      // ── Admin Control Center Endpoints ──────────────────────────────
      if ((url.pathname === '/api/admin/auth/me' && request.method === 'GET') ||
          (url.pathname === '/api/admin/auth/verify' && request.method === 'POST')) {
        response = await handleAdminVerify(request, env);
      } else if (url.pathname === '/api/admin/overview' && request.method === 'GET') {
        response = await handleAdminOverview(request, env);
      } else if (url.pathname === '/api/admin/businesses' && request.method === 'GET') {
        response = await handleAdminBusinesses(request, env, url);
      } else if (url.pathname === '/api/admin/cloud-usage' && request.method === 'GET') {
        response = await handleAdminCloudUsage(request, env, url);
      } else if (url.pathname === '/api/admin/system-health' && request.method === 'GET') {
        response = await handleAdminSystemHealth(request, env);
      } else if (url.pathname === '/api/admin/payments/health' && request.method === 'GET') {
        response = await handleAdminPaymentHealth(request, env);
      } else if (url.pathname === '/api/admin/ops-events' && request.method === 'GET') {
        response = await handleAdminOpsEvents(request, env, url);

      // ── Per-business admin routes ────────────────────────────────────
      // `businessId` is extracted ONCE here and every handler validates it
      // again with assertBusinessId() before it can reach a Firestore path.
      // The action is decided by the fixed trailing segment, never by
      // anything the caller can put in a body or a query string.
      } else if (businessRoute) {
        const { businessId, action } = businessRoute;
        const method = request.method;

        if (action === 'data' && method === 'GET') {
          response = await handleAdminBusinessData(request, env, businessId, url);
        } else if (action === 'inspect' && method === 'GET') {
          response = await handleAdminInspect(request, env, businessId, url);
        } else if (action === 'record' && method === 'GET') {
          response = await handleAdminInspectRecord(request, env, businessId, url);
        } else if (action === 'usage' && method === 'GET') {
          response = await handleAdminBusinessUsage(request, env, businessId);
        } else if (action === 'subscription' && method === 'POST') {
          response = await handleAdminSubscriptionUpdate(request, env, businessId);
        } else if (action === 'industry' && method === 'POST') {
          response = await handleAdminIndustryUpdate(request, env, businessId);
        } else if (action === 'support-token' && method === 'POST') {
          response = await handleAdminSupportToken(request, env, businessId);
        } else if (action === 'status' && method === 'POST') {
          response = await handleAdminToggleBusinessStatus(request, env, businessId);
        } else if (action === 'send-password-reset' && method === 'POST') {
          response = await handleAdminSendPasswordReset(request, env, businessId);
        } else if (action === 'send-verification' && method === 'POST') {
          response = await handleAdminSendVerification(request, env, businessId);
        } else if (action === null && method === 'DELETE') {
          response = await handleAdminDeleteBusiness(request, env, businessId);
        } else if (action === null && method === 'GET') {
          response = await handleAdminBusinessDetail(request, env, businessId);
        } else {
          response = errorResponse('Not found.', 404);
        }
      } else if (url.pathname === '/api/admin/security' && request.method === 'GET') {
        response = await handleAdminSecurityOverview(request, env, url);
      } else if (url.pathname === '/api/admin/security/events' && request.method === 'GET') {
        response = await handleAdminSecurityEvents(request, env, url);
      } else if (url.pathname === '/api/admin/security/actions' && request.method === 'POST') {
        response = await handleAdminSecurityAction(request, env);
      } else if (url.pathname === '/api/admin/audit-logs' && request.method === 'GET') {
        response = await handleAdminAuditLogs(request, env, url);
      } else if (url.pathname === '/api/admin/admins' && request.method === 'GET') {
        response = await handleAdminListAdmins(request, env);
      } else if (url.pathname === '/api/admin/admins' && request.method === 'POST') {
        response = await handleAdminAddAdmin(request, env);
      } else if (url.pathname.startsWith('/api/admin/admins/') && request.method === 'DELETE') {
        const targetUid = url.pathname.split('/')[4];
        response = await handleAdminRemoveAdmin(request, env, targetUid);
      } else if (url.pathname === '/api/admin/communications/send' && request.method === 'POST') {
        response = await handleAdminSendEmail(request, env);

      // ── Customer App Privileged Routes ─────────────────────────────
      } else if (url.pathname === '/api/auth/delete-staff' && request.method === 'POST') {
        response = await handleDeleteStaff(request, env);
      } else if (url.pathname === '/api/auth/send-verification-email' && request.method === 'POST') {
        response = await handleSendVerificationEmail(request, env);
      } else if (url.pathname === '/api/auth/send-password-reset' && request.method === 'POST') {
        response = await handleSendPasswordReset(request, env);
      } else if (url.pathname === '/api/paystack/initialize' && request.method === 'POST') {
        response = await handlePaystackInitialize(request, env);
      } else if (url.pathname === '/api/pro/price' && request.method === 'GET') {
        response = await handleProPrice();
      } else if (url.pathname === '/api/pricing' && request.method === 'GET') {
        response = await handlePricing();
      } else if (url.pathname === '/api/auth/login-event' && request.method === 'POST') {
        response = await handleLoginEvent(request, env);
      } else if (url.pathname === '/api/auth/delete-own-profile' && request.method === 'POST') {
        response = await handleDeleteOwnProfile(request, env);
      } else {
        response = errorResponse('Not found.', 404);
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = errorResponse('Internal server error.', 500);
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};