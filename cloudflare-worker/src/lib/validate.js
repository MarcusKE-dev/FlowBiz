// cloudflare-worker/src/lib/validate.js
//
// Input validation for the admin API. Every value that reaches this file
// arrived from a browser, and a browser is not trusted — not its URL, not
// its query string, not its JSON body.
//
// The single most important function here is assertBusinessId(). Firestore
// document ids are interpolated into REST URL PATHS, so an id containing a
// slash or a `..` segment is a path-traversal primitive against the
// Firestore API itself: `businesses/../../users/<someone>` would resolve
// to a document that has nothing to do with the business the admin asked
// for. Firestore's own id rules already forbid `/`, `.` and `..`, so
// rejecting anything outside [A-Za-z0-9_-] costs us nothing real and
// closes the hole completely. Every admin route that takes a businessId
// from the URL runs this FIRST, before any Firestore call.

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/** Throws unless `value` is a safe Firestore document id. */
export function assertDocumentId(value, label = 'id') {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ValidationError(`Invalid ${label}.`);
  }
  return value;
}

export function assertBusinessId(value) {
  return assertDocumentId(value, 'business id');
}

/** Bounded integer from a query string. Never trusts the caller's range. */
export function intParam(url, name, { fallback, min, max }) {
  const raw = url.searchParams.get(name);
  const parsed = raw === null || raw === '' ? NaN : Number.parseInt(raw, 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, value));
}

/** A query-string value restricted to a known set. */
export function enumParam(url, name, allowed, fallback) {
  const raw = url.searchParams.get(name);
  return allowed.includes(raw) ? raw : fallback;
}

/** A search term, length-capped so it cannot be used to build huge scans. */
export function searchParam(url, name = 'search', maxLength = 120) {
  return (url.searchParams.get(name) || '').toString().slice(0, maxLength).toLowerCase().trim();
}

/**
 * An ISO date bound from the query string. Returns null for absent or
 * unparseable input rather than throwing — a bad date should narrow
 * nothing, not fail the whole request.
 */
export function dateParam(url, name) {
  const raw = url.searchParams.get(name);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}
