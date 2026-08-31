import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, logAdminAction } from '../../lib/adminAuth.js';
import { queryCollection } from '../../lib/firestore.js';

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

export async function handleAdminBusinessData(request, env, businessId, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const collectionName = url.searchParams.get('collection');
  if (!collectionName || !ALLOWED_COLLECTIONS.includes(collectionName)) {
    return errorResponse(`Invalid or unsupported collection: ${collectionName}`, 400);
  }

  const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = parseInt(url.searchParams.get('offset') || '0', 10) || null;
  const search = (url.searchParams.get('search') || '').toLowerCase().trim();

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

  await logAdminAction(env, admin, 'VIEW_BUSINESS_DATA', {
    targetBusinessId: businessId,
    targetResource: collectionName,
    details: { count: filtered.length, search: search || undefined },
  });

  return json({
    businessId,
    collection: collectionName,
    count: filtered.length,
    data: filtered,
  });
}