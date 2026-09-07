// cloudflare-worker/src/routes/admin/adminBusinessData.js
//
// GET /api/admin/businesses/:id/data?collection=…
//
// The ORIGINAL business-data endpoint, kept working because things still
// call it. New work should use /inspect (routes/admin/adminInspector.js),
// which is cursor-paginated, field-projected and date-filterable; this one
// is offset-paginated, and Firestore bills an offset as if the skipped
// documents were read.
//
// What changed here: the businessId is validated before it can reach a
// Firestore path, the business must exist, the caller must hold
// `business.inspect`, and the returned rows are re-checked against the
// requested businessId on the way out.
import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext } from '../../lib/adminAuth.js';
import { queryCollection, getDocument } from '../../lib/firestore.js';
import { assertBusinessId, intParam, searchParam } from '../../lib/validate.js';

const ALLOWED_COLLECTIONS = [
  'products',
  'sales',
  'creditSales',
  'customers',
  'debtPaymentReceipts',
  'repayments',
  'expenses',
  'purchases',
  'suppliers',
  'supplierPayments',
  'stockAdjustments',
  'dailySessions',
  'sessions',
  'staffInvites',
  'sharedDocuments',
];

export async function handleAdminBusinessData(request, env, rawBusinessId, url) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.inspect');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const collectionName = url.searchParams.get('collection');
  if (!collectionName || !ALLOWED_COLLECTIONS.includes(collectionName)) {
    return errorResponse(`Invalid or unsupported collection: ${collectionName}`, 400);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const limit = intParam(url, 'limit', { fallback: 50, min: 10, max: 200 });
  const rawOffset = intParam(url, 'offset', { fallback: 0, min: 0, max: 2000 });
  const offset = rawOffset || null;
  const search = searchParam(url, 'search');

  const ORDER_FIELD = {
    sales: 'soldAt',
    creditSales: 'soldAt',
    expenses: 'recordedAt',
    purchases: 'purchasedAt',
    repayments: 'paidAt',
    supplierPayments: 'paidAt',
    debtPaymentReceipts: 'paidAt',
    stockAdjustments: 'adjustedAt',
    sharedDocuments: 'createdAt',
    staffInvites: 'createdAt',
  }[collectionName] || null;

  const data = await queryCollection(env, collectionName, {
    filters: [{ field: 'businessId', value: businessId }],
    orderBy: ORDER_FIELD,
    orderDirection: 'DESCENDING',
    limit,
    offset,
  });

  let filtered = data;
  if (search) {
    filtered = data.filter((item) => {
      const matchName = item.name && String(item.name).toLowerCase().includes(search);
      const matchProduct = item.productName && String(item.productName).toLowerCase().includes(search);
      const matchCustomer = item.customerName && String(item.customerName).toLowerCase().includes(search);
      const matchDesc = item.description && String(item.description).toLowerCase().includes(search);
      const matchCode = (item.barcode && String(item.barcode).includes(search)) || (item.internalCode && String(item.internalCode).toLowerCase().includes(search));
      return matchName || matchProduct || matchCustomer || matchDesc || matchCode;
    });
  }

  // Defence in depth: the query scoped to businessId server-side, and
  // this asserts it again before anything is serialised.
  const foreign = filtered.filter((d) => d.businessId && d.businessId !== businessId);
  if (foreign.length) {
    console.error(`[BusinessData] SCOPE VIOLATION in ${collectionName} for ${businessId}`);
    return errorResponse('Request aborted: scope check failed.', 500);
  }

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'VIEW_BUSINESS_DATA', {
    targetBusinessId: businessId,
    targetResource: collectionName,
    details: { searched: Boolean(search) },
    ip: ctx.ip,
  });

  return json({
    businessId,
    collection: collectionName,
    count: filtered.length,
    data: filtered,
  });
}