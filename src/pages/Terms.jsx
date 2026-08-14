import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function Terms() {
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
                <FileText className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="font-display text-2xl font-bold text-ink-900">Terms of Service</h1>
            </div>
            <p className="text-sm text-ink-500">Effective Date: August 14, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-ink-700 leading-relaxed">
            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">1. Acceptance of Terms</h2>
              <p>By creating an account and using FlowBiz (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">2. Description of Service</h2>
              <p>FlowBiz is a business management and point-of-sale (POS) application tailored for Kenyan small and medium-sized businesses. It provides tools for inventory tracking, sales recording, debt management, and basic financial reporting.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">3. Account Registration & Security</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>You must provide accurate and complete information when creating a business account.</li>
                <li>You are responsible for maintaining the security of your password and devices.</li>
                <li>Business owners are responsible for the actions of any staff members (e.g., Cashiers) they invite to their workspace.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">4. User Data & Privacy Responsibilities</h2>
              <p>As a business owner, you use FlowBiz to store and process data regarding your own customers. <strong>You represent and warrant that you have the lawful right to collect and process this data under the Kenya Data Protection Act, 2019.</strong></p>
              <p>FlowBiz acts strictly as a Data Processor for your business data. We will not sell, rent, or exploit your operational data. Please review our <Link to="/privacy" className="text-moss-600 hover:underline font-semibold">Privacy Policy</Link> for full details.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">5. Subscriptions and Payments</h2>
              <p>FlowBiz offers a Free tier and a Pro tier.</p>
              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li><strong>FlowBiz Pro:</strong> Upgrading unlocks advanced features such as WhatsApp document sharing, PDF generation, unlimited staff members, and advanced analytics.</li>
                <li><strong>Billing:</strong> Payments are processed securely via Paystack. Subscriptions are billed manually on a prepaid basis (e.g., every 30 days) to give you full control. We do not automatically charge your card.</li>
                <li><strong>Refunds:</strong> Payments are generally non-refundable. We do not provide prorated refunds for partially unused periods.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">6. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-ink-600">
                <li>Engage in any illegal, fraudulent, or deceptive business practices.</li>
                <li>Send unauthorized promotional material (spam) using the WhatsApp receipt/invoice features.</li>
                <li>Attempt to bypass or compromise the Service's security or multi-tenant architecture.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">7. Disclaimers & Limitation of Liability</h2>
              <p><strong>Not Professional Advice:</strong> FlowBiz is a record-keeping tool. It is not a substitute for a professional accountant, tax advisor, or legal counsel. We do not guarantee automatic compliance with KRA regulations (such as eTIMS) unless explicitly stated as an integrated feature.</p>
              <p><strong>As-Is Basis:</strong> The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including implied warranties of merchantability or fitness for a particular purpose.</p>
              <p><strong>Limitation of Liability:</strong> To the maximum extent permitted by Kenyan law, FlowBiz and its creators shall not be liable for any indirect, incidental, or consequential damages, including loss of profits, data, or business interruption arising from your use of the Service.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">8. Termination</h2>
              <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without notice, if we determine that you have violated these Terms or engaged in illegal activity. You may also terminate your account at any time.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">9. Governing Law</h2>
              <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of Kenya. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the Kenyan courts.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-ink-900">10. Contact Us</h2>
              <p>If you have any questions regarding these Terms, please contact us at:</p>
              <p className="font-medium text-ink-800">support@flowbiz.co.ke</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}