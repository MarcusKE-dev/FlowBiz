// src/pages/admin/AdminSupportMode.jsx
//
// Support mode: the read-only landing an administrator gets when they say
// "I'm helping this shop right now".
//
// It used to be a set of simulated FlowBiz screens — a fake POS counter, a
// fake inventory panel — rendering four aggregate numbers and a disabled
// Checkout button. That was a mock-up of the merchant app, not a support
// tool: nothing on it could answer a real support question, because none
// of the actual records were reachable from it.
//
// It is now a router into the Business Inspector, which holds the real
// records. Entering support mode still calls the same endpoint it always
// did, which is what writes the ENTER_SUPPORT_MODE entry into the audit
// trail — that behaviour is deliberately unchanged. What changed is that
// the page now sends a support agent somewhere useful, and every figure on
// it is one the server actually measured.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldAlert, Package, ShoppingCart, Users, BookOpen, Boxes,
  Smartphone, Gauge, ArrowRight,
} from 'lucide-react';
import { enterSupportSession, fetchAdminBusinessDetail } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import PageHeader from '../../components/ui/PageHeader';
import Section from '../../components/ui/Section';
import MetricRail, { Metric } from '../../components/ui/MetricRail';
import StatusPill from '../../components/ui/StatusPill';
import { formatDateTime } from '../../utils/dateRanges';

// The questions support actually gets asked, each pointing at the tab
// that answers it.
const ROUTES = [
  {
    tab: 'customers', icon: Users,
    question: '“I can’t find my customer.”',
    answer: 'Search the shop’s customer book by name, phone or customer code.',
  },
  {
    tab: 'credits', icon: BookOpen,
    question: '“How much does this customer owe me?”',
    answer: 'Every credit sale with what has been paid and what is still owed.',
  },
  {
    tab: 'products', icon: Package,
    question: '“My products aren’t showing.”',
    answer: 'The catalogue as stored, including items marked deleted or out of stock.',
  },
  {
    tab: 'stock', icon: Boxes,
    question: '“My inventory looks wrong.”',
    answer: 'Stock-take adjustments: system count, physical count and the difference.',
  },
  {
    tab: 'sales', icon: ShoppingCart,
    question: '“What happened with yesterday’s sale?”',
    answer: 'The sales log, filtered by date, with tender, cashier and M-Pesa code.',
  },
  {
    tab: 'sessions', icon: Smartphone,
    question: '“Why isn’t my shop syncing?”',
    answer: 'Registered devices and when each one last reached Firestore.',
  },
  {
    tab: 'usage', icon: Gauge,
    question: '“How much storage are my photos using?”',
    answer: 'Counts, image storage and inventory value, measured on demand.',
  },
];

function n(value) {
  return typeof value === 'number' ? value.toLocaleString('en-KE') : '-';
}

export default function AdminSupportMode() {
  const { businessId } = useParams();

  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      enterSupportSession(businessId),
      fetchAdminBusinessDetail(businessId),
    ])
      .then(([sess, detail]) => {
        if (!alive) return;
        setSession(sess);
        setData(detail);
      })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [businessId]);

  if (loading) return <LoadingSpinner label="Opening support mode…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const { business, settings, metrics, usage } = data;
  const shopName = settings.shopName || business.name || 'Unnamed business';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-2.5 rounded-panel border border-warning-300 bg-warning-50 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" strokeWidth={1.75} />
        <div className="min-w-0 text-cell text-warning-800">
          <p className="font-semibold text-warning-900">Read-only support session</p>
          <p className="mt-0.5">
            Nothing in the Inspector can change this shop’s data. The account actions that can
            (plan changes, suspension, owner emails) live on the Overview tab behind their own
            permission checks and confirmations.
            {session?.issuedAt && ` Session opened ${formatDateTime(session.issuedAt)} and recorded in the audit trail.`}
          </p>
        </div>
      </div>

      <PageHeader
        title={shopName}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num text-ink-600">{businessId}</span>
            {settings.phone && <><span className="text-ink-300">·</span><span>{settings.phone}</span></>}
            {settings.email && <><span className="text-ink-300">·</span><span>{settings.email}</span></>}
          </span>
        }
        actions={
          <>
            <StatusPill tone={business.effectivePlan === 'free' ? 'neutral' : 'info'}>
              {(business.effectivePlan || 'free').toUpperCase()}
            </StatusPill>
            <Link to={`/admin/businesses/${businessId}`} className="btn-primary !px-3 text-button">
              Open full inspector
            </Link>
          </>
        }
      />

      <MetricRail columns={4}>
        <Metric label="Products" value={n(metrics.productsCount)} hint={`${n(metrics.lowStockCount)} low, ${n(metrics.outOfStockCount)} out`} />
        <Metric label="Sales recorded" value={n(metrics.salesCount)} hint="All time" />
        <Metric
          label="Outstanding credit"
          prefix="KES"
          value={typeof metrics.totalOutstandingDebt === 'number'
            ? metrics.totalOutstandingDebt.toLocaleString('en-KE', { maximumFractionDigits: 0 })
            : '-'}
          hint={`${n(metrics.customersCount)} customers`}
        />
        <Metric
          label="Last activity"
          value={usage?.sync?.quietDays === null || usage?.sync?.quietDays === undefined
            ? '-'
            : usage.sync.quietDays === 0 ? 'Today' : `${usage.sync.quietDays}d ago`}
          hint={`${usage?.sync?.activeDevices ?? 0} active device${usage?.sync?.activeDevices === 1 ? '' : 's'}`}
        />
      </MetricRail>

      <Section
        title="What are they asking about?"
        hint="Each of these opens the Inspector on the tab that holds the actual records."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROUTES.map(({ tab, icon: Icon, question, answer }) => (
            <Link
              key={tab}
              to={`/admin/businesses/${businessId}?tab=${tab}`}
              className="group rounded-panel border border-line bg-surface p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
            >
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-section-title text-ink-900">{question}</p>
                  <p className="mt-1 text-cell text-ink-600">{answer}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-cell text-primary-700">
                    Open <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
