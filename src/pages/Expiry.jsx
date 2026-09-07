// src/pages/Expiry.jsx
//
// What is expiring, what has expired, and what it is worth.
//
// This is the page a pharmacy opens first in the morning, so it answers
// the three questions in that order and stops. There is no disposal
// workflow, no quarantine state and no returns-to-supplier flow: writing
// expired stock off is a stock take, which FlowBiz already has and which
// already leaves an auditable adjustment record. Inventing a second way
// to remove stock would mean two ledgers to reconcile.
//
// The page is reachable at its URL whatever the profile — see AppRouter —
// but it is only OFFERED in the navigation when batch tracking is on.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import { AlertTriangle, PackageCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIndustry } from '../hooks/useIndustry';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import MetricRail, { Metric } from '../components/ui/MetricRail';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import StatusPill from '../components/ui/StatusPill';
import Money from '../components/ui/Money';
import SegmentedControl from '../components/ui/SegmentedControl';
import { amountOnly } from '../components/ui/format';
import { formatQuantityWithUnit } from '../industry/units';
import {
  summarizeExpiry, todayISO, DEFAULT_EXPIRY_WARNING_DAYS, EXPIRY_STATUS,
} from '../utils/batches';

const WINDOWS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
];

const TONE = {
  [EXPIRY_STATUS.EXPIRED]: 'negative',
  [EXPIRY_STATUS.EXPIRING]: 'caution',
  [EXPIRY_STATUS.OK]: 'positive',
  [EXPIRY_STATUS.UNKNOWN]: 'neutral',
};

function BatchTable({ rows, caption, empty }) {
  return (
    <DataTable
      bleed
      caption={caption}
      rows={rows}
      rowKey={(b) => b.id}
      mobileLayout="row"
      columns={[
        { key: 'productName', header: 'Item', primary: true, render: (b) => b.productName || '-' },
        {
          key: 'batchNumber', header: 'Batch',
          render: (b) => <span className="font-mono text-secondary text-ink-600">{b.batchNumber || '-'}</span>,
        },
        {
          key: 'expiryDate', header: 'Expires', mobileTrailing: true,
          render: (b) => (
            <span className="inline-flex items-center gap-2">
              <span className="num text-ink-800">{b.expiryDate || 'Not recorded'}</span>
              {b.daysToExpiry !== null && (
                <StatusPill tone={TONE[b.status]}>
                  {b.daysToExpiry < 0
                    ? `${Math.abs(b.daysToExpiry)}d ago`
                    : b.daysToExpiry === 0 ? 'Today' : `${b.daysToExpiry}d`}
                </StatusPill>
              )}
            </span>
          ),
        },
        {
          key: 'remaining', header: 'Left', numeric: true, mobileTrailing: true,
          render: (b) => (
            <span className="num font-semibold text-ink-900">
              {formatQuantityWithUnit(b.remaining, b.unit, { showPiece: true })}
            </span>
          ),
        },
        {
          key: 'value', header: 'At cost', numeric: true,
          render: (b) => <Money value={(b.remaining || 0) * (b.costPrice || 0)} tone="muted" />,
        },
        { key: 'supplierName', header: 'From', render: (b) => <span className="text-ink-600">{b.supplierName || '-'}</span> },
      ]}
      empty={empty}
    />
  );
}

export default function Expiry() {
  const { businessId } = useAuth();
  const industry = useIndustry();
  const [warningDays, setWarningDays] = useState(DEFAULT_EXPIRY_WARNING_DAYS);

  const batchesQ = useMemo(
    () => (businessId ? tenantQuery('productBatches', businessId, orderBy('expiryDate', 'asc')) : null),
    [businessId]
  );
  const productsQ = useMemo(() => (businessId ? tenantQuery('products', businessId) : null), [businessId]);
  const { data: batches, loading } = useFirestoreCollection(batchesQ);
  const { data: products } = useFirestoreCollection(productsQ);

  const summary = useMemo(
    () => summarizeExpiry(batches, products, { today: todayISO(), warningDays }),
    [batches, products, warningDays]
  );

  if (loading) return <LoadingSpinner label="Loading batches…" />;

  if (!industry.can('batches')) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={PackageCheck}
          title="Batch tracking is off"
          description="Set this business to Pharmacy under Settings to turn it on. Batches already recorded are kept."
        />
      </div>
    );
  }

  return (
    // Full width. The tables and strips below run to the edge of the
    // content area, which a centred column would stop short of; the
    // 1800px ceiling lives in AppShell so every page shares one.
    <div className="space-y-6">
      <PageHeader
        title="Expiry"
        description="Stock is always sold earliest-expiry-first, and anything past its date is never picked."
        actions={
          <SegmentedControl
            ariaLabel="Warning window"
            value={warningDays}
            onChange={setWarningDays}
            options={WINDOWS}
          />
        }
      />

      <MetricRail columns={4} bleed>
        <Metric label="Expired batches" value={summary.expiredCount} />
        <Metric label="Value expired" prefix="KES" value={amountOnly(summary.expiredValue)} />
        <Metric label="Expiring soon" value={summary.expiringCount} />
        <Metric label="Value at risk" prefix="KES" value={amountOnly(summary.expiringValue)} />
      </MetricRail>

      {summary.expiredCount > 0 && (
        <Section
          title="Expired"
          tone="danger"
          hint="Never offered at the counter. Take them off the shelf and write them off with a stock take."
        >
          <BatchTable rows={summary.expired} caption="Expired batches still holding stock" />
          <p className="text-secondary text-ink-500">
            <Link to="/stock-take" className="font-medium text-primary-700 hover:underline">Go to stock take</Link>
            {' '}to count them out. That leaves an adjustment record, which a write-off should.
          </p>
        </Section>
      )}

      <Section title={`Expiring within ${warningDays} days`}>
        <BatchTable
          rows={summary.expiring}
          caption="Batches approaching their expiry date"
          empty={
            <EmptyState
              icon={PackageCheck}
              title="Nothing expiring in this window"
              description="Widen the window above to look further ahead."
            />
          }
        />
      </Section>

      {summary.unknown.length > 0 && (
        <Section
          title="No expiry recorded"
          hint="These were received without a date. They are sold last, after everything with a known date."
        >
          <BatchTable rows={summary.unknown} caption="Batches with no expiry date" />
        </Section>
      )}

      <Section title="In date" hint={`More than ${warningDays} days of shelf life left.`}>
        <BatchTable
          rows={summary.ok}
          caption="Batches comfortably in date"
          empty={
            <EmptyState
              icon={AlertTriangle}
              title="No batches recorded yet"
              description="Batches are created when you receive stock under Purchases."
            />
          }
        />
      </Section>
    </div>
  );
}
