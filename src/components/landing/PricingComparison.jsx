import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  PRO_PLAN_PRICE_KES,
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
} from '../../config/licensing';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-KE').format(value);

function CheckItem({ children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-700">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
      <span>{children}</span>
    </li>
  );
}

export default function PricingComparison() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Simple pricing
          </h2>

          <p className="mt-3 text-base text-ink-600">
            Start free and upgrade when your business needs more.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {/* Starter */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="text-lg font-semibold text-ink-900">
              Starter
            </h3>

            <div className="mt-4 text-3xl font-bold tracking-tight text-ink-900">
              KES 0
            </div>

            <p className="mt-1 text-sm text-ink-500">
              Free
            </p>

            <ul className="mt-6 space-y-3">
              <CheckItem>Up to 100 active products</CheckItem>
              <CheckItem>1 owner + 1 staff member</CheckItem>
              <CheckItem>Multi-product POS</CheckItem>
              <CheckItem>Credit & debtor ledger</CheckItem>
              <CheckItem>Till reconciliation</CheckItem>
              <CheckItem>Thermal receipts</CheckItem>
              <CheckItem>Offline-first</CheckItem>
            </ul>

            <Link
              to="/setup"
              className="btn-secondary mt-7 w-full justify-center"
            >
              Get started
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary-600 bg-white p-6">
            <h3 className="text-lg font-semibold text-ink-900">
              Pro
            </h3>

            <div className="mt-4 text-3xl font-bold tracking-tight text-ink-900">
              KES {formatPrice(PRO_PLAN_PRICE_KES)}
            </div>

            <p className="mt-1 text-sm text-ink-500">
              / 30 days
            </p>

            <p className="mt-4 text-sm font-medium text-ink-700">
              Manual renewal, no automatic billing.
            </p>

            <ul className="mt-6 space-y-3">
              <CheckItem>Unlimited products</CheckItem>
              <CheckItem>Unlimited staff</CheckItem>
              <CheckItem>Advanced analytics</CheckItem>
              <CheckItem>Inventory intelligence</CheckItem>
              <CheckItem>Product photos</CheckItem>
              <CheckItem>WhatsApp receipts & reminders</CheckItem>
            </ul>

            <Link
              to="/setup"
              className="btn-primary mt-7 w-full justify-center"
            >
              Get Pro
            </Link>
          </div>

          {/* Lifetime */}
          <div className="rounded-2xl border-2 border-deep-600 bg-white p-6">
            <h3 className="text-lg font-semibold text-ink-900">
              Lifetime
            </h3>

            <div className="mt-4 text-3xl font-bold tracking-tight text-ink-900">
              KES {formatPrice(LIFETIME_LICENSE_PRICE_KES)}
            </div>

            <p className="mt-1 text-sm text-ink-500">
              One time
            </p>

            <p className="mt-4 text-sm font-semibold text-ink-800">
              Own the FlowBiz software licence permanently.
            </p>

            <ul className="mt-6 space-y-3">
              <CheckItem>
                KES {formatPrice(ANNUAL_SERVICE_PRICE_KES)}/year from year two
              </CheckItem>
              <CheckItem>
                Cloud services, maintenance, updates & support
              </CheckItem>
              <CheckItem>First year included</CheckItem>
              <CheckItem>All Pro features</CheckItem>
              <CheckItem>Offline-first</CheckItem>
            </ul>

            <Link
              to="/setup"
              className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-deep-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-deep-700"
            >
              Get Lifetime Licence
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}