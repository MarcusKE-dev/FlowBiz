// cloudflare-worker/src/routes/admin/adminCloudUsage.js
//
// GET /api/admin/cloud-usage
//
// The platform-wide answer to "how much are FlowBiz businesses using the
// cloud, and which of them stand out?"
//
// ── What this is NOT ──────────────────────────────────────────────────
// It is not a Firebase bill and never claims to be one. FlowBiz holds no
// Google Cloud Billing credential, so there is no honest way to show
// billed spend from inside this Worker, and inventing a shilling figure
// from application counters would be worse than showing nothing. Every
// number here is labelled with how it was obtained (`source`), and the
// page prints those labels. See PROVENANCE at the bottom of this file.
//
// ── Two halves, two cost profiles ─────────────────────────────────────
//
//   PLATFORM TOTALS are genuinely cheap. An unfiltered COUNT over a
//   collection is one aggregation query billed at roughly one document
//   read per 1000 index entries, so counting every sale on the platform
//   costs single-digit reads. Same for Σ productImages.bytes. Eleven
//   aggregations answer the whole top half of the page.
//
//   PER-BUSINESS PROFILING is not cheap, because it is three aggregations
//   PER BUSINESS. Profiling 300 businesses in one request would be 900
//   Firestore round trips inside one Worker invocation — over Cloudflare's
//   subrequest budget, and slow. So profiling works on an explicit,
//   bounded SAMPLE (default 12, hard cap 30) with an offset, and the
//   response states plainly how many of the platform's businesses it
//   actually looked at. The console pages through and accumulates.
//
// Nothing here writes. There are no counters to maintain, no scheduled
// job to run, and no monitoring documents to grow — the cost of this
// feature is exactly the cost of the requests an administrator makes.

import { json, errorResponse } from '../../lib/response.js';
import { verifyAdminAuth, requirePermission } from '../../lib/adminAuth.js';
import { safeCount, safeSum, listAllDocuments } from '../../lib/firestore.js';
import { intParam } from '../../lib/validate.js';
import { cached } from '../../lib/usageCache.js';

const PLATFORM_TTL_MS = 5 * 60 * 1000;
const SAMPLE_TTL_MS = 5 * 60 * 1000;

const MAX_SAMPLE = 30;
const DEFAULT_SAMPLE = 12;

// Defaults an administrator can override per request. They describe
// ACTIVITY, not cost: FlowBiz cannot see a bill, so it does not get to
// call a business "expensive". "High transaction volume" is a fact about
// the data; "costly" would be a guess about Google's invoice.
export const DEFAULT_THRESHOLDS = {
  sales: 5000,
  products: 500,
  customers: 1000,
  imageBytes: 20 * 1024 * 1024,
  imageCount: 300,
};

const COUNTED_COLLECTIONS = [
  'products', 'customers', 'suppliers', 'sales', 'creditSales',
  'expenses', 'purchases', 'stockAdjustments', 'sessions',
  'sharedDocuments', 'productImages',
];

function tenant(businessId) {
  return [{ field: 'businessId', op: 'EQUAL', value: businessId }];
}

export async function platformTotals(env) {
  const counts = {};
  // Sequential rather than a 11-wide Promise.all: this keeps the Worker
  // inside its subrequest concurrency comfortably and the whole set still
  // completes in well under a second.
  for (const collection of COUNTED_COLLECTIONS) {
    const result = await safeCount(env, collection, []);
    counts[collection] = result.value === null
      ? { value: null, source: 'measured', available: false }
      : { value: result.value, source: 'measured', available: true };
  }

  const imageBytes = await safeSum(env, 'productImages', 'bytes', []);

  return {
    documents: counts,
    imageStorage: imageBytes.error
      ? { totalBytes: { value: null, source: 'measured', available: false } }
      : {
          totalBytes: { value: imageBytes.total, source: 'measured', available: true },
          imageCount: { value: imageBytes.count, source: 'measured', available: true },
          averageBytes: {
            value: imageBytes.count ? Math.round(imageBytes.total / imageBytes.count) : 0,
            source: 'derived',
            available: true,
          },
        },
    totalDocumentsCounted: {
      value: Object.values(counts).reduce((sum, c) => sum + (c.value || 0), 0),
      source: 'derived',
      available: true,
      note: 'Sum of the collection counts above. A proxy for FlowBiz’s own storage footprint, not a billed figure, and it excludes indexes and metadata.',
    },
  };
}

/** Three aggregations. The cheapest useful profile of one business. */
async function profileBusiness(env, business) {
  const filters = tenant(business.id);
  const [sales, products, customers, images] = await Promise.all([
    safeCount(env, 'sales', filters, 100000),
    safeCount(env, 'products', filters, 100000),
    safeCount(env, 'customers', filters, 100000),
    safeSum(env, 'productImages', 'bytes', filters),
  ]);

  return {
    id: business.id,
    name: business.name || 'Unnamed business',
    plan: business.effectivePlan,
    status: business.status,
    createdAt: business.createdAt || null,
    salesCount: sales.value,
    productCount: products.value,
    customerCount: customers.value,
    imageCount: images.error ? null : images.count,
    imageBytes: images.error ? null : images.total,
  };
}

function flagsFor(row, thresholds) {
  const flags = [];
  if (row.salesCount != null && row.salesCount >= thresholds.sales) {
    flags.push({ key: 'sales', label: 'High transaction volume', tone: 'caution' });
  }
  if (row.productCount != null && row.productCount >= thresholds.products) {
    flags.push({ key: 'products', label: 'Large catalogue', tone: 'neutral' });
  }
  if (row.customerCount != null && row.customerCount >= thresholds.customers) {
    flags.push({ key: 'customers', label: 'Large customer book', tone: 'neutral' });
  }
  if (row.imageBytes != null && row.imageBytes >= thresholds.imageBytes) {
    flags.push({ key: 'imageBytes', label: 'High image storage', tone: 'caution' });
  }
  if (row.imageCount != null && row.imageCount >= thresholds.imageCount) {
    flags.push({ key: 'imageCount', label: 'Many product photos', tone: 'neutral' });
  }
  if (flags.filter((f) => f.tone === 'caution').length >= 2) {
    flags.push({ key: 'review', label: 'Review recommended', tone: 'negative' });
  }
  return flags;
}

function effectivePlanOf(business, now) {
  const rawPlan = business.subscription?.plan;
  const subStatus = business.subscription?.status || 'active';
  const expiresAt = business.subscription?.expiresAt ? Date.parse(business.subscription.expiresAt) : null;
  const isLifetime = rawPlan === 'lifetime' && subStatus === 'active';
  const isPro = rawPlan === 'pro' && subStatus === 'active' && (!expiresAt || expiresAt > now);
  return isLifetime ? 'lifetime' : isPro ? 'pro' : 'free';
}

export async function handleAdminCloudUsage(request, env, url) {
  let admin;
  try {
    admin = await verifyAdminAuth(request, env);
    requirePermission(admin, 'ops.read');
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const sample = intParam(url, 'sample', { fallback: DEFAULT_SAMPLE, min: 1, max: MAX_SAMPLE });
  const offset = intParam(url, 'offset', { fallback: 0, min: 0, max: 5000 });

  const thresholds = {
    sales: intParam(url, 'thresholdSales', { fallback: DEFAULT_THRESHOLDS.sales, min: 1, max: 10_000_000 }),
    products: intParam(url, 'thresholdProducts', { fallback: DEFAULT_THRESHOLDS.products, min: 1, max: 1_000_000 }),
    customers: intParam(url, 'thresholdCustomers', { fallback: DEFAULT_THRESHOLDS.customers, min: 1, max: 1_000_000 }),
    imageBytes: intParam(url, 'thresholdImageBytes', { fallback: DEFAULT_THRESHOLDS.imageBytes, min: 1024, max: 10 * 1024 * 1024 * 1024 }),
    imageCount: intParam(url, 'thresholdImageCount', { fallback: DEFAULT_THRESHOLDS.imageCount, min: 1, max: 1_000_000 }),
  };

  const now = Date.now();

  const totalsResult = await cached('cloud:totals', PLATFORM_TTL_MS, () => platformTotals(env));

  // The business list itself is one cheap paged read and is shared by
  // every slice the console asks for.
  const listResult = await cached('cloud:businesses', PLATFORM_TTL_MS, async () => {
    const { documents, truncated } = await listAllDocuments(env, 'businesses', { pageSize: 300, maxDocs: 3000 });
    const rows = documents.map((b) => ({
      id: b.id,
      name: b.name || 'Unnamed business',
      status: b.status || 'active',
      createdAt: b.createdAt || null,
      effectivePlan: effectivePlanOf(b, now),
    }));
    rows.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { rows, truncated };
  });

  const allBusinesses = listResult.value.rows;
  const slice = allBusinesses.slice(offset, offset + sample);

  const profileResult = await cached(
    `cloud:profile:${offset}:${sample}`,
    SAMPLE_TTL_MS,
    async () => {
      const rows = [];
      for (const business of slice) {
        rows.push(await profileBusiness(env, business));
      }
      return rows;
    }
  );

  const profiled = profileResult.value.map((row) => ({ ...row, flags: flagsFor(row, thresholds) }));

  return json({
    platform: {
      ...totalsResult.value,
      businessCount: {
        value: allBusinesses.length,
        source: 'measured',
        available: true,
        capped: listResult.value.truncated,
      },
      computedAt: new Date(totalsResult.computedAt).toISOString(),
      fromCache: totalsResult.fromCache,
    },
    profiled,
    sampling: {
      offset,
      sample,
      profiledCount: profiled.length,
      totalBusinesses: allBusinesses.length,
      hasMore: offset + profiled.length < allBusinesses.length,
      nextOffset: offset + profiled.length,
      computedAt: new Date(profileResult.computedAt).toISOString(),
      fromCache: profileResult.fromCache,
      note: `Per-business profiling costs three Firestore aggregation queries per business, so it runs on a bounded sample (max ${MAX_SAMPLE} per request) rather than across the whole platform at once.`,
    },
    thresholds,
    thresholdNote: 'Thresholds describe ACTIVITY, not cost. FlowBiz cannot read a Google Cloud bill, so no business is labelled "expensive" here.',
    provenance: PROVENANCE,
  });
}

export const PROVENANCE = {
  providerConfirmed: {
    metrics: [],
    explanation:
      'None. FlowBiz has no Google Cloud Billing or Firebase usage API credential, and Paystack’s dashboard remains the authority on settled money. No figure in this console is a provider-confirmed bill or reconciliation.',
  },
  applicationMeasured: {
    metrics: [
      'Document counts per collection (Firestore COUNT aggregation)',
      'Product image storage bytes (Firestore SUM over productImages.bytes)',
      'Gross sales volume, outstanding credit, expense totals (Firestore SUM)',
      'Payment records and their recorded status (FlowBiz payments collection)',
      'Admin audit events and operational events (FlowBiz adminAuditLogs, opsEvents)',
      'Device sessions and their last-active timestamps',
    ],
    explanation:
      'Counted or summed by Firestore over FlowBiz’s own documents at the moment shown. Exact for what FlowBiz stores; it does not describe what Google bills.',
  },
  derived: {
    metrics: [
      'Inventory value (Σ stock × cost, read from a bounded product projection)',
      'Average image size',
      'Total document footprint',
      'Quiet days / last known activity',
      'Health statuses and activity flags',
    ],
    explanation: 'Computed by FlowBiz from measured values. The inputs are exact; the arithmetic is ours.',
  },
  estimated: {
    metrics: [],
    explanation:
      'Nothing on this page is a blind estimate. Where a number is computed from a bounded scan rather than the full collection, it is marked "capped" and the limit is printed next to it.',
  },
};
