import { Link } from 'react-router-dom';
import { UserPlus, PackagePlus, ShoppingBag } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: '1',
      icon: UserPlus,
      title: 'Register Your Business',
      description: 'Set up your shop name, store phone number, and initial user account in under 60 seconds. No credit card required.',
    },
    {
      num: '2',
      icon: PackagePlus,
      title: 'Add or Scan Products',
      description: 'Enter your inventory items with buying cost, selling price, and optional barcode. Add categories and supplier links anytime.',
    },
    {
      num: '3',
      icon: ShoppingBag,
      title: 'Open Counter & Sell',
      description: 'Record multi-item cash, M-Pesa, or credit sales with automatic stock deduction, WhatsApp receipts, and end-of-day till audits.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 border-t border-line scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink-900 tracking-tight">
            Get started in 3 simple steps
          </h2>
          <p className="text-sm sm:text-base text-ink-600">
            No technicians. No complicated setup. No expensive POS hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative pt-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="space-y-4 flex flex-col justify-between pb-6 border-b border-line md:border-b-0"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <span className="text-xl font-black text-primary-600">
                      Step 0{step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-ink-900">
                    {step.title}
                  </h3>
                  <p className="text-xs text-ink-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <Link
            to="/setup"
            className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:bg-primary-700 transition-all shadow-sm"
          >
            Create Your Business in 60 Seconds
          </Link>
        </div>
      </div>
    </section>
  );
}