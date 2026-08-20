import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-sand text-ink-900 selection:bg-moss-200 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to App
        </Link>
        <div className="card p-6 sm:p-10 space-y-8 bg-white border border-ink-100 shadow-sm">
          <div className="border-b border-ink-100 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-moss-50 text-moss-700 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="font-display text-2xl font-bold text-ink-900">Privacy Policy</h1>
            </div>
            <p className="text-sm text-ink-500">Effective Date: August 20, 2026 · Compliant with Kenya Data Protection Act (KDPA) 2019</p>
          </div>

          <div className="space-y-6 text-sm text-ink-700 leading-relaxed">
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">1. Information We Collect</h2>
              <p>FlowBiz collects operational data required to provide point-of-sale, inventory management, and debt ledger functionality for retail businesses:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li><strong>Account Data:</strong> Owner/Staff email address, display name, and business identity.</li>
                <li><strong>Store Operational Data:</strong> Product inventory, transaction receipts, expense entries, and customer contact information recorded for debt management.</li>
                <li><strong>Technical Data:</strong> Browser user-agent and device category used for device management security.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">2. Role as Data Processor</h2>
              <p>Under the Kenya Data Protection Act (2019), the business owner acts as the <strong>Data Controller</strong> for customer details stored within their workspace. FlowBiz operates strictly as a <strong>Data Processor</strong>.</p>
              <p>We do not monetize, profile, or sell customer contact information recorded by merchants.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">3. Offline Storage &amp; Security</h2>
              <p>FlowBiz uses an offline-first architecture. Transactional data is temporarily stored in local browser memory (IndexedDB) and synchronized securely via encrypted HTTPS/WSS channels to cloud servers when connectivity is available.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">4. Contact Us</h2>
              <p>For data protection inquiries or requests, contact our privacy compliance team at:</p>
              <p className="font-medium text-ink-800">support@flowbiz.co.ke</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}