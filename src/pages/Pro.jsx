import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Section from '../../components/layout/Section';
import StatusPill from '../../components/ui/StatusPill';
import LicensingPanel from '../../components/billing/LicensingPanel';
import BillingHistory from '../../components/billing/BillingHistory';
import { useAuth } from '../../contexts/AuthContext';
import { usePricing } from '../../hooks/usePricing';
import { useLicensingCheckout } from '../../hooks/useLicensingCheckout';
import { isDemoMode } from '../../demo/demoMode';
import {
  PRO_PLAN_PRICE_KES,
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES as SERVICE_PRICE_PER_YEAR,
} from '../../config/licensing';
import {
  Check,
  X,
  BarChart3,
  Boxes,
  Image,
  MessageCircle,
  ArrowLeft,
} from 'lucide-react';

const FEATURE_CATEGORIES = [
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'See trends, profit, expenses, payment mix, debtors, and staff performance.',
  },
  {
    icon: Boxes,
    title: 'Inventory Intelligence',
    description: 'Understand stock value, capital health, ABC analysis, and reorder needs.',
  },
  {
    icon: Image,
    title: 'Product Photos',
    description: 'Add product photos to make products easier to identify and sell.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Sharing',
    description: 'Share receipts, invoices, and debt reminders directly with customers.',
  },
];

const COMPARISON_ROWS = [
  { label: 'Products tracked', free: 'Up to 100', pro: 'Unlimited' },
  { label: 'Staff members', free: '1 owner + 1 staff', pro: 'Unlimited' },
  { label: 'Sales, credit & expense tracking', free: true, pro: true },
  { label: 'PDF receipts & invoices', free: true, pro: true },
  { label: 'Product photos', free: false, pro: true },
  { label: 'Advanced Analytics (trends, staff, day-of-week)', free: false, pro: true },
  { label: 'Inventory Intelligence & Capital Health', free: false, pro: true },
  { label: 'Reorder suggestions & ABC value analysis', free: false, pro: true },
  { label: 'WhatsApp receipt & invoice sharing', free: false, pro: true },
];

function FeatureCheck({ value }) {
  if (value === true) {
    return (
      <Check
        className="mx-auto h-5 w-5 text-primary-600"
        aria-label="Included"
      />
    );
  }

  if (value === false) {
    return (
      <X
        className="mx-auto h-5 w-5 text-ink-300"
        aria-label="Not included"
      />
    );
  }

  return <span className="text-body text-ink-700">{value}</span>;
}

function LifetimeCard({ onPurchase, loading }) {
  return (
    <div className="rounded-2xl border-2 border-deep-600 bg-white p-6 shadow-sm">
      <StatusPill tone="neutral" className="mb-4">
        Lifetime licence
      </StatusPill>

      <div className="text-3xl font-bold tracking-tight text-ink-900">
        KES {LIFETIME_LICENSE_PRICE_KES.toLocaleString()}
      </div>

      <p className="mt-1 text-sm text-ink-500">
        One time
      </p>

      <p className="mt-5 text-sm font-medium text-ink-800">
        Own the FlowBiz software licence permanently.
      </p>

      <div className="mt-4 space-y-2 text-sm text-ink-600">
        <p>
          KES {SERVICE_PRICE_PER_YEAR.toLocaleString()}/year from year two
        </p>
        <p>Cloud services, maintenance, updates & support</p>
        <p>First year included</p>
      </div>

      <button
        type="button"
        onClick={onPurchase}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-deep-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-deep-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Processing...' : 'Get Lifetime Licence'}
      </button>
    </div>
  );
}

export default function Pro() {
  const { isAdmin, isPro, profile } = useAuth();
  const { pricing } = usePricing();
  const { startCheckout, loading } = useLicensingCheckout();
  const demo = isDemoMode();

  const proPrice =
    pricing?.pro?.priceKes ?? PRO_PLAN_PRICE_KES;

  const handleProCheckout = () => {
    startCheckout('pro');
  };

  const handleLifetimeCheckout = () => {
    startCheckout('lifetime');
  };

  return (
    <div className="min-h-full bg-canvas">
      <PageHeader
        title="FlowBiz Pro"
        description="More tools for businesses that need more from FlowBiz."
      />

      <div className="px-4 pb-10 sm:px-6">
        {demo ? (
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl border border-line bg-white p-6">
              <StatusPill tone="caution" solid>
                Demo
              </StatusPill>

              <h2 className="mt-4 text-xl font-semibold text-ink-900">
                FlowBiz Pro
              </h2>

              <p className="mt-2 text-sm text-ink-600">
                You're viewing the Pro page in demo mode. Sign up to access
                FlowBiz plans and licensing.
              </p>

              <div className="mt-5">
                <Link to="/setup" className="btn-primary">
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            {isAdmin && isPro ? (
              <>
                <div className="mb-8">
                  <LicensingPanel />
                </div>

                <BillingHistory />
              </>
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
                    <StatusPill tone="neutral" className="mb-4">
                      Pro
                    </StatusPill>

                    <div className="text-3xl font-bold tracking-tight text-ink-900">
                      KES {proPrice.toLocaleString()}
                    </div>

                    <p className="mt-1 text-sm text-ink-500">
                      / 30 days
                    </p>

                    <p className="mt-4 text-sm text-ink-600">
                      Manual renewal, no automatic billing.
                    </p>

                    <button
                      type="button"
                      onClick={handleProCheckout}
                      disabled={loading}
                      className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Processing...' : 'Get Pro'}
                    </button>
                  </div>

                  <LifetimeCard
                    onPurchase={handleLifetimeCheckout}
                    loading={loading}
                  />
                </div>

                <div className="mt-10">
                  <Section
                    title="What's included in Pro"
                    description="Tools that help you understand your business and manage it more effectively."
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {FEATURE_CATEGORIES.map((feature) => {
                        const Icon = feature.icon;

                        return (
                          <div
                            key={feature.title}
                            className="rounded-2xl border border-line bg-white p-5"
                          >
                            <Icon className="h-6 w-6 text-primary-600" />

                            <h3 className="mt-4 text-sm font-semibold text-ink-900">
                              {feature.title}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-ink-600">
                              {feature.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                </div>

                <div className="mt-10">
                  <Section
                    title="Compare plans"
                    description="See what is included in Starter and Pro."
                  >
                    <div className="overflow-hidden rounded-2xl border border-line bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-line bg-canvas">
                              <th className="px-5 py-4 text-left font-semibold text-ink-900">
                                Feature
                              </th>
                              <th className="px-5 py-4 text-center font-semibold text-ink-900">
                                Starter
                              </th>
                              <th className="px-5 py-4 text-center font-semibold text-ink-900">
                                Pro
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {COMPARISON_ROWS.map((row) => (
                              <tr
                                key={row.label}
                                className="border-b border-line last:border-b-0"
                              >
                                <td className="px-5 py-4 text-ink-700">
                                  {row.label}
                                </td>

                                <td className="px-5 py-4 text-center">
                                  <FeatureCheck value={row.free} />
                                </td>

                                <td className="px-5 py-4 text-center">
                                  <FeatureCheck value={row.pro} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Section>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-ink-700 hover:text-ink-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>

                  <p className="text-sm text-ink-500">
                    Built for Kenyan businesses. Pay in KES via M-Pesa or card,
                    powered by Paystack.
                  </p>
                </div>
              </>
            )}

            {profile && !isPro && (
              <div className="mt-8">
                <BillingHistory />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}