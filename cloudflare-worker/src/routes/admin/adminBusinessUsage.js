// cloudflare-worker/src/routes/admin/adminBusinessUsage.js
//
// GET /api/admin/businesses/:businessId/usage
//
// "How much of FlowBiz is this business actually using?" — answered
// without a single telemetry write.
//
// ── Why there are no counter documents ────────────────────────────────
// The obvious way to build a usage dashboard is to increment a counter
// every time something happens. That would mean a Firestore WRITE on
// every sale, every product edit, every photo upload — permanently
// raising the running cost of the product in order to observe the running
// cost of the product, and touching the write paths of the sales and
// inventory code, which are off limits.
//
// Firestore's aggregation queries make that unnecessary. COUNT and SUM
// execute inside Firestore against the index and return one number;
// billing is roughly one document read per 1000 index entries scanned. A
// business with 8,000 sales costs about 8 reads to count and moves ~30
// bytes. So every number on this page is DERIVED ON DEMAND from data the
// merchant app already wrote for its own reasons. Nothing new is stored,
// no write path is touched, and turning the feature off costs nothing.
//
// ── Metric provenance ─────────────────────────────────────────────────
// Every value returned carries a `source`, and the UI prints it:
//
//   measured  — counted or summed directly by Firestore over real
//               documents. Exact at the moment of reading.
//   derived   — computed by this Worker from measured values
//               (inventory value = Σ stock × cost, read from products).
//   estimated — a stated approximation with a stated assumption.
//
// There is deliberately NO "provider" source here. FlowBiz has no
// credential for the Cloud Billing API, so nothing on this page is, or
// claims to be, a Google/Firebase bill.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission, logAdminAction, requestContext, can } from '../../lib/adminAuth.js';
import { getDocument, safeCount, safeSum, queryPage, runAggregation } from '../../lib/firestore.js';
import { assertBusinessId } from '../../lib/validate.js';
import { cached } from '../../lib/usageCache.js';

// A COUNT is cheap but not free. Past this many index entries the answer
// stops being "how many" and starts being "a lot", which is all the
// dashboard needs — so we cap and label it.
const COUNT_CEILING = 50000;

// Inventory value is the one metric that cannot be aggregated (Firestore
// cannot multiply two fields), so it reads products. The read is
// PROJECTED to five numeric fields, so 1,000 products is ~40KB, not the
// megabytes a full catalogue read would move.
const INVENTORY_SCAN_LIMIT = 1000;

const USAGE_TTL_MS = 3 * 60 * 1000;

function tenant(businessId) {
  return [{ field: 'businessId', op: 'EQUAL', value: businessId }];
}

function metric(result, source = 'measured') {
  if (!result || result.value === null) {
    return { value: null, source, available: false, note: 'Could not be measured.' };
  }
  return {
    value: result.value,
    source,
    available: true,
    capped: Boolean(result.capped),
    ...(result.capped ? { note: `Counting stopped at ${COUNT_CEILING.toLocaleString('en-KE')}.` } : {}),
  };
}

/** Σ stock×cost and Σ stock×price, plus the low-stock picture. */
async function inventoryValue(env, businessId) {
  try {
    const { documents, hasMore } = await queryPage(env, 'products', {
      filters: tenant(businessId),
      orderBy: null,
      limit: INVENTORY_SCAN_LIMIT,
      select: ['stock', 'costPrice', 'sellingPrice', 'lowStockThreshold', 'deleted', 'businessId'],
    });

    let cost = 0;
    let retail = 0;
    let low = 0;
    let out = 0;
    let active = 0;

    for (const p of documents) {
      if (p.deleted === true) continue;
      active++;
      const stock = Number(p.stock) || 0;
      const threshold = Number(p.lowStockThreshold) || 5;
      cost += stock * (Number(p.costPrice) || 0);
      retail += stock * (Number(p.sellingPrice) || 0);
      if (stock <= 0) out++;
      else if (stock <= threshold) low++;
    }

    return {
      inventoryCost: { value: Math.round(cost * 100) / 100, source: 'derived', available: true, capped: hasMore },
      inventoryRetail: { value: Math.round(retail * 100) / 100, source: 'derived', available: true, capped: hasMore },
      lowStockCount: { value: low, source: 'derived', available: true, capped: hasMore },
      outOfStockCount: { value: out, source: 'derived', available: true, capped: hasMore },
      activeProducts: { value: active, source: 'derived', available: true, capped: hasMore },
      scanned: documents.length,
      truncated: hasMore,
      note: hasMore
        ? `Computed from the first ${INVENTORY_SCAN_LIMIT.toLocaleString('en-KE')} products; this catalogue is larger.`
        : 'Computed from every product in the catalogue.',
    };
  } catch (err) {
    console.warn('[usage] inventory scan failed:', err.message);
    return { error: 'unavailable', note: 'Inventory value could not be computed.' };
  }
}

/**
 * Product-photo storage. Photos live as base64 in `productImages` (see
 * utils/productImages.js — FlowBiz is on the Spark plan, so there is no
 * Cloud Storage bucket). Each document records the byte length it was
 * written with, so a SUM aggregation gives total storage WITHOUT
 * transferring a single image. Downloading images to weigh them would be
 * both absurd and expensive; this reads the number that already exists.
 */
async function imageStorage(env, businessId) {
  const filters = tenant(businessId);
  const sum = await safeSum(env, 'productImages', 'bytes', filters);

  if (sum.error) {
    return { available: false, note: 'Image storage could not be measured.' };
  }

  let averageBytes;
  try {
    const agg = await runAggregation(env, 'productImages', {
      filters,
      aggregations: [{ alias: 'avg', avg: 'bytes' }],
    });
    averageBytes = Number(agg.avg) || 0;
  } catch {
    averageBytes = sum.count ? Math.round(sum.total / sum.count) : 0;
  }

  // Newest uploads need an index on (businessId, stamp). It is optional —
  // without it the panel simply omits the recent list rather than failing.
  let recent;
  try {
    const page = await queryPage(env, 'productImages', {
      filters,
      orderBy: 'stamp',
      orderDirection: 'DESCENDING',
      limit: 5,
      select: ['productId', 'bytes', 'width', 'height', 'contentType', 'stamp', 'businessId'],
    });
    recent = page.documents;
  } catch {
    recent = [];
  }

  return {
    available: true,
    imageCount: { value: sum.count, source: 'measured', available: true },
    // `bytes` is the base64 character length actually stored in the
    // document — which IS what the document costs, so this is the real
    // stored size, not an approximation of it.
    totalBytes: { value: sum.total, source: 'measured', available: true },
    averageBytes: { value: Math.round(averageBytes), source: 'derived', available: true },
    recentUploads: recent,
    note: 'Base64 payload bytes recorded on each productImages document. FlowBiz stores product photos in Firestore, not Cloud Storage.',
  };
}

/**
 * Synchronisation and liveness, OBSERVED from data the offline-first
 * client already writes. Nothing here changes, wraps or second-guesses
 * the sync engine — AuthContext refreshes `sessions.lastActiveAt` while a
 * device is open, and every sale carries `soldAt`. The most recent of
 * those is the last time this business demonstrably reached Firestore.
 *
 * This is an OBSERVATION, not a heartbeat: a shop that is open but idle,
 * or working offline as designed, will look quiet here. The UI says so.
 */
async function syncSignals(env, businessId) {
  const filters = tenant(businessId);
  const out = {
    lastSessionActivityAt: null,
    lastSaleAt: null,
    lastKnownActivityAt: null,
    activeDevices: 0,
    revokedDevices: 0,
    devices: [],
    note: 'Observed from session heartbeats and the most recent sale. Offline-first: silence can mean "working offline", not "broken".',
  };

  try {
    const sessions = await queryPage(env, 'sessions', {
      filters,
      orderBy: null,
      limit: 25,
      select: ['uid', 'lastUserName', 'deviceLabel', 'lastActiveAt', 'createdAt', 'revoked', 'businessId'],
    });
    for (const s of sessions.documents) {
      if (s.revoked === true) out.revokedDevices++;
      else out.activeDevices++;
      const ms = s.lastActiveAt ? Date.parse(s.lastActiveAt) : NaN;
      if (Number.isFinite(ms)) {
        if (!out.lastSessionActivityAt || ms > Date.parse(out.lastSessionActivityAt)) {
          out.lastSessionActivityAt = new Date(ms).toISOString();
        }
      }
    }
    out.devices = sessions.documents;
  } catch (err) {
    console.warn('[usage] session read failed:', err.message);
  }

  try {
    const lastSale = await queryPage(env, 'sales', {
      filters,
      orderBy: 'soldAt',
      orderDirection: 'DESCENDING',
      limit: 1,
      select: ['soldAt', 'totalAmount', 'businessId'],
    });
    const soldAt = lastSale.documents[0]?.soldAt;
    if (soldAt) out.lastSaleAt = new Date(Date.parse(soldAt)).toISOString();
  } catch (err) {
    console.warn('[usage] last sale read failed:', err.message);
  }

  const candidates = [out.lastSessionActivityAt, out.lastSaleAt]
    .map((v) => (v ? Date.parse(v) : NaN))
    .filter(Number.isFinite);
  if (candidates.length) out.lastKnownActivityAt = new Date(Math.max(...candidates)).toISOString();

  out.quietDays = out.lastKnownActivityAt
    ? Math.floor((Date.now() - Date.parse(out.lastKnownActivityAt)) / 86400000)
    : null;

  return out;
}

/**
 * The whole usage picture for one business. Exported because the business
 * Overview tab, the directory row expansion and the platform cloud-usage
 * page all need exactly this and must not each invent their own version.
 */
export async function computeBusinessUsage(env, businessId, { includePayments = false } = {}) {
  const filters = tenant(businessId);

  const [
    products, customers, suppliers, sales, credits, expenses,
    purchases, adjustments, sessions, documents,
  ] = await Promise.all([
    safeCount(env, 'products', filters, COUNT_CEILING),
    safeCount(env, 'customers', filters, COUNT_CEILING),
    safeCount(env, 'suppliers', filters, COUNT_CEILING),
    safeCount(env, 'sales', filters, COUNT_CEILING),
    safeCount(env, 'creditSales', filters, COUNT_CEILING),
    safeCount(env, 'expenses', filters, COUNT_CEILING),
    safeCount(env, 'purchases', filters, COUNT_CEILING),
    safeCount(env, 'stockAdjustments', filters, COUNT_CEILING),
    safeCount(env, 'sessions', filters, COUNT_CEILING),
    safeCount(env, 'sharedDocuments', filters, COUNT_CEILING),
  ]);

  const [revenue, grossProfit, outstanding, expenseTotal, inventory, images, sync] = await Promise.all([
    safeSum(env, 'sales', 'totalAmount', filters),
    safeSum(env, 'sales', 'profit', filters),
    safeSum(env, 'creditSales', 'remainingBalance', filters),
    safeSum(env, 'expenses', 'amount', filters),
    inventoryValue(env, businessId),
    imageStorage(env, businessId),
    syncSignals(env, businessId),
  ]);

  let payments = null;
  if (includePayments) {
    const paymentCount = await safeCount(env, 'payments', filters, 500);
    payments = { count: metric(paymentCount) };
  }

  // Total documents this business owns across the collections we count —
  // the closest honest proxy for its Firestore storage footprint.
  const countedDocs = [products, customers, suppliers, sales, credits, expenses,
                       purchases, adjustments, sessions, documents]
    .map((c) => c.value)
    .filter((v) => typeof v === 'number');
  const documentFootprint = countedDocs.length
    ? countedDocs.reduce((a, b) => a + b, 0) + (images.imageCount?.value || 0)
    : null;

  return {
    counts: {
      products: metric(products),
      customers: metric(customers),
      suppliers: metric(suppliers),
      sales: metric(sales),
      creditSales: metric(credits),
      expenses: metric(expenses),
      purchases: metric(purchases),
      stockAdjustments: metric(adjustments),
      sessions: metric(sessions),
      sharedDocuments: metric(documents),
    },
    money: {
      // Σ totalAmount over EVERY sale document, voided ones included —
      // this is a usage/volume figure, not the merchant's revenue. The
      // merchant's own reporting stays the authority on money, and this
      // endpoint deliberately does not re-implement it.
      grossSalesVolume: revenue.error
        ? { value: null, source: 'measured', available: false }
        : { value: revenue.total, source: 'measured', available: true,
            note: 'Σ of every sale document, voided sales included. A volume signal, not the merchant’s reported revenue.' },
      grossProfit: grossProfit.error
        ? { value: null, source: 'measured', available: false }
        : { value: grossProfit.total, source: 'measured', available: true,
            note: 'Σ of the `profit` field the app wrote on each sale, read as stored. This console never recomputes margin.' },
      outstandingCredit: outstanding.error
        ? { value: null, source: 'measured', available: false }
        : { value: outstanding.total, source: 'measured', available: true,
            note: 'Σ remainingBalance across all credit sales, exactly as the app stores it.' },
      expenseTotal: expenseTotal.error
        ? { value: null, source: 'measured', available: false }
        : { value: expenseTotal.total, source: 'measured', available: true },
    },
    inventory,
    images,
    sync,
    payments,
    documentFootprint: documentFootprint === null
      ? { value: null, source: 'derived', available: false }
      : { value: documentFootprint, source: 'derived', available: true,
          note: 'Sum of the document counts above. A storage footprint proxy, not a billed figure.' },
    measuredAt: new Date().toISOString(),
  };
}

export async function handleAdminBusinessUsage(request, env, rawBusinessId) {
  let admin;
  let businessId;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'business.inspect');
    businessId = assertBusinessId(rawBusinessId);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const business = await getDocument(env, 'businesses', businessId);
  if (!business) return errorResponse('Business not found.', 404);

  const includePayments = can(admin, 'payments.read');
  const { value: usage, computedAt, fromCache } = await cached(
    `usage:${businessId}:${includePayments ? 'p' : 'n'}`,
    USAGE_TTL_MS,
    () => computeBusinessUsage(env, businessId, { includePayments })
  );

  const ctx = requestContext(request);
  await logAdminAction(env, admin, 'VIEW_BUSINESS_USAGE', {
    targetBusinessId: businessId,
    targetResource: 'usage',
    ip: ctx.ip,
  });

  return json({
    businessId,
    businessName: business.name || null,
    usage,
    computedAt: new Date(computedAt).toISOString(),
    fromCache,
    cacheTtlSeconds: USAGE_TTL_MS / 1000,
    provenance: {
      measured: 'Counted or summed by Firestore over real documents at the time shown.',
      derived: 'Computed by FlowBiz from measured values.',
      estimated: 'A stated approximation. The assumption is printed with the number.',
      provider: 'None. FlowBiz holds no Google Cloud Billing credential, so no figure here is a Firebase bill.',
    },
  });
}
