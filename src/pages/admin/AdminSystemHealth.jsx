// src/pages/admin/AdminSystemHealth.jsx
//
// System health, payment/webhook health, and the operational event log,
// on one page.
//
// ── What makes this page trustworthy ──────────────────────────────────
// Every indicator states WHAT WAS CHECKED and WHEN. There is a fourth
// status alongside ok/warn/down — "unknown" — and a whole panel devoted
// to things FlowBiz genuinely cannot observe from here. A green tick that
// was never earned is worse than an honest gap, because the gap gets
// investigated and the tick gets believed.
//
// Nothing on this page polls or streams. It is computed when you open it,
// and the timestamp under the title says so.

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  EyeOff, RotateCw,
} from 'lucide-react';
import { fetchSystemHealth, fetchPaymentHealth, fetchOpsEvents } from '../../utils/adminService';
import { useAdmin } from '../../components/admin/AdminProtectedRoute';
import PageHeader from '../../components/ui/PageHeader';
import Section from '../../components/ui/Section';
import DataTable from '../../components/ui/DataTable';
import StatusPill from '../../components/ui/StatusPill';
import StatementBlock, { StatementRow } from '../../components/ui/StatementBlock';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import Money from '../../components/ui/Money';
import AdminApiError from '../../components/admin/AdminApiError';
import { formatDateTime } from '../../utils/dateRanges';

const STATUS = {
  ok:      { icon: CheckCircle2,  tone: 'positive', label: 'OK' },
  warn:    { icon: AlertTriangle, tone: 'caution',  label: 'Attention' },
  down:    { icon: XCircle,       tone: 'negative', label: 'Failing' },
  unknown: { icon: HelpCircle,    tone: 'neutral',  label: 'Not observable' },
};

const SEVERITY_TONE = { error: 'negative', warning: 'caution', info: 'neutral' };

function IndicatorCard({ indicator }) {
  const meta = STATUS[indicator.status] || STATUS.unknown;
  const Icon = meta.icon;

  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden="true" />
          <h3 className="truncate text-section-title">{indicator.label}</h3>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <p className="mt-2 text-cell text-ink-600">{indicator.detail}</p>
      {indicator.scope && (
        <p className="mt-1.5 text-label text-ink-400">{indicator.scope}</p>
      )}
      <p className="mt-2 text-label text-ink-400">
        Checked {formatDateTime(indicator.checkedAt)}
        {typeof indicator.latencyMs === 'number' && ` · ${indicator.latencyMs}ms`}
        {indicator.measure && ` · ${indicator.measure}`}
      </p>
    </div>
  );
}

function PaymentHealth({ payments }) {
  if (!payments) return null;

  return (
    <Section
      title="Payments & webhooks"
      hint={payments.note}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <StatementBlock>
          <StatementRow label="Confirmed successful" value={(payments.counts.success ?? '-').toLocaleString?.('en-KE') ?? '-'} />
          <StatementRow label="Still pending" value={(payments.counts.pending ?? '-').toLocaleString?.('en-KE') ?? '-'} tone="muted" />
          <StatementRow label="Recorded failed" value={(payments.counts.failed ?? '-').toLocaleString?.('en-KE') ?? '-'} />
          <StatementRow
            label="Pending over 24 hours"
            value={payments.stuckPendingCount}
            tone={payments.stuckPendingCount > 0 ? 'negative' : 'default'}
            hint="usually an abandoned checkout"
          />
          <StatementRow
            label="Success rate"
            value={payments.successRate?.available ? `${payments.successRate.value}%` : '-'}
            strong
            hint={payments.successRate?.available ? 'of records that reached a final state' : undefined}
          />
        </StatementBlock>

        <div className="space-y-3">
          <h3 className="text-label uppercase text-ink-500">Recorded webhook problems</h3>
          {payments.webhookEvents.length === 0 ? (
            <div className="rounded-panel border border-line bg-surface px-4 py-3 text-cell text-ink-600">
              No webhook failures recorded. HMAC verification, re-verification against Paystack and
              the amount check are all reporting clean.
            </div>
          ) : (
            <DataTable
              mobileLayout="row"
              columns={[
                { key: 'createdAt', header: 'When', primary: true, render: (e) => formatDateTime(e.createdAt) },
                { key: 'type', header: 'Type', mobileTrailing: true, render: (e) => <StatusPill tone="negative">{e.type}</StatusPill> },
                { key: 'message', header: 'What happened', render: (e) => e.message },
                { key: 'reference', header: 'Reference', render: (e) => <span className="num text-ink-500">{e.reference || '-'}</span> },
              ]}
              rows={payments.webhookEvents}
            />
          )}
        </div>
      </div>

      {payments.recent?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-label uppercase text-ink-500">Most recent payment records</h3>
          <DataTable
            mobileLayout="row"
            columns={[
              { key: 'createdAt', header: 'Started', primary: true, render: (p) => formatDateTime(p.createdAt) },
              { key: 'businessId', header: 'Business', render: (p) => <span className="num text-ink-600">{p.businessId}</span> },
              { key: 'plan', header: 'Plan', render: (p) => p.plan || '-' },
              { key: 'amountKes', header: 'Amount', numeric: true, mobileTrailing: true, render: (p) => <Money value={p.amountKes} /> },
              {
                key: 'status', header: 'Status', mobileTrailing: true,
                render: (p) => (
                  <StatusPill tone={p.status === 'success' ? 'positive' : p.status === 'failed' ? 'negative' : 'caution'}>
                    {p.status}
                  </StatusPill>
                ),
              },
            ]}
            rows={payments.recent}
          />
        </div>
      )}
    </Section>
  );
}

export default function AdminSystemHealth() {
  const { admin } = useAdmin();
  const canSeePayments = Boolean(admin?.permissions?.['payments.read']);

  const [health, setHealth] = useState(null);
  const [payments, setPayments] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, e] = await Promise.all([fetchSystemHealth(), fetchOpsEvents({ limit: 40 })]);
      setHealth(h);
      setEvents(e.events || []);
      if (canSeePayments) {
        try {
          setPayments(await fetchPaymentHealth());
        } catch {
          setPayments(null);
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [canSeePayments]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="System health" description="Running checks…" />
        <SkeletonRows rows={8} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title="System health" />
        <AdminApiError error={error} onRetry={load} />
      </div>
    );
  }
  if (!health) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="System health"
        description={`Checked ${formatDateTime(health.computedAt)}. ${health.note}`}
        actions={
          <button type="button" onClick={load} className="btn-outline !px-2.5 flex items-center gap-1.5 text-button">
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Re-check
          </button>
        }
      />

      <Section title="Indicators" hint="Each one is a check that actually ran, with the evidence it ran on.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {health.indicators.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </Section>

      {canSeePayments && <PaymentHealth payments={payments} />}

      <Section
        title="Operational events"
        hint="Meaningful failures and security events only. On a healthy platform this list is nearly empty."
      >
        {events.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No operational events recorded"
            description="Nothing worth recording has failed. Webhook rejections, undeliverable emails and server errors would appear here."
          />
        ) : (
          <DataTable
            mobileLayout="row"
            columns={[
              { key: 'createdAt', header: 'When', primary: true, render: (e) => formatDateTime(e.createdAt) },
              {
                key: 'severity', header: 'Severity', mobileTrailing: true,
                render: (e) => <StatusPill tone={SEVERITY_TONE[e.severity] || 'neutral'}>{e.severity}</StatusPill>,
              },
              { key: 'type', header: 'Type', render: (e) => <span className="num text-ink-600">{e.type}</span> },
              { key: 'message', header: 'What happened', render: (e) => e.message },
              { key: 'source', header: 'Source', render: (e) => e.source || '-' },
              { key: 'businessId', header: 'Business', render: (e) => (e.businessId ? <span className="num text-ink-500">{e.businessId}</span> : '-') },
            ]}
            rows={events}
          />
        )}
      </Section>

      <Section
        title="What FlowBiz cannot see from here"
        hint="Listed deliberately: a monitoring page that hides its blind spots is claiming coverage it does not have."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {health.unobservable.map((item) => (
            <div key={item.label} className="rounded-panel border border-dashed border-line bg-surface p-4">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
                <h3 className="text-section-title">{item.label}</h3>
              </div>
              <p className="mt-1.5 text-cell text-ink-600">{item.reason}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

