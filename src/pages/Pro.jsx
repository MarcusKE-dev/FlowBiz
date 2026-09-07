// src/pages/Pro.jsx

import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import Section from '../components/ui/Section';
import StatusPill from '../components/ui/StatusPill';
import LicensingPanel from '../components/licensing/LicensingPanel';
import BillingHistory from '../components/licensing/BillingHistory';
import { useAuth } from '../contexts/AuthContext';
import { usePricing } from '../hooks/usePricing';
import { useLicensingCheckout } from '../hooks/useLicensingCheckout';
import { isDemoMode } from '../demo/demoMode';
import {
  formatPrice,
  LIFETIME_PLAN_ID,
  PRO_PLAN_ID,
} from '../licensing';
import { SERVICE_PRICE_PER_YEAR } from '../components/licensing/licensingCopy';
import LifetimeDisclosure from '../components/licensing/LifetimeDisclosure';
import {
  SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, SUPPORT_WHATSAPP_LABEL, whatsappHref,
} from '../lib/support';
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
    description:
      'Understand revenue, profit, expenses, payment mix and staff performance.',
  },
  {
    icon: Boxes,
    title: 'Inventory Intelligence',
    description:
      'See stock health, ABC analysis, reorder suggestions and slow-moving stock.',
  },
  {
    icon: Image,
    title: 'Product Photos',
    description:
      'Add product images to your catalogue and display them across the POS.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Sharing',
    description:
      'Send receipts, invoices and debt reminders directly to customers.',
  },
];

const COMPARISON_ROWS = [
  { label: 'Products tracked', free: 'Up to 100', pro: 'Unlimited' },
  { label: 'Staff members', free: '1 owner + 1 staff', pro: 'Unlimited' },
  {
    label: 'Sales, credit & expense tracking',
    free: true,
    pro: true,
  },
  {
    label: 'PDF receipts & invoices',
    free: true,
    pro: true,
  },
  {
    label: 'Product photos',
    free: false,
    pro: true,
  },
  {
    label: 'Advanced Analytics',
    free: false,
    pro: true,
  },
  {
    label: 'Inventory Intelligence & Capital Health',
    free: false,
    pro: true,
  },
  {
    label: 'Reorder suggestions & ABC value analysis',
    free: false,
    pro: true,
  },
  {
    label: 'WhatsApp receipt & invoice sharing',
    free: false,
    pro: true,
  },
];

function FeatureCheck({ included }) {
  return included ? (
    <Check
      className="mx-auto h-4 w-4 text-ink-900"
      strokeWidth={1.75}
      aria-label="Included"
    />
  ) : (
    <X
      className="mx-auto h-4 w-4 text-ink-400"
      strokeWidth={1.75}
      aria-label="Not included"
    />
  );
}

function LifetimeCard({
  lifetimePrice,
  servicePrice,
  loadingPlan,
  startCheckout,
}) {
  return (
    <div className="relative flex flex-col rounded-panel border border-deep-600 bg-surface p-6">
      <span className="absolute -top-2.5 right-6 rounded-pill bg-deep-600 px-2.5 py-0.5 text-label font-semibold text-white">
        One-time licence
      </span>

      <div className="flex-1">
        <p className="text-label uppercase text-ink-500">
          Lifetime Licence
        </p>

        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="num text-money font-semibold text-ink-900 sm:text-[1.75rem] sm:leading-[2.25rem]">
            {lifetimePrice != null ? formatPrice(lifetimePrice) : '…'}
          </span>

          <span className="text-secondary text-ink-500">
            one time
          </span>
        </p>

        <p className="mt-2 text-body font-semibold text-ink-900">
          Own the FlowBiz software licence permanently.
        </p>

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-body font-semibold text-ink-900">
            {servicePrice != null
              ? formatPrice(servicePrice)
              : SERVICE_PRICE_PER_YEAR}
            /year from year two
          </p>

          <p className="mt-0.5 text-secondary text-ink-500">
            Cloud services, maintenance, updates &amp; support
          </p>
        </div>
      </div>

      {/* ABOVE THE BUTTON, DELIBERATELY. A customer has to be able to
          read what happens in year two before they can commit to year
          one — see LifetimeDisclosure.jsx and legalLinks.test.js. */}
      <div className="mt-6">
        <LifetimeDisclosure />
      </div>

      <button
        onClick={() => startCheckout(LIFETIME_PLAN_ID)}
        disabled={Boolean(loadingPlan)}
        className="mt-4 w-full rounded-panel bg-deep-600 py-3 text-body font-bold text-white transition-colors hover:bg-deep-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loadingPlan === LIFETIME_PLAN_ID
          ? 'Loading…'
          : `Buy the Lifetime Licence${
              lifetimePrice != null
                ? ` for ${formatPrice(lifetimePrice)}`
                : ''
            }`}
      </button>
    </div>
  );
}

export default function Pro() {
  const { isPro, isLifetime, subscription } = useAuth();
  const { pricing } = usePricing();
  const { startCheckout, loadingPlan } = useLicensingCheckout();
  const demo = isDemoMode();

  const lifetimePrice = pricing.lifetime?.amountKes;
  const servicePrice = pricing.annualServices?.amountKes;
  const proPrice = pricing.pro?.amountKes;

  const expiresLabel = subscription?.expiresAt
    ? new Date(
        subscription.expiresAt.toMillis
          ? subscription.expiresAt.toMillis()
          : subscription.expiresAt
      ).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <PageHeader
        title={isLifetime ? 'Licence and services' : 'FlowBiz Pro'}
        description={
          isLifetime
            ? 'Manage your FlowBiz licence and annual services.'
            : 'More insight into your margins, stock and staff, plus WhatsApp receipts.'
        }
        actions={
          <Link to="/" className="btn-secondary">
            <ArrowLeft
              className="h-4 w-4"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Dashboard
          </Link>
        }
      />

      {demo ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <StatusPill tone="positive">
              Pro is active in this demo
            </StatusPill>

            <p className="max-w-sm text-body text-ink-600">
              Every Pro feature is unlocked for this demo account. Explore
              analytics, inventory intelligence, product photos and WhatsApp
              sharing freely.
            </p>
          </div>
        </div>
      ) : isLifetime ? (
        <>
          <LicensingPanel />
          <BillingHistory />
        </>
      ) : (
        <div className="space-y-6">
          {/* Pricing options */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Monthly Pro */}
            <div className="flex flex-col rounded-panel border border-line bg-surface p-6">
              <div className="flex-1">
                <p className="text-label uppercase text-ink-500">
                  FlowBiz Pro
                </p>

                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="num text-money font-semibold text-ink-900 sm:text-[1.75rem] sm:leading-[2.25rem]">
                    {proPrice != null
                      ? formatPrice(proPrice)
                      : '…'}
                  </span>

                  <span className="text-secondary text-ink-500">
                    / 30 days
                  </span>
                </p>

                <p className="mt-3 text-body text-ink-600">
                  Get Pro features with a simple prepaid subscription.<br/>
                  Manual renewal, no automatic billing.

                </p>
              </div>

              {isPro ? (
                <div className="mt-6 flex flex-col items-start gap-3">
                  <StatusPill tone="positive">
                    Pro is active
                  </StatusPill>

                  {expiresLabel && (
                    <p className="text-secondary text-ink-500">
                      Expires on {expiresLabel}
                    </p>
                  )}

                  <button
                    onClick={() => startCheckout(PRO_PLAN_ID)}
                    disabled={Boolean(loadingPlan)}
                    className="btn-secondary"
                  >
                    {loadingPlan === PRO_PLAN_ID
                      ? 'Loading…'
                      : 'Extend subscription'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startCheckout(PRO_PLAN_ID)}
                  disabled={Boolean(loadingPlan)}
                  className="btn-primary mt-6 w-full"
                >
                  {loadingPlan === PRO_PLAN_ID
                    ? 'Loading…'
                    : 'Upgrade to Pro'}
                </button>
              )}
            </div>

            {/* Lifetime Licence */}
            <LifetimeCard
              lifetimePrice={lifetimePrice}
              servicePrice={servicePrice}
              loadingPlan={loadingPlan}
              startCheckout={startCheckout}
            />
          </div>

          <BillingHistory />
        </div>
      )}

      {/* Pro feature overview */}
      <Section title="What's included with Pro">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CATEGORIES.map(
            ({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="space-y-2 rounded-panel border border-line bg-surface p-5"
              >
                <div className="text-ink-500">
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>

                <h4 className="font-display text-body font-bold text-ink-900">
                  {title}
                </h4>

                <p className="text-secondary leading-relaxed text-ink-500">
                  {description}
                </p>
              </div>
            )
          )}
        </div>
      </Section>

      {/* Comparison */}
      <Section title="Free compared with Pro">
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-cell">
              <thead className="border-b border-line text-left text-label uppercase text-ink-500">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-2"
                  >
                    Feature
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-2 text-center"
                  >
                    Free
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-2 text-center"
                  >
                    Pro &amp; Lifetime
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 font-medium text-ink-900">
                      {row.label}
                    </td>

                    <td className="px-3 py-2 text-center text-ink-600">
                      {typeof row.free === 'boolean' ? (
                        <FeatureCheck included={row.free} />
                      ) : (
                        row.free
                      )}
                    </td>

                    <td className="px-3 py-2 text-center font-semibold text-ink-900">
                      {typeof row.pro === 'boolean' ? (
                        <FeatureCheck included={row.pro} />
                      ) : (
                        row.pro
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <div className="space-y-2 text-secondary text-ink-400">
        <p>
          Built for Kenyan shops. Pay in KES via M-Pesa or card, powered by
          Paystack.
        </p>

        {/* ON THE PAGE, not only inside the Lifetime card. A customer who
            already has Pro never sees that card, and this is the screen
            where they are charged. */}
        <p>
          Read our{' '}
          <Link to="/terms" className="font-semibold text-ink-600 underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-semibold text-ink-600 underline underline-offset-2">
            Privacy Policy
          </Link>. Need a hand?{' '}
          <a href={SUPPORT_EMAIL_HREF} className="font-semibold text-ink-600 underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>{' '}
          or{' '}
          <a
            href={whatsappHref('Hello FlowBiz, I have a question about billing.')}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink-600 underline underline-offset-2"
          >
            {SUPPORT_WHATSAPP_LABEL}
          </a>.
        </p>
      </div>
    </div>
  );
}