import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

export function PricingComparison() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-[#faf6ef] border-t border-[#e8eaed]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
            Simple, upfront pricing
          </h2>
          <p className="text-sm sm:text-base text-[#5a6273]">
Start free with the essentials. Upgrade to FlowBiz Pro when your business needs more.          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Starter Plan */}
          <div className="bg-white rounded-2xl border border-[#cfd3da] p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#15171d]">FlowBiz Starter</h3>
                  <p className="text-xs text-[#767f8f] mt-0.5">
                    Essential store operations for solo shops and small dukas.
                  </p>
                </div>
                
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-[#15171d]">KES 0</span>
                
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-[#e8eaed] text-xs text-[#363b48] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Up to 100 active products in catalog</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>1 Business Owner + 1 Staff Cashier</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Multi-product POS Counter &amp; active cart</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Full Customer Credit (Deni) &amp; repayment ledger</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>End-of-day Till Float &amp; Shift Reconciliation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Standard 58mm &amp; 80mm PDF thermal receipts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>100% offline-first cached execution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm border border-[#cfd3da] rounded-xl hover:bg-[#faf6ef] transition-colors block text-[#15171d]"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-2xl border-2 border-[#1a623c] p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-md relative">
            <div className="absolute -top-3 right-6 bg-[#1a623c] text-white px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide">
              Most Popular
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#15171d]">FlowBiz Pro</h3>
                  <p className="text-xs text-[#767f8f] mt-0.5">
                    Uncapped capacity, deep analytics, and WhatsApp customer communication.
                  </p>
                </div>
              
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-[#1a623c]">KES 599</span>
                <span className="text-xs text-[#767f8f] font-medium"> / 30 days prepaid</span>
                <p className="text-[11px] text-[#1a623c] font-semibold mt-0.5">
                  Manual M-Pesa / Card renewal · No auto-billing surprises
                </p>
              </div>

              <ul className="space-y-2.5 pt-4 border-t border-[#e8eaed] text-xs text-[#363b48] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <strong className="text-[#15171d]">Unlimited products &amp; catalog items</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <strong className="text-[#15171d]">Unlimited staff cashier accounts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>WhatsApp digital receipts &amp; debt reminder dispatch</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Advanced Analytics (profit margin trends, day-of-week volume)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Inventory Intelligence &amp; ABC Pareto stock prioritization</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>14-day stockout prediction &amp; restock quantity engine</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#1a623c] shrink-0" />
                  <span>Staff performance ranking &amp; revenue attribution</span>
                </li>
              </ul>
            </div>

            <Link
              to="/setup"
              className="w-full py-3 text-center font-bold text-sm bg-[#1a623c] text-white rounded-xl hover:bg-[#144f30] transition-colors shadow-sm block"
            >
              Start Free &amp; Upgrade Later
              <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}