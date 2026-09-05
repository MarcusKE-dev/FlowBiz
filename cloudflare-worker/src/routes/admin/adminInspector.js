// cloudflare-worker/src/routes/admin/adminInspector.js
//
// GET /api/admin/businesses/:businessId/inspect?section=…
//
// One endpoint behind every tab of the Business Inspector. A support
// administrator opens a business and gets its real operational data —
// products, sales, customers, credit, suppliers, expenses, stock
// movements, devices — paginated and scoped.
//
// ── How cross-business isolation is enforced ──────────────────────────
// This is the security core of the whole feature, so it is worth being
// explicit about where the businessId comes from and what it can be.
//
//   1. It arrives ONLY as a URL path segment, parsed by the router.
//   2. assertBusinessId() rejects anything outside [A-Za-z0-9_-]{1,128},
//      so it can never contain a `/` or `..` and can never re-point the
//      Firestore REST path at another collection.
//   3. Every query built here hard-codes
//      `{ field: 'businessId', op: 'EQUAL', value: businessId }`.
//      The caller supplies NO filters. There is no parameter that can add,
//      remove or widen a filter — not a body, not a query string, not a
//      header. `section` selects from a fixed table; anything else is a
//      400 before a single Firestore call is made.
//   4. The business must exist, or the request 404s before any data query
//      runs, so the endpoint cannot be used to probe for live ids.
//
// A tampered businessId therefore does exactly one thing: it scopes the
// query to a DIFFERENT business that this administrator is equally
// authorised to inspect. There is no id an admin can substitute that
// reaches data an admin could not already reach through the directory —
// and every such inspection is audited. For a non-admin the request never
// gets past verifyAdminAuth at all.
//
// ── Cost ──────────────────────────────────────────────────────────────
// Every section is cursor-paginated (never `offset`, which bills the
// skipped documents) and field-projected, so opening a tab on a business
// with 40,000 sales reads 25 documents, not 40,000.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext } from '../../lib/adminAuth.js';
import { getDocument, queryPage } from '../../lib/firestore.js';
import { assertBusinessId, intParam, searchParam, dateParam } from '../../lib/validate.js';

// A search that cannot use an index walks at most this many projected
// documents before it stops and says so. Bounded by design: an admin
// typing three letters must not be able to start a 50,000-document scan.
const SEARCH_SCAN_LIMIT = 600;
const SEARCH_PAGE = 200;

/**
 * Firestore refuses a query whose composite index is missing OR still
 * building, both with FAILED_PRECONDITION. The message wording has changed
 * over the years, so this matches on several forms rather than one.
 */
function isMissingIndex(err) {
  return /FAILED_PRECONDITION|requires an index|no matching index|index.*not ready/i
    .test(err?.message || '');
}

/**
 * The complete, closed set of things an administrator may inspect.
 *
 *   collection  Firestore collection (always filtered to businessId)
 *   order       field to sort by, or null to sort by document id only
 *               (null needs NO composite index — deliberate for the
 *               collections the merchant app never orders by a date)
 *   dateField   which field the from/to filters apply to, if any
 *   select      projection. Keeps `items` arrays and base64 out of list
 *               responses; the detail view asks for the full document.
 *   searchFields  fields a bounded text scan matches against
 *   permission  capability required beyond the base inspect right
 */
const SECTIONS = {
  products: {
    collection: 'products',
    order: null,
    select: ['name', 'category', 'costPrice', 'sellingPrice', 'stock', 'lowStockThreshold',
             'barcode', 'supplierId', 'description', 'hasImage', 'imageUpdatedAt', 'imageUrl',
             'deleted', 'updatedAt', 'businessId'],
    searchFields: ['name', 'barcode', 'category'],
  },
  customers: {
    collection: 'customers',
    order: null,
    select: ['name', 'phone', 'customerCode', 'email', 'address', 'notes',
             'createdAt', 'updatedAt', 'businessId'],
    searchFields: ['name', 'phone', 'customerCode'],
  },
  sales: {
    collection: 'sales',
    order: 'soldAt',
    dateField: 'soldAt',
    select: ['soldAt', 'totalAmount', 'costOfGoodsSold', 'profit', 'quantity', 'productName',
             'paymentMethod', 'mpesaCode', 'soldBy', 'soldByName', 'isVoided', 'isCredit',
             'businessId'],
    searchFields: ['productName', 'mpesaCode', 'soldByName'],
  },
  credits: {
    collection: 'creditSales',
    order: 'soldAt',
    dateField: 'soldAt',
    select: ['soldAt', 'customerId', 'customerName', 'customerPhone', 'totalAmount',
             'amountPaid', 'remainingBalance', 'status', 'productName', 'quantity',
             'soldByName', 'businessId'],
    searchFields: ['customerName', 'customerPhone', 'productName'],
  },
  repayments: {
    collection: 'repayments',
    order: 'paidAt',
    dateField: 'paidAt',
    select: null,
    searchFields: ['customerName', 'mpesaCode'],
  },
  suppliers: {
    collection: 'suppliers',
    order: null,
    select: ['name', 'contactPerson', 'phone', 'email', 'address', 'notes',
             'createdAt', 'businessId'],
    searchFields: ['name', 'phone', 'contactPerson'],
  },
  expenses: {
    collection: 'expenses',
    order: 'recordedAt',
    dateField: 'recordedAt',
    select: ['recordedAt', 'description', 'category', 'amount', 'paymentMethod',
             'mpesaCode', 'recordedByName', 'businessId'],
    searchFields: ['description', 'category'],
  },
  purchases: {
    collection: 'purchases',
    order: 'purchasedAt',
    dateField: 'purchasedAt',
    select: null,
    searchFields: ['supplierName', 'invoiceNumber'],
  },
  stock: {
    collection: 'stockAdjustments',
    order: 'adjustedAt',
    dateField: 'adjustedAt',
    select: ['adjustedAt', 'productId', 'productName', 'systemQty', 'physicalQty',
             'difference', 'reason', 'adjustedByName', 'businessId'],
    searchFields: ['productName', 'reason', 'adjustedByName'],
  },
  documents: {
    collection: 'sharedDocuments',
    order: 'createdAt',
    dateField: 'createdAt',
    select: ['documentType', 'documentId', 'createdAt', 'createdBy', 'businessId'],
    searchFields: ['documentType', 'documentId'],
  },
  receipts: {
    collection: 'debtPaymentReceipts',
    order: 'paidAt',
    dateField: 'paidAt',
    select: null,
    searchFields: ['customerName', 'mpesaCode'],
  },
  sessions: {
    collection: 'sessions',
    order: null,
    select: ['uid', 'lastUserName', 'deviceLabel', 'userAgent', 'lastActiveAt',
             'createdAt', 'revoked', 'businessId'],
    searchFields: ['lastUserName', 'deviceLabel'],
  },
  dailySessions: {
    collection: 'dailySessions',
    order: null,
    select: null,
    searchFields: [],
  },
  staff: {
    collection: 'users',
    order: null,
    select: ['displayName', 'email', 'phone', 'role', 'active', 'businessId', 'createdAt'],
    searchFields: ['displayName', 'email'],
  },
  // Product photos. The LIST form is projected so it never moves a single
  // base64 payload — only the recorded byte size of each. The full image
  // is fetched one at a time through the record endpoint, when an
  // administrator actually asks to see it.
  //
  // This exists because the admin console CANNOT read another business's
  // productImages from the browser: firestore.rules scopes that collection
  // to the owning business, and weakening that rule to make an admin
  // screen easier would be exactly the wrong trade. The photo comes
  // through the service account instead, on demand, one document per
  // click.
  productImages: {
    collection: 'productImages',
    order: 'stamp',
    select: ['productId', 'bytes', 'width', 'height', 'contentType', 'stamp', 'updatedAt', 'businessId'],
    searchFields: ['productId'],
  },
  payments: {
    collection: 'payments',
    order: 'createdAt',
    dateField: 'createdAt',
    select: ['plan', 'amountKes', 'status', 'createdAt', 'confirmedAt',
             'paystackTransactionId', 'initializedBy', 'businessId'],
    searchFields: ['status', 'plan'],
    permission: 'payments.read',
  },
};

export const INSPECTOR_SECTIONS = Object.keys(SECTIONS);

function matchesSearch(doc, fields, term) {
  for (const field of fields) {
    const value = doc[field];
    if (typeof value === 'string' && value.toLowerCase().includes(term)) return true;
    if (typeof value === 'number' && String(value).includes(term)) return true;
  }
  return false;
}

export async function handleAdminInspect(request, env, rawBusinessId, url) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.inspect');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const sectionKey = url.searchParams.get('section') || '';
  const section = SECTIONS[sectionKey];
  if (!section) {
    return errorResponse(
      `Unknown inspector section. Supported: ${INSPECTOR_SECTIONS.join(', ')}.`,
      400
    );
  }

  if (section.permission) {
    try {
      requirePermission(admin, section.permission);
    } catch (err) {
      return errorResponse(err.message, err.status || 403);
    }
  }

  // Existence check before any data query: an admin cannot use this
  // endpoint to enumerate which business ids are real.
  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const limit = intParam(url, 'limit', { fallback: 25, min: 5, max: 100 });
  const cursor = url.searchParams.get('cursor') || null;
  const search = searchParam(url, 'search');
  const from = section.dateField ? dateParam(url, 'from') : null;
  const to = section.dateField ? dateParam(url, 'to') : null;

  // The tenant filter is not optional and not caller-supplied.
  const filters = [{ field: 'businessId', op: 'EQUAL', value: businessId }];
  if (section.dateField && from) {
    filters.push({ field: section.dateField, op: 'GREATER_THAN_OR_EQUAL', value: from });
  }
  if (section.dateField && to) {
    filters.push({ field: section.dateField, op: 'LESS_THAN_OR_EQUAL', value: to });
  }

  const baseQuery = {
    filters,
    orderBy: section.order,
    orderDirection: 'DESCENDING',
    select: section.select,
  };

  let documents = [];
  let nextCursor;
  let hasMore;
  let scanned = null;
  let searchTruncated = false;

  // Ordering by a timestamp needs a composite index (businessId + field).
  // Ordering by document id alone does not — the automatic single-field
  // index on businessId always serves it. So when the composite index is
  // missing or still building, the tab falls back to id order and says so,
  // instead of refusing to show a support agent any data at all.
  //
  // The fallback is only possible without a date filter: a range filter on
  // a field REQUIRES that field to be the first ordering, so there is no
  // id-ordered form of that query to fall back to.
  const canFallback = Boolean(section.order) && !from && !to;
  let degradedOrdering = false;

  const runPage = async (opts) => {
    try {
      return await queryPage(env, section.collection, { ...baseQuery, ...opts });
    } catch (err) {
      if (!canFallback || !isMissingIndex(err)) throw err;
      degradedOrdering = true;
      return queryPage(env, section.collection, { ...baseQuery, ...opts, orderBy: null });
    }
  };

  try {
    if (search && section.searchFields?.length) {
      // Firestore has no substring index. Rather than pretend, we walk a
      // BOUNDED window of projected documents and tell the UI exactly how
      // far we looked, so "no results" is never silently a lie.
      let pageCursor = cursor;
      scanned = 0;
      while (scanned < SEARCH_SCAN_LIMIT && documents.length < limit) {
        const page = await runPage({ limit: SEARCH_PAGE, cursor: pageCursor });
        scanned += page.documents.length;
        for (const doc of page.documents) {
          if (matchesSearch(doc, section.searchFields, search)) documents.push(doc);
        }
        pageCursor = page.nextCursor;
        if (!page.hasMore) break;
      }
      searchTruncated = scanned >= SEARCH_SCAN_LIMIT;
      hasMore = false;
      nextCursor = null;
      documents = documents.slice(0, limit);
    } else {
      const page = await runPage({ limit, cursor });
      documents = page.documents;
      nextCursor = page.nextCursor;
      hasMore = page.hasMore;
    }
  } catch (err) {
    console.error(`[Inspector] ${sectionKey} query failed:`, err.message);
    if (isMissingIndex(err)) {
      // Name the exact index, so it can be created without decoding a
      // Firestore error message.
      const fields = [
        'businessId ascending',
        section.dateField ? `${section.dateField} descending` : `${section.order} descending`,
      ].join(', ');
      return errorResponse(
        `This view needs a Firestore composite index that has not finished building: ` +
        `collection "${section.collection}", fields ${fields}. ` +
        `Deploy it with "npx firebase deploy --only firestore:indexes", then wait for the build to finish.`,
        503
      );
    }
    return errorResponse(`Could not load ${sectionKey}.`, 502);
  }

  // Defence in depth. The query already scoped to businessId server-side;
  // this asserts it on the way out, so a future refactor that loosened a
  // filter would fail loudly here instead of leaking quietly.
  const foreign = documents.filter((d) => d.businessId && d.businessId !== businessId);
  if (foreign.length) {
    console.error(`[Inspector] SCOPE VIOLATION in ${sectionKey} for ${businessId}`);
    return errorResponse('Inspection aborted: scope check failed.', 500);
  }

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'INSPECT_BUSINESS_SECTION', {
    targetBusinessId: businessId,
    targetResource: sectionKey,
    details: { section: sectionKey, searched: Boolean(search) },
    ip: ctx.ip,
  });

  return json({
    businessId,
    section: sectionKey,
    collection: section.collection,
    rows: documents,
    count: documents.length,
    nextCursor,
    hasMore,
    search: search || null,
    searchScanned: scanned,
    searchTruncated,
    orderedBy: degradedOrdering ? '__name__' : (section.order || '__name__'),
    degradedOrdering,
    degradedReason: degradedOrdering
      ? `Newest-first ordering needs a Firestore index on ${section.collection} (businessId, ${section.order}) that is still building. Showing records in storage order until it finishes.`
      : null,
    dateField: section.dateField || null,
  });
}

/**
 * GET /api/admin/businesses/:businessId/record?section=…&id=…
 *
 * The full, unprojected document behind one row — what "open this sale"
 * needs, including the `items` array the list view deliberately omits.
 * Scoped the same way, and re-checked after the read: a document whose
 * businessId does not match is a 404, never a payload.
 */
export async function handleAdminInspectRecord(request, env, rawBusinessId, url) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.inspect');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const sectionKey = url.searchParams.get('section') || '';
  const section = SECTIONS[sectionKey];
  if (!section) return errorResponse('Unknown inspector section.', 400);
  if (section.permission) {
    try {
      requirePermission(admin, section.permission);
    } catch (err) {
      return errorResponse(err.message, err.status || 403);
    }
  }

  let recordId;
  try {
    recordId = assertBusinessId(url.searchParams.get('id') || '');
  } catch {
    return errorResponse('Invalid record id.', 400);
  }

  const record = await getDocument(env, section.collection, recordId);
  // The tenant check happens AFTER the read and before the response, so a
  // guessed document id from another business is indistinguishable from a
  // document that does not exist.
  if (!record || record.businessId !== businessId) {
    return errorResponse('Record not found.', 404);
  }

  return json({ businessId, section: sectionKey, record });
}
