// src/pages/admin/AdminCloudUsage.jsx
//
// Platform cloud usage: how much of FlowBiz's own storage the businesses
// on it are actually using, and which of them stand out.
//
// ── The honesty rule this page is built around ────────────────────────
// FlowBiz has no Google Cloud Billing credential, so it cannot see a
// Firebase bill, and this page does not pretend otherwise. The banner
// says so in plain words, every number carries how it was obtained, and
// no business is ever labelled "expensive" — only "high transaction
// volume" or "high image storage", which are facts about the data rather
// than guesses about someone else's invoice.
//
// ── Why profiling is sampled ──────────────────────────────────────────
// Platform totals are one cheap aggregation per collection. Per-business
// profiling is three aggregations PER BUSINESS, so it runs on a bounded
// slice and the footer says exactly how many businesses were looked at.
// "Profile more" walks forward through the directory; it never silently
// implies the whole platform was measured.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud, Database, HardDrive, Info, AlertTriangle, RotateCw, ArrowRight,
} from 'lucide-react';
import { fetchCloudUsage } from '../../utils/adminService';
import PageHeader from '../../components/ui/PageHeader';
import Section from '../../components/ui/Section';
import MetricRail, { Metric } from '../../components/ui/MetricRail';
import DataTable from '../../components/ui/DataTable';
import StatusPill from '../../components/ui/StatusPill';
import StatementBlock, { StatementRow, StatementResult } from '../../components/ui/StatementBlock';
import { SkeletonRows } from '../../components/ui/Skeleton';
import AdminApiError from '../../components/admin/AdminApiError';
import MiniBarChart from '../../components/charts/MiniBarChart';
import { formatBytes } from '../../components/admin/inspector/UsagePanel';
import { formatDateTime } from '../../utils/dateRanges';

const COLLECTION_LABELS = {
  products: 'Products',
  customers: 'Customers',
  suppliers: 'Suppliers',
  sales: 'Sales',
  creditSales: 'Credit sales',
  expenses: 'Expenses',
  purchases: 'Purchases',
  stockAdjustments: 'Stock adjustments',
  sessions: 'Device sessions',
  sharedDocuments: 'Shared documents',
  productImages: 'Product photos',
};

const FLAG_TONE = { caution: 'caution', negative: 'negative', neutral: 'neutral' };

function n(metric) {
  if (!metric || !metric.available || metric.value === null) return '-';
  return Number(metric.value).toLocaleString('en-KE');
}

export default function AdminCloudUsage() {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) { setLoading(true); setError(null); }
    else setLoadingMore(true);
    try {
      const res = await fetchCloudUsage({ offset, sample: 12 });
      setData(res);
      setRows((prev) => (offset === 0 ? res.profiled : [...prev, ...res.profiled]));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Cloud usage" description="Measuring platform storage…" />
        <SkeletonRows rows={10} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Cloud usage" />
        <AdminApiError error={error} onRetry={() => load(0)} />
      </div>
    );
  }
  if (!data) return null;

  const docs = data.platform.documents || {};
  const storage = data.platform.imageStorage || {};

  const collectionChart = Object.entries(docs)
    .filter(([, m]) => m.available && m.value > 0)
    .map(([key, m]) => ({ label: COLLECTION_LABELS[key] || key, value: m.value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topByImages = [...rows]
    .filter((r) => typeof r.imageBytes === 'number' && r.imageBytes > 0)
    .sort((a, b) => b.imageBytes - a.imageBytes)
    .slice(0, 6)
    .map((r) => ({ label: r.name, value: r.imageBytes }));

  const flagged = rows.filter((r) => r.flags.length > 0).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Cloud usage"
        description="What FlowBiz's businesses are storing, measured from FlowBiz's own data."
        actions={
          <button type="button" onClick={() => load(0)} className="btn-outline !px-2.5 flex items-center gap-1.5 text-button">
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Re-measure
          </button>
        }
      />

      {/* The disclaimer is not a footnote. It is the first thing on the
          page, because everything below it is worth less if this is
          misread as a bill. */}
      <div className="flex items-start gap-2.5 rounded-panel border border-line bg-surface px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
        <p className="text-cell text-ink-600">
          <strong className="text-ink-900">These are not Firebase billing figures.</strong>{' '}
          FlowBiz holds no Google Cloud Billing credential, so it cannot read what Google charges
          and does not estimate it. Everything here is counted or summed by Firestore over FlowBiz's
          own documents. For actual spend, read the Google Cloud console.
        </p>
      </div>

      <MetricRail columns={4}>
        <Metric label="Businesses" value={n(data.platform.businessCount)} hint="On the platform" />
        <Metric label="Documents counted" value={n(data.platform.totalDocumentsCounted)} hint="Across FlowBiz collections" />
        <Metric
          label="Image storage"
          value={storage.totalBytes?.available ? formatBytes(storage.totalBytes.value) : '-'}
          hint={`${n(storage.imageCount)} photos`}
        />
        <Metric
          label="Flagged for review"
          value={flagged}
          hint={`Of ${rows.length} profiled`}
          delta={flagged > 0 ? 'Review' : undefined}
          deltaTone={flagged > 0 ? 'negative' : 'neutral'}
        />
      </MetricRail>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Documents by collection"
          hint="One Firestore COUNT per collection. No telemetry is stored to produce it."
        >
          <div className="rounded-panel border border-line bg-surface p-4">
            <MiniBarChart
              data={collectionChart}
              orientation="horizontal"
              formatValue={(v) => v.toLocaleString('en-KE')}
              ariaLabel="Document count by collection"
              empty="Nothing counted yet."
            />
          </div>
        </Section>

        <Section
          title="Product image storage"
          hint="Summed from the byte size recorded on each photo. No image is downloaded to weigh it."
        >
          <StatementBlock>
            <StatementRow label="Photos stored" value={n(storage.imageCount)} />
            <StatementRow
              label="Average size"
              value={storage.averageBytes?.available ? formatBytes(storage.averageBytes.value) : '-'}
            />
            <StatementResult
              label="Total image bytes"
              value={storage.totalBytes?.available ? formatBytes(storage.totalBytes.value) : '-'}
              tone="info"
            />
          </StatementBlock>
          {topByImages.length > 0 && (
            <div className="rounded-panel border border-line bg-surface p-4">
              <p className="mb-2.5 text-label uppercase text-ink-500">Largest photo libraries (profiled businesses)</p>
              <MiniBarChart
                data={topByImages}
                orientation="horizontal"
                formatValue={formatBytes}
                ariaLabel="Image storage by business"
              />
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Business activity profile"
        hint={data.sampling.note}
        action={
          data.sampling.hasMore ? (
            <button
              type="button"
              onClick={() => load(data.sampling.nextOffset)}
              disabled={loadingMore}
              className="btn-outline !px-3 text-button"
            >
              {loadingMore ? 'Profiling…' : 'Profile more'}
            </button>
          ) : null
        }
      >
        <DataTable
          mobileLayout="row"
          columns={[
            {
              key: 'name', header: 'Business', primary: true,
              render: (r) => (
                <Link to={`/admin/businesses/${r.id}`} className="font-medium text-ink-900 hover:text-primary-700">
                  {r.name}
                </Link>
              ),
            },
            {
              key: 'plan', header: 'Plan',
              render: (r) => <StatusPill tone={r.plan === 'free' ? 'neutral' : 'info'}>{r.plan}</StatusPill>,
            },
            { key: 'salesCount', header: 'Sales', numeric: true, mobileTrailing: true, render: (r) => (r.salesCount ?? '-').toLocaleString?.('en-KE') ?? '-' },
            { key: 'productCount', header: 'Products', numeric: true, render: (r) => (r.productCount ?? '-').toLocaleString?.('en-KE') ?? '-' },
            { key: 'customerCount', header: 'Customers', numeric: true, render: (r) => (r.customerCount ?? '-').toLocaleString?.('en-KE') ?? '-' },
            { key: 'imageBytes', header: 'Photos', numeric: true, mobileTrailing: true, render: (r) => formatBytes(r.imageBytes) },
            {
              key: 'flags', header: 'Signals',
              render: (r) => (
                r.flags.length === 0
                  ? <span className="text-ink-400">-</span>
                  : (
                    <span className="flex flex-wrap gap-1">
                      {r.flags.map((f) => (
                        <StatusPill key={f.key} tone={FLAG_TONE[f.tone] || 'neutral'}>{f.label}</StatusPill>
                      ))}
                    </span>
                  )
              ),
            },
          ]}
          rows={rows}
          empty={<p className="p-6 text-center text-cell text-ink-500">No businesses profiled.</p>}
        />

        <p className="flex flex-wrap items-center gap-x-2 text-cell text-ink-500">
          <span>
            Profiled {rows.length} of {data.sampling.totalBusinesses} businesses,
            measured {formatDateTime(data.sampling.computedAt)}.
          </span>
          {data.sampling.hasMore && (
            <span className="inline-flex items-center gap-1 text-ink-400">
              <ArrowRight className="h-3 w-3" strokeWidth={1.75} /> The rest have not been measured.
            </span>
          )}
        </p>
      </Section>

      <Section
        title="Activity thresholds"
        hint={data.thresholdNote}
      >
        <StatementBlock>
          <StatementRow label="High transaction volume" value={`${data.thresholds.sales.toLocaleString('en-KE')} sales`} />
          <StatementRow label="Large catalogue" value={`${data.thresholds.products.toLocaleString('en-KE')} products`} />
          <StatementRow label="Large customer book" value={`${data.thresholds.customers.toLocaleString('en-KE')} customers`} />
          <StatementRow label="High image storage" value={formatBytes(data.thresholds.imageBytes)} />
          <StatementRow label="Many product photos" value={`${data.thresholds.imageCount.toLocaleString('en-KE')} photos`} />
        </StatementBlock>
        <p className="section-hint flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={1.75} />
          Two or more caution signals on one business raises “Review recommended”. That is a prompt
          to look, not a judgement about cost.
        </p>
      </Section>

      <Section title="Metric provenance" hint="What FlowBiz can and cannot know about its own cloud usage.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-panel border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-ink-400" strokeWidth={1.75} />
              <h3 className="text-section-title">Provider-confirmed</h3>
            </div>
            <p className="mt-1.5 text-cell text-ink-600">{data.provenance.providerConfirmed.explanation}</p>
          </div>
          <div className="rounded-panel border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-ink-400" strokeWidth={1.75} />
              <h3 className="text-section-title">Application-measured</h3>
            </div>
            <p className="mt-1.5 text-cell text-ink-600">{data.provenance.applicationMeasured.explanation}</p>
            <ul className="mt-2 space-y-1 text-label text-ink-500">
              {data.provenance.applicationMeasured.metrics.map((m) => <li key={m}>· {m}</li>)}
            </ul>
          </div>
          <div className="rounded-panel border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-ink-400" strokeWidth={1.75} />
              <h3 className="text-section-title">Derived & estimated</h3>
            </div>
            <p className="mt-1.5 text-cell text-ink-600">{data.provenance.derived.explanation}</p>
            <p className="mt-2 text-label text-ink-500">{data.provenance.estimated.explanation}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
