import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth } from '../../lib/adminAuth.js';
import { queryCollection } from '../../lib/firestore.js';

export async function handleAdminAuditLogs(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = parseInt(url.searchParams.get('offset') || '0', 10) || null;
  const businessId = url.searchParams.get('businessId');
  const action = url.searchParams.get('action');

  const filters = [];
  if (businessId) filters.push({ field: 'targetBusinessId', value: businessId });
  if (action) filters.push({ field: 'action', value: action });

  const logs = await queryCollection(env, 'adminAuditLogs', {
    filters,
    orderBy: 'timestamp',
    orderDirection: 'DESCENDING',
    limit,
    offset,
  });

  return json({
    logs,
    count: logs.length,
    adminRole: admin.role,
  });
}