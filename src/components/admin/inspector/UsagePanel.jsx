// src/components/admin/inspector/UsagePanel.jsx
//
// The Usage tab for one business: how many documents it holds, how much
// image storage it uses, what its inventory is worth, and when it last
// reached the cloud.
//
// Every figure is rendered with its PROVENANCE attached, because the
// difference between "Firestore counted this" and "we worked it out" is
// the difference between a fact and an opinion — and the difference
// between both of those and "this is your Firebase bill" is the whole
// reason the legend at the bottom exists. Nothing on this page is a bill,
// and it says so.

import { Database, Radio, Info } from 'lucide-react';
import MetricRail, { Metric } from '../../ui/MetricRail';
import StatementBlock, { StatementRow, StatementResult } from '../../ui/StatementBlock';
import StatusPill from '../../ui/StatusPill';
import Section from '../../ui/Section';
import AdminApiError from '../AdminApiError';
import Money from '../../ui/Money';
import { SkeletonRows } from '../../ui/Skeleton';
import { formatDateTime } from '../../../utils/dateRanges';

const SOURCE_LABEL = {
  measured: 'Measured',
  derived: 'Derived',
  estimated: 'Estimated',
};

const SOURCE_TONE = {
  measured: 'info',
  derived: 'neutral',
  estimated: 'caution',
};

export function SourceTag({ source }) {
  if (!source) return null;
  return <StatusPill tone={SOURCE_TONE[source] || 'neutral'}>{SOURCE_LABEL[source] || source}</StatusPill>;
}

export function formatBytes(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function num(metric) {
  if (!metric || !metric.available || metric.value === null) return '-';
  return Number(metric.value).toLocaleString('en-KE');
}

function CountRow({ label, metric, hint }) {
  return (
    <StatementRow
      label={label}
      value={num(metric)}
      hint={metric?.capped ? 'capped' : hint}
      tone={metric?.available ? 'default' : 'muted'}
    />
  );
}

export default function UsagePanel({ usage, computedAt, loading, error, onReload }) {
  if (loading) return <SkeletonRows rows={8} />;

  if (error) return <AdminApiError error={error} onRetry={onReload} />;

  // No usage block at all means the business-detail endpoint answered
  // without one — an older Worker. Say so instead of rendering blank.
  if (!usage) {
    return <AdminApiError error={{ apiOutdated: true, message: 'The business detail response contained no usage block.' }} onRetry={onReload} />;
  }

  const { counts, money, inventory, images, sync, documentFootprint } = usage;
  const quiet = sync?.quietDays;

  return (
    <div className="space-y-6">
      <MetricRail columns={4}>
        <Metric label="Products" value={num(counts.products)} hint="Catalogue size" />
        <Metric label="Customers" value={num(counts.customers)} hint="Customer book" />
        <Metric label="Sales recorded" value={num(counts.sales)} hint="All time" />
        <Metric
          label="Image storage"
          value={images?.available ? formatBytes(images.totalBytes.value) : '-'}
          hint={images?.available ? `${num(images.imageCount)} photos` : 'Not measured'}
        />
      </MetricRail>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Document counts"
          hint="Counted live by Firestore. No counters or telemetry are stored."
        >
          <StatementBlock>
            <CountRow label="Products" metric={counts.products} />
            <CountRow label="Customers" metric={counts.customers} />
            <CountRow label="Suppliers" metric={counts.suppliers} />
            <CountRow label="Sales" metric={counts.sales} />
            <CountRow label="Credit sales" metric={counts.creditSales} />
            <CountRow label="Expenses" metric={counts.expenses} />
            <CountRow label="Purchases" metric={counts.purchases} />
            <CountRow label="Stock adjustments" metric={counts.stockAdjustments} />
            <CountRow label="Shared documents" metric={counts.sharedDocuments} />
            <CountRow label="Device sessions" metric={counts.sessions} />
            <CountRow label="Product photos" metric={images?.imageCount} />
            <StatementResult
              label="Total documents counted"
              value={num(documentFootprint)}
              tone="info"
            />
          </StatementBlock>
          <p className="section-hint flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={1.75} />
            A storage-footprint proxy for this business's own data. It is not a billed figure and excludes indexes and metadata.
          </p>
        </Section>

        <div className="space-y-6">
          <Section
            title="Volume"
            hint="Usage signals only. The merchant's own reports remain the authority on their money."
          >
            <StatementBlock>
              <StatementRow
                label="Gross sales volume"
                value={money.grossSalesVolume.available ? <Money value={money.grossSalesVolume.value} /> : '-'}
                hint="voided included"
              />
              <StatementRow
                label="Outstanding credit"
                value={money.outstandingCredit.available ? <Money value={money.outstandingCredit.value} /> : '-'}
                tone={Number(money.outstandingCredit.value) > 0 ? 'negative' : 'default'}
              />
              <StatementRow
                label="Expenses recorded"
                value={money.expenseTotal.available ? <Money value={money.expenseTotal.value} /> : '-'}
              />
            </StatementBlock>
          </Section>

          <Section
            title="Inventory"
            hint={inventory?.note || 'Computed from the product catalogue.'}
          >
            {inventory?.error ? (
              <p className="text-cell text-ink-500">Inventory value could not be computed.</p>
            ) : (
              <StatementBlock>
                <StatementRow label="Active products" value={num(inventory.activeProducts)} />
                <StatementRow label="Low stock" value={num(inventory.lowStockCount)} tone="muted" />
                <StatementRow label="Out of stock" value={num(inventory.outOfStockCount)} tone="negative" />
                <StatementRow
                  label="Stock at cost"
                  value={<Money value={inventory.inventoryCost?.value} />}
                  strong
                />
                <StatementRow
                  label="Stock at retail"
                  value={<Money value={inventory.inventoryRetail?.value} />}
                />
              </StatementBlock>
            )}
          </Section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Product image storage"
          hint={images?.note}
        >
          {!images?.available ? (
            <p className="text-cell text-ink-500">Image storage could not be measured.</p>
          ) : (
            <>
              <StatementBlock>
                <StatementRow label="Photos stored" value={num(images.imageCount)} />
                <StatementRow label="Average size" value={formatBytes(images.averageBytes.value)} />
                <StatementResult label="Total stored" value={formatBytes(images.totalBytes.value)} tone="info" />
              </StatementBlock>
              {images.recentUploads?.length > 0 && (
                <div className="rounded-panel border border-line bg-surface divide-y divide-divider">
                  {images.recentUploads.map((img) => (
                    <div key={img.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="num min-w-0 truncate text-cell text-ink-700">{img.productId}</span>
                      <span className="num shrink-0 text-cell text-ink-500">{formatBytes(img.bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          title="Activity & synchronisation"
          hint={sync?.note}
        >
          <StatementBlock>
            <StatementRow
              label="Last device heartbeat"
              value={sync?.lastSessionActivityAt ? formatDateTime(sync.lastSessionActivityAt) : '-'}
            />
            <StatementRow
              label="Last recorded sale"
              value={sync?.lastSaleAt ? formatDateTime(sync.lastSaleAt) : '-'}
            />
            <StatementRow label="Active devices" value={sync?.activeDevices ?? '-'} />
            <StatementRow label="Revoked devices" value={sync?.revokedDevices ?? '-'} tone="muted" />
            <StatementResult
              label={quiet === null || quiet === undefined ? 'No activity on record' : `Quiet for ${quiet} day${quiet === 1 ? '' : 's'}`}
              value={quiet === null || quiet === undefined ? '-' : quiet}
              tone={quiet === null || quiet === undefined ? 'neutral' : quiet >= 30 ? 'caution' : 'info'}
            />
          </StatementBlock>
        </Section>
      </div>

      <div className="rounded-panel border border-line bg-surface p-4">
        <h3 className="section-title flex items-center gap-2">
          <Database className="h-4 w-4 text-ink-400" strokeWidth={1.75} /> Where these numbers come from
        </h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-2 text-label uppercase text-ink-500">
              <SourceTag source="measured" />
            </dt>
            <dd className="mt-1 text-cell text-ink-600">
              Counted or summed by Firestore over real FlowBiz documents at the time shown.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-label uppercase text-ink-500">
              <SourceTag source="derived" />
            </dt>
            <dd className="mt-1 text-cell text-ink-600">
              Worked out by FlowBiz from measured values: inventory value, averages, totals.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-label uppercase text-ink-500">
              <StatusPill tone="negative">No provider data</StatusPill>
            </dt>
            <dd className="mt-1 text-cell text-ink-600">
              FlowBiz holds no Google Cloud Billing credential. Nothing here is a Firebase bill, and no shilling cost is inferred from these counts.
            </dd>
          </div>
        </dl>
        {computedAt && (
          <p className="mt-3 flex items-center gap-1.5 text-label text-ink-400">
            <Radio className="h-3 w-3" strokeWidth={1.75} />
            Measured {formatDateTime(computedAt)}. Refresh to re-measure.
          </p>
        )}
      </div>
    </div>
  );
}
