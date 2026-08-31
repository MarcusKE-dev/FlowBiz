// cloudflare-worker/src/lib/adminRateLimiter.js
const requestLog = new Map(); // IP -> { count, resetAt }

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;     // Max 30 admin API requests per minute per IP

export function checkAdminRateLimit(request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown-ip';
  const now = Date.now();

  const record = requestLog.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  record.count += 1;
  requestLog.set(ip, record);

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfterSeconds),
    };
  }

  return { allowed: true };
}