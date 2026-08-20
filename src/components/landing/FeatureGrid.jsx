import { 
  ShoppingCart, 
  BookOpen, 
  Lock, 
  WifiOff, 
  Smartphone, 
  Printer, 
  Boxes, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  RotateCcw,
  Truck
} from 'lucide-react';

export function FeatureGrid() {
  const features = [
    {
      icon: ShoppingCart,
      category: 'Point of Sale',
      title: 'Multi-Product POS Counter',
      description: 'Rapid product grid selection, multi-item active cart, barcode scanning, and custom on-the-fly bargaining prices.',
    },
    {
      icon: BookOpen,
      category: 'Credit Control',
      title: 'Cash-Flow Credit (Deni) Ledger',
      description: 'Profit is recognized only as debt is repaid. Eliminates false profit illusions before customer payments reach your hands.',
    },
    {
      icon: Lock,
      category: 'Shift Auditing',
      title: 'End-of-Day Till Reconciliation',
      description: 'Opening float tracking, automated expected cash and M-Pesa balances, and instant shortage or surplus variance detection.',
    },
    {
      icon: WifiOff,
      category: 'Resilience',
      title: '100% Offline-First Execution',
      description: 'Never pause checkout during internet outages. Local storage queues transactions and syncs automatically when reconnected.',
    },
    {
      icon: Smartphone,
      category: 'Communication',
      title: 'One-Tap WhatsApp Sharing',
      description: 'Send itemized receipts, invoices, and debt reminders with secure public links without monthly SMS or API costs.',
    },
    {
      icon: Printer,
      category: 'Hardware',
      title: 'Thermal & PDF Documents',
      description: 'Native 58mm & 80mm thermal receipt printing, custom business logo embedding, and downloadable A4 financial reports.',
    },
    {
      icon: Boxes,
      category: 'Inventory',
      title: 'Stock Intelligence & Restock Alerts',
      description: 'Wholesale inventory valuation, ABC value classification, 14-day stockout prediction, and slow-moving dead stock alerts.',
    },
    {
      icon: RotateCcw,
      category: 'Audit',
      title: 'Stock Take Discrepancy Audits',
      description: 'Periodic physical hand-count verification to audit stock differences, damage, shrinkage, and expiration reasons.',
    },
    {
      icon: Users,
      category: 'Access Control',
      title: 'Owner & Cashier Roles',
      description: 'Granular permissions that protect financial margins from staff, plus one-tap remote device sign-out for lost phones.',
    },
    {
      icon: Truck,
      category: 'Restocking',
      title: 'Supplier Balance & Purchase Orders',
      description: 'Record incoming supplier shipments on credit or cash, automatically updating stock levels and supplier payables.',
    },
    {
      icon: TrendingUp,
      category: 'Intelligence',
      title: 'Institutional Analytics',
      description: 'Compare performance periods, track revenue by staff member, and identify peak sales volume by day of the week.',
    },
{
  icon: ShieldCheck,
  category: 'Security',
  title: 'Secure Business Accounts',
  description: 'Built with secure authentication and strict multi-tenant data isolation, keeping each business account and its data securely separated.',
},
  ];

return (
  <section id="features" className="py-16 md:py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
          Everything you need to run your business
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10 pt-4">
        {features.map((feat, index) => {
          const Icon = feat.icon;

          return (
            <div
              key={index}
              className="space-y-3 pb-4 border-b border-[#e8eaed] sm:border-b-0"
            >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg 	bg-white text-[#1a623c] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a623c]">
                    {feat.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#15171d]">
                  {feat.title}
                </h3>
                <p className="text-xs text-[#5a6273] leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}