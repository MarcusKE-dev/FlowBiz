// cloudflare-worker/src/index.js
import { corsHeaders, handleOptions } from './lib/cors.js';
import { errorResponse } from './lib/response.js';
import { checkAdminRateLimit } from './lib/adminRateLimiter.js';

import { handleDeleteStaff } from './routes/deleteStaff.js';
import { handlePaystackInitialize } from './routes/paystackInitialize.js';
import { handlePaystackWebhook } from './routes/paystackWebhook.js';
import { handlePublicDocument } from './routes/publicDocument.js';
import { handleProPrice } from './routes/proPrice.js';
import { handleSendVerificationEmail } from './routes/sendVerificationEmail.js';
import { handleSendPasswordReset } from './routes/sendPasswordResetEmail.js';
import { handleDeleteOwnProfile } from './routes/deleteOwnProfile.js';

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
import { handleAdminSubscriptionUpdate, handleAdminSupportToken } from './routes/admin/adminSubscription.js';
import { handleAdminAuditLogs } from './routes/admin/adminAuditLogs.js';
import { handleAdminListAdmins, handleAdminAddAdmin, handleAdminRemoveAdmin } from './routes/admin/adminSystemAdmins.js';
import { handleAdminSendEmail } from './routes/admin/adminCommunications.js';

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
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/data') && request.method === 'GET') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminBusinessData(request, env, businessId, url);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/subscription') && request.method === 'POST') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminSubscriptionUpdate(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/support-token') && request.method === 'POST') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminSupportToken(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/status') && request.method === 'POST') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminToggleBusinessStatus(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/send-password-reset') && request.method === 'POST') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminSendPasswordReset(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && url.pathname.endsWith('/send-verification') && request.method === 'POST') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminSendVerification(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && request.method === 'DELETE') {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminDeleteBusiness(request, env, businessId);
      } else if (url.pathname.startsWith('/api/admin/businesses/') && request.method === 'GET' && url.pathname.split('/').length === 5) {
        const businessId = url.pathname.split('/')[4];
        response = await handleAdminBusinessDetail(request, env, businessId);
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