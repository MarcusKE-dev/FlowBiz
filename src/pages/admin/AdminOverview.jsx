// src/pages/admin/AdminOverview.jsx
//
// One screen that answers "is FlowBiz healthy?" — four bands, in the
// order an operator actually asks the question: who is on the platform,
// how much they are using, whether the machinery is working, and who has
// been touching merchant data.
//
// It is deliberately not thirty cards. Each band is either a metric rail,
// one chart, or one table; anything that needs more room has its own page
// and a link from here.
//
// Nothing on this page is live. The Worker computes it on request and
// caches it briefly, and the header says when it was computed rather than
// implying a stream.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ShieldCheck, ArrowRight, RotateCw,
  Search, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { fetchAdminOverview } from '../../utils/adminService';
import { appPath } from '../../lib/appUrl';
import PageHeader from '../../components/ui/PageHeader';
import Section from '../../components/ui/Section';
import MetricRail, { Metric } from '../../components/ui/MetricRail';
import DataTable from '../../components/ui/DataTable';
import StatusPill from '../../components/ui/StatusPill';
import StatementBlock, { StatementRow } from '../../components/ui/StatementBlock';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import AdminApiError from '../../components/admin/AdminApiError';
import MiniLineChart from '../../components/charts/MiniLineChart';
import { formatBytes } from '../../components/admin/inspector/UsagePanel';
import { formatDate, formatDateTime } from '../../utils/dateRanges';

const PLAN_TONE = { lifetime: 'info', pro: 'info', free: 'neutral' };

const SENSITIVE_ACTIONS = new Set([
  'DELETE_BUSINESS_COMPLETELY',
  'TOGGLE_BUSINESS_STATUS',
  'UPDATE_SUBSCRIPTION',
  'ADD_SYSTEM_ADMIN',
  'DEACTIVATE_SYSTEM_ADMIN',
]);

function n(metric) {
  if (typeof metric === 'number') return metric.toLocaleString('en-KE');
  if (!metric || !metric.available || metric.value === null) return '-';
  return Number(metric.value).toLocaleString('en-KE');
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdminOverview()
      .then(setData)
      // The whole error object is kept, not just its message: the
      // version-skew case carries a flag the notice branches on.
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Platform overview" description="Loading…" />
        <SkeletonRows rows={8} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="Platform overview" />
        <AdminApiError error={error} onRetry={load} />
      </div>
    );
  }
  if (!data) return null;

  const { counts, recent, signups30, truncated } = data.businesses;
  const docs = data.usage?.documents || {};
  const storage = data.usage?.imageStorage || {};

  const paymentsHealthy = data.payments
    ? data.payments.webhookProblems === 0 && data.payments.stuckPendingCount === 0
    : null;
  const errorsToday = data.errors?.last24h ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Platform overview"
        description={`Computed ${formatDateTime(data.computedAt)}. Refresh to recompute.`}
        actions={
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (quickSearch.trim()) {
                  window.location.href = appPath(`/admin/businesses?search=${encodeURIComponent(quickSearch.trim())}`);
                }
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  placeholder="Business name or ID…"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  className="input !w-56 !py-1.5 !pl-8 text-cell"
                  aria-label="Quick business search"
                />
              </div>
              <button type="submit" className="btn-outline !px-3 text-button">Find</button>
            </form>
            <button type="button" onClick={load} className="btn-outline !px-2.5 flex items-center gap-1.5 text-button">
              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Refresh
            </button>
          </>
        }
      />

      {/* ── Businesses ── */}
      <Section
        title="Businesses"
        hint={truncated ? 'The listing hit its ceiling. Counts cover the businesses read.' : undefined}
        action={
          <Link to="/admin/businesses" className="inline-flex items-center gap-1 text-cell text-primary-700 hover:underline">
            Directory <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
          </Link>
        }
      >
        <MetricRail columns={4}>
          <Metric label="Total" value={n(counts.total)} hint={`+${counts.new30} in 30 days`} />
          <Metric label="Lifetime licences" value={n(counts.lifetime)} hint="Perpetual" />
          <Metric label="Pro subscriptions" value={n(counts.pro)} hint="Monthly" />
          <Metric
            label="Suspended"
            value={n(counts.suspended)}
            hint={`${counts.active} active`}
            delta={counts.suspended > 0 ? 'Check' : undefined}
            deltaTone={counts.suspended > 0 ? 'negative' : 'neutral'}
          />
        </MetricRail>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-panel border border-line bg-surface p-4">
            <p className="mb-2 text-label uppercase text-ink-500">Sign-ups, last 30 days</p>
            <MiniLineChart
              data={signups30}
              height={180}
              formatValue={(v) => `${v} business${v === 1 ? '' : 'es'}`}
              ariaLabel="New businesses per day over the last 30 days"
              empty="No sign-ups in this window."
            />
          </div>

          <div className="space-y-2">
            <p className="text-label uppercase text-ink-500">Newest businesses</p>
            {recent.length === 0 ? (
              <EmptyState icon={Building2} title="No businesses yet" />
            ) : (
              <DataTable
                mobileLayout="row"
                columns={[
                  {
                    key: 'name', header: 'Business', primary: true,
                    render: (b) => (
                      <Link to={`/admin/businesses/${b.id}`} className="font-medium text-ink-900 hover:text-primary-700">
                        {b.name}
                      </Link>
                    ),
                  },
                  {
                    key: 'plan', header: 'Plan', mobileTrailing: true,
                    render: (b) => <StatusPill tone={PLAN_TONE[b.plan] || 'neutral'}>{b.plan}</StatusPill>,
                  },
                  { key: 'createdAt', header: 'Joined', mobileTrailing: true, render: (b) => formatDate(b.createdAt) },
                ]}
                rows={recent}
              />
            )}
          </div>
        </div>
      </Section>

      {/* ── Usage ── */}
      <Section
        title="Usage"
        hint="Counted over FlowBiz's own documents. Not a Firebase bill."
        action={
          <Link to="/admin/cloud-usage" className="inline-flex items-center gap-1 text-cell text-primary-700 hover:underline">
            Cloud usage <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
          </Link>
        }
      >
        <MetricRail columns={4}>
          <Metric label="Products" value={n(docs.products)} hint="Across all shops" />
          <Metric label="Customers" value={n(docs.customers)} hint="Across all shops" />
          <Metric label="Sales recorded" value={n(docs.sales)} hint="All time" />
          <Metric
            label="Image storage"
            value={storage.totalBytes?.available ? formatBytes(storage.totalBytes.value) : '-'}
            hint={`${n(storage.imageCount)} photos`}
          />
        </MetricRail>
      </Section>

      {/* ── Operations ── */}
      <Section
        title="Operations"
        action={
          <Link to="/admin/system-health" className="inline-flex items-center gap-1 text-cell text-primary-700 hover:underline">
            System health <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {data.payments ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-label uppercase text-ink-500">
                Payments & webhooks
                <StatusPill tone={paymentsHealthy ? 'positive' : 'caution'}>
                  {paymentsHealthy ? 'Clean' : 'Attention'}
                </StatusPill>
              </p>
              <StatementBlock>
                <StatementRow label="Confirmed successful" value={n(data.payments.counts.success)} />
                <StatementRow label="Pending" value={n(data.payments.counts.pending)} tone="muted" />
                <StatementRow label="Pending over 24 hours" value={data.payments.stuckPendingCount} tone={data.payments.stuckPendingCount > 0 ? 'negative' : 'default'} />
                <StatementRow label="Recorded webhook problems" value={data.payments.webhookProblems} tone={data.payments.webhookProblems > 0 ? 'negative' : 'default'} />
                <StatementRow
                  label="Success rate"
                  value={data.payments.successRate?.available ? `${data.payments.successRate.value}%` : '-'}
                  strong
                />
              </StatementBlock>
              <p className="section-hint">{data.payments.note}</p>
            </div>
          ) : (
            <div className="rounded-panel border border-dashed border-line bg-surface p-4 text-cell text-ink-500">
              Payment health is visible to FINANCE, ADMIN and SUPER_ADMIN roles.
            </div>
          )}

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-label uppercase text-ink-500">
              Operational errors
              <StatusPill tone={errorsToday ? 'caution' : 'positive'}>
                {errorsToday ? `${errorsToday} in 24h` : 'Quiet'}
              </StatusPill>
            </p>
            {data.errors?.recent?.length ? (
              <DataTable
                mobileLayout="row"
                columns={[
                  { key: 'createdAt', header: 'When', primary: true, render: (e) => formatDateTime(e.createdAt) },
                  {
                    key: 'severity', header: 'Severity', mobileTrailing: true,
                    render: (e) => (
                      <StatusPill tone={e.severity === 'error' ? 'negative' : e.severity === 'warning' ? 'caution' : 'neutral'}>
                        {e.severity}
                      </StatusPill>
                    ),
                  },
                  { key: 'message', header: 'What happened', render: (e) => e.message },
                ]}
                rows={data.errors.recent}
              />
            ) : (
              <div className="flex items-start gap-2.5 rounded-panel border border-line bg-surface px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
                <p className="text-cell text-ink-600">
                  Nothing has failed in a way FlowBiz records. Webhook rejections, undeliverable
                  emails and server-side errors would appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Security ── */}
      {data.security && (
        <Section
          title="Security"
          hint="Administrative activity across the platform. Repeated inspections within ten minutes are recorded once."
          action={
            <Link to="/admin/audit-logs" className="inline-flex items-center gap-1 text-cell text-primary-700 hover:underline">
              Audit trail <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
            </Link>
          }
        >
          {data.security.sensitiveActions7d !== null && data.security.sensitiveActions7d > 0 && (
            <div className="flex items-start gap-2.5 rounded-panel border border-line bg-surface px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
              <p className="text-cell text-ink-600">
                <strong className="text-ink-900">{data.security.sensitiveActions7d}</strong> account-changing
                administrative action{data.security.sensitiveActions7d === 1 ? '' : 's'} in the last 7 days
                (suspensions and plan changes).
              </p>
            </div>
          )}

          {data.security.recentAdminEvents.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No administrative activity recorded" />
          ) : (
            <DataTable
              mobileLayout="row"
              columns={[
                { key: 'timestamp', header: 'When', primary: true, render: (l) => formatDateTime(l.timestamp) },
                {
                  key: 'action', header: 'Action', mobileTrailing: true,
                  render: (l) => (
                    <StatusPill tone={SENSITIVE_ACTIONS.has(l.action) ? 'caution' : 'neutral'}>{l.action}</StatusPill>
                  ),
                },
                { key: 'adminEmail', header: 'Administrator', render: (l) => l.adminEmail || l.adminName || '-' },
                { key: 'adminRole', header: 'Role', render: (l) => l.adminRole || '-' },
                {
                  key: 'targetBusinessId', header: 'Business',
                  render: (l) => (l.targetBusinessId
                    ? <Link to={`/admin/businesses/${l.targetBusinessId}`} className="num text-primary-700 hover:underline">{l.targetBusinessId}</Link>
                    : '-'),
                },
              ]}
              rows={data.security.recentAdminEvents}
            />
          )}
        </Section>
      )}
    </div>
  );
}
