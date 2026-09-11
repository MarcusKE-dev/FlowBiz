import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  PRO_PLAN_PRICE_KES,
  formatPrice,
} from '../../licensing';

const LIFETIME_PRICE = formatPrice(LIFETIME_LICENSE_PRICE_KES);
const SERVICE_PRICE = formatPrice(ANNUAL_SERVICE_PRICE_KES);
const PRO_PRICE = formatPrice(PRO_PLAN_PRICE_KES);

const CheckItem = ({ children, tone = 'primary' }) => (
  <li className="flex items-start gap-2.5">
    <Check
      className={`mt-0.5 h-4 w-4 shrink-0 ${
        tone === 'deep' ? 'text-deep-700' : 'text-primary-600'
      }`}
      strokeWidth={2}
      aria-hidden="true"
    />
    <span>{children}</span>
  </li>
);

export function PricingComparison() {
  return (
    <section
      id="pricing"
      className="border-t border-line bg-canvas py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl md:text-4xl">
            Simple, upfront pricing
          </h2>

          <p className="text-body text-ink-600 sm:text-base">
            Start free with the essentials. Upgrade when your business needs
            more.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {/* Starter */}
          <div className="flex flex-col rounded-panel border border-ink-300 bg-white p-6 sm:p-7">
            <div className="flex-1 space-y-5">
              <div>
                <h3 className="text-xl font-bold text-ink-900">
                  FlowBiz Starter
                </h3>

                <p className="mt-1 text-secondary text-ink-500">
                  The essentials for running a small business.
                </p>
              </div>

              <div>
                <span className="text-3xl font-extrabold text-ink-900">
                  KES 0
                </span>
              </div>

              <ul className="space-y-3 border-t border-line pt-5 text-secondary font-medium text-ink-700">
                <CheckItem>Up to 100 active products</CheckItem>
                <CheckItem>1 owner + 1 staff cashier</CheckItem>
                <CheckItem>Multi-product POS counter</CheckItem>
                <CheckItem>Customer credit and repayment ledger</CheckItem>
                <CheckItem>Till and shift reconciliation</CheckItem>
                <CheckItem>58mm and 80mm thermal receipts</CheckItem>
                <CheckItem>Offline-first operation</CheckItem>
              </ul>
            </div>

            <Link
              to="/setup"
              className="mt-7 block w-full rounded-panel border border-ink-300 py-3 text-center text-body font-bold text-ink-900 transition-colors hover:bg-canvas"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-panel border-2 border-primary-600 bg-white p-6 sm:p-7">
            <div className="absolute -top-3 right-5 rounded-pill bg-primary-600 px-3 py-1 text-label font-bold uppercase tracking-wide text-white">
              Most Popular
            </div>

            <div className="flex-1 space-y-5">
              <div>
                <h3 className="text-xl font-bold text-ink-900">
                  FlowBiz Pro
                </h3>

                <p className="mt-1 text-secondary text-ink-500">
                  More capacity, insight and customer communication.
                </p>
              </div>

              <div>
                <span className="text-3xl font-extrabold text-primary-600">
                  {PRO_PRICE}
                </span>

                <span className="text-secondary font-medium text-ink-500">
                  {' '}
                  / 30 days
                </span>

                <p className="mt-1 text-label font-semibold text-primary-600">
                  Prepaid. Manual renewal.
                </p>
              </div>

              <ul className="space-y-3 border-t border-line pt-5 text-secondary font-medium text-ink-700">
                <CheckItem>
                  <strong className="text-ink-900">
                    Unlimited products
                  </strong>
                </CheckItem>

                <CheckItem>
                  <strong className="text-ink-900">
                    Unlimited staff
                  </strong>
                </CheckItem>

                <CheckItem>Product photos</CheckItem>
                <CheckItem>WhatsApp receipts and reminders</CheckItem>
                <CheckItem>Advanced analytics</CheckItem>
                <CheckItem>Inventory intelligence</CheckItem>
                <CheckItem>Stockout prediction and restock tools</CheckItem>
                <CheckItem>Staff performance insights</CheckItem>
              </ul>
            </div>

            <Link
              to="/setup"
              className="mt-7 block w-full rounded-panel bg-primary-600 py-3 text-center text-body font-bold text-white transition-colors hover:bg-primary-700"
            >
              Start Free &amp; Upgrade Later
            </Link>
          </div>

          {/* Lifetime */}
          <div className="relative flex flex-col rounded-panel border border-deep-600 bg-white p-6 sm:p-7">
            <div className="absolute -top-3 right-5 rounded-pill bg-deep-600 px-3 py-1 text-label font-bold uppercase tracking-wide text-white">
              One-time licence
            </div>

            <div className="flex-1 space-y-5">
              <div>
                <h3 className="text-xl font-bold text-ink-900">
                  FlowBiz Lifetime
                </h3>

                <p className="mt-1 text-secondary text-ink-500">
                  Own the FlowBiz software licence permanently.
                </p>
              </div>

              <div>
                <span className="text-3xl font-extrabold text-deep-700">
                  {LIFETIME_PRICE}
                </span>

                <span className="text-secondary font-medium text-ink-500">
                  {' '}
                  one time
                </span>

                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-body font-semibold text-ink-900">
                    Permanent software licence
                  </p>

                  <p className="mt-1 text-secondary text-ink-500">
                    First year of cloud services included.
                  </p>

                  <p className="mt-3 text-body font-semibold text-ink-900">
                    {SERVICE_PRICE}/year from year two
                  </p>

                  <p className="mt-0.5 text-label text-ink-500">
                    Cloud services, maintenance, updates &amp; support
                  </p>
                </div>
              </div>

              <ul className="space-y-3 border-t border-line pt-5 text-secondary font-medium text-ink-700">
                <CheckItem tone="deep">
                  All Pro features, including product photos
                </CheckItem>

                <CheckItem tone="deep">
                  Offline-first operation
                </CheckItem>
              </ul>
            </div>

            <Link
              to="/setup"
              className="mt-7 block w-full rounded-panel bg-deep-600 py-3 text-center text-body font-bold text-white transition-colors hover:bg-deep-700"
            >
              Get the Lifetime Licence
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
