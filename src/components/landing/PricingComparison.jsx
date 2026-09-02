import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export function PricingComparison() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-canvas border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink-900 tracking-tight">
            Simple, upfront pricing
          </h2>
          <p className="text-sm sm:text-base text-ink-600">
Start free with the essentials. Upgrade to FlowBiz Pro when your business needs more.          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Starter Plan */}
          <div className="bg-white rounded-2xl border border-ink-300 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-ink-900">FlowBiz Starter</h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Essential store operations for solo shops and small dukas.
                  </p>
                </div>
                
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-ink-900">KES 0</span>
                
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-line text-xs text-ink-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Up to 100 active products in catalog</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>1 Business Owner + 1 Staff Cashier</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Multi-product POS Counter &amp; active cart</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Full Customer Credit (Deni) &amp; repayment ledger</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>End-of-day Till Float &amp; Shift Reconciliation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Standard 58mm &amp; 80mm PDF thermal receipts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>100% offline-first cached execution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm border border-ink-300 rounded-xl hover:bg-canvas transition-colors block text-ink-900"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl border-2 border-primary-600 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-md relative">
            <div className="absolute -top-3 right-6 bg-primary-600 text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide">
              Most Popular
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-ink-900">FlowBiz Pro</h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Uncapped capacity, deep analytics, and WhatsApp customer communication.
                  </p>
                </div>
              
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-primary-600">KES 599</span>
                <span className="text-xs text-ink-500 font-medium"> / 30 days prepaid</span>
                <p className="text-[11px] text-primary-600 font-semibold mt-0.5">
                  Manual M-Pesa / Card renewal · No auto-billing surprises
                </p>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-line text-xs text-ink-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <strong className="text-ink-900">Unlimited products &amp; catalog items</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <strong className="text-ink-900">Unlimited staff cashier accounts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>WhatsApp digital receipts &amp; debt reminder dispatch</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Advanced Analytics (profit margin trends, day-of-week volume)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Inventory Intelligence &amp; ABC Pareto stock prioritization</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>14-day stockout prediction &amp; restock quantity engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary-600 shrink-0" />
                  <span>Staff performance ranking &amp; revenue attribution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm block"
            >
              Start Free &amp; Upgrade Later
            </Link>
          </div>

          {/* Lifetime Plan */}
          <div className="bg-white rounded-2xl border border-deep-600 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm relative">
            <div className="absolute -top-3 right-6 bg-deep-600 text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide">
              Pay once
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-ink-900">FlowBiz Lifetime</h3>
                <p className="text-xs text-ink-500 mt-0.5">
                  Everything in Pro, paid for once — no recurring FlowBiz software subscription.
                </p>
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-deep-700">KES 15,550</span>
                <span className="text-xs text-ink-500 font-medium"> one-time</span>
                <p className="text-[11px] text-deep-700 font-semibold mt-0.5">
                  Pay once · No auto-billing · No renewals, ever
                </p>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-line text-xs text-ink-700 font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-deep-700 shrink-0" />
                  <strong className="text-ink-900">Every FlowBiz Pro feature, permanently unlocked</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-deep-700 shrink-0" />
                  <span>One perpetual license tied to your business — works across your devices</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-deep-700 shrink-0" />
                  <span>Cloud-synced &amp; offline-first, same as every FlowBiz plan</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-deep-700 shrink-0" />
                  <span>WhatsApp receipts, invoices &amp; debt reminders</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm bg-deep-600 text-white rounded-xl hover:bg-deep-700 transition-colors shadow-sm block"
            >
              Get FlowBiz Lifetime
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}