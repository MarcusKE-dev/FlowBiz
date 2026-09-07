import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission } from '../../lib/adminAuth.js';
import { queryPage } from '../../lib/firestore.js';
import { intParam, assertDocumentId } from '../../lib/validate.js';

/** Firestore reports a missing OR still-building index as FAILED_PRECONDITION. */
function isMissingIndex(err) {
  return /FAILED_PRECONDITION|requires an index|no matching index|index.*not ready/i
    .test(err?.message || '');
}

// GET /api/admin/audit-logs
//
// The audit trail is a SECURITY record: it says which administrator
// looked at, or changed, which merchant. Any admin could read it before,
// which meant a support account could see (and shop for) the actions of
// the people who supervise it. It is now ADMIN+ only.
//
// Pagination is cursor-based. Firestore bills `offset` as if the skipped
// documents were read, so page 20 of the audit trail used to cost 1,000
// reads to show 50 rows; a cursor costs 50.
export async function handleAdminAuditLogs(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'audit.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const limit = intParam(url, 'limit', { fallback: 50, min: 10, max: 100 });
  const cursor = url.searchParams.get('cursor') || null;
  const rawBusinessId = url.searchParams.get('businessId');
  const action = url.searchParams.get('action');

  const filters = [];
  if (rawBusinessId) {
    try {
      filters.push({ field: 'targetBusinessId', value: assertDocumentId(rawBusinessId, 'business id') });
    } catch (err) {
      return errorResponse(err.message, 400);
    }
  }
  if (action) filters.push({ field: 'action', value: String(action).slice(0, 80) });

  // Filtering the trail by business or action, newest first, needs a
  // composite index. Reading it UNFILTERED does not. So a missing or
  // still-building index degrades to id ordering rather than denying an
  // administrator the security record entirely.
  let degradedOrdering = false;

  const read = async (orderBy) => queryPage(env, 'adminAuditLogs', {
    filters,
    orderBy,
    orderDirection: 'DESCENDING',
    limit,
    cursor,
  });

  try {
    let page;
    try {
      page = await read('timestamp');
    } catch (err) {
      if (!isMissingIndex(err)) throw err;
      degradedOrdering = true;
      page = await read(null);
    }

    return json({
      logs: page.documents,
      count: page.documents.length,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      adminRole: admin.role,
      degradedOrdering,
      degradedReason: degradedOrdering
        ? 'Newest-first ordering needs a Firestore index on adminAuditLogs (targetBusinessId/action, timestamp) that is still building. Showing entries in storage order until it finishes.'
        : null,
    });
  } catch (err) {
    console.error('[auditLogs] query failed:', err.message);
    if (isMissingIndex(err)) {
      return errorResponse(
        'The audit trail needs a Firestore composite index that has not finished building: ' +
        'collection "adminAuditLogs", fields targetBusinessId ascending, timestamp descending. ' +
        'Deploy it with "npx firebase deploy --only firestore:indexes", then wait for the build to finish.',
        503
      );
    }
    return errorResponse('The audit trail could not be read.', 502);
  }
}
