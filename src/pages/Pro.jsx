// src/pages/Pro.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import StatusPill from '../components/ui/StatusPill';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { isDemoMode } from '../demo/demoMode';
import { Check, X, BarChart3, Boxes, FileText, MessageCircle, ArrowLeft, Crown } from 'lucide-react';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const FEATURE_CATEGORIES = [
  { icon: BarChart3, title: 'Advanced Analytics', description: 'Revenue & profit trends, payment mix, day-of-week patterns, expense breakdown, top debtors, and staff performance all in one dashboard.' },
  { icon: Boxes, title: 'Inventory Intelligence', description: 'Capital Health scoring, ABC value analysis, reorder suggestions, slow-moving stock alerts, and capital-by-supplier breakdowns.' },
  { icon: FileText, title: 'Professional Documents', description: 'Branded PDF receipts and invoices with your logo, ready to print or download.' },
  { icon: MessageCircle, title: 'WhatsApp Sharing', description: "Send receipts, invoices, and debt reminders straight to a customer's phone." },
];

const COMPARISON_ROWS = [
  { label: 'Products tracked', free: 'Up to 100', pro: 'Unlimited' },
  { label: 'Staff members', free: '1 owner + 1 staff', pro: 'Unlimited' },
  { label: 'Sales, credit & expense tracking', free: true, pro: true },
  { label: 'PDF receipts & invoices', free: true, pro: true },
  { label: 'Advanced Analytics (trends, staff, day-of-week)', free: false, pro: true },
  { label: 'Inventory Intelligence & Capital Health', free: false, pro: true },
  { label: 'Reorder suggestions & ABC value analysis', free: false, pro: true },
  { label: 'WhatsApp receipt & invoice sharing', free: false, pro: true },
];

export default function Pro() {
  const { isPro, isLifetime, subscription } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null); // 'pro' | 'lifetime' | null
  const [pricing, setPricing] = useState({ pro: null, lifetime: null });
  const demo = isDemoMode();

  useEffect(() => {
    if (demo) return; // demo's business record is already seeded as Pro — no real price to show
    fetch(`${FLOWBIZ_API_URL}/api/pricing`)
      .then((r) => r.json())
      .then((data) => setPricing({ pro: data.pro?.amountKes ?? null, lifetime: data.lifetime?.amountKes ?? null }))
      .catch(() => {});
  }, [demo]);

  const handlePurchase = async (plan) => {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`${FLOWBIZ_API_URL}/api/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success(plan === 'lifetime' ? 'Payment received — activating your lifetime license…' : 'Payment received — activating your subscription…'),
          onCancel: () => toast('Payment cancelled.'),
        });
      } else if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error(data?.error || "Couldn't initialize payment. Please try again.");
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { fallback: 'Unable to load the payment page. Please check your connection and try again.' }));
    } finally {
      setLoadingPlan(null);
    }
  };

  const expiresLabel = subscription?.expiresAt
    ? new Date(subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <PageHeader
        title="FlowBiz Pro"
        description="Sharper insight into margins, stock and staff — plus WhatsApp receipts."
        actions={
          <Link to="/" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Dashboard
          </Link>
        }
      />

      {demo ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          {/* FIX: the demo business is always seeded as Pro (see
              src/demo/seedData.js) so every Pro feature can be explored
              freely — there's genuinely nothing to buy here, so instead
              of showing a Subscribe/Extend button that would try to
              charge a payment method the demo login doesn't have, this
              just confirms Pro is already active. Real accounts are
              completely unaffected — `demo` is only ever true inside the
              separately-built demo app. */}
          <div className="flex flex-col items-center gap-3">
            <StatusPill tone="positive">Pro is active in this demo</StatusPill>
            <p className="max-w-sm text-body text-ink-600">
              Every Pro feature is unlocked for this demo account. There is nothing to pay here —
              explore advanced analytics, inventory intelligence and WhatsApp sharing freely.
            </p>
          </div>
        </div>
      ) : isLifetime ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <Crown className="mx-auto h-5 w-5 text-deep-600" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="mt-3 font-display text-page-title text-ink-900">FlowBiz Lifetime is active</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-ink-600">
            This business owns a perpetual FlowBiz licence. Every Pro feature stays unlocked, on
            every device, for good. There is nothing to renew.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Monthly */}
          <div className="flex flex-col rounded-panel border border-line bg-surface p-6">
            <p className="text-label uppercase text-ink-500">Monthly</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-[28px] font-semibold leading-8 text-ink-900">
                {pricing.pro != null ? `KES ${pricing.pro.toLocaleString('en-KE')}` : '…'}
              </span>
              <span className="text-secondary text-ink-500">per 30 days</span>
            </p>
            <p className="mt-3 text-body text-ink-600">
              Manual renewal. No auto-billing and no surprise charges — you are always in control.
            </p>

            {isPro ? (
              <div className="mt-6 flex flex-col items-start gap-3">
                <StatusPill tone="positive">Pro is active</StatusPill>
                {expiresLabel && (
                  <p className="text-secondary text-ink-500">Renews or expires on {expiresLabel}</p>
                )}
                <button
                  onClick={() => handlePurchase('pro')}
                  disabled={!!loadingPlan}
                  className="btn-secondary"
                >
                  {loadingPlan === 'pro' ? 'Loading…' : 'Extend subscription'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handlePurchase('pro')}
                disabled={!!loadingPlan}
                className="btn-primary mt-6 self-start"
              >
                {loadingPlan === 'pro' ? 'Loading…' : 'Upgrade to Pro'}
              </button>
            )}
          </div>

          {/* Lifetime — the deep blue is the only thing marking it out. */}
          <div className="relative flex flex-col rounded-panel border border-deep-600 bg-surface p-6">
            <span className="absolute -top-2.5 right-6 rounded-pill bg-deep-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Pay once
            </span>
            <p className="text-label uppercase text-ink-500">Lifetime</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-[28px] font-semibold leading-8 text-ink-900">
                {pricing.lifetime != null ? `KES ${pricing.lifetime.toLocaleString('en-KE')}` : '…'}
              </span>
              <span className="text-secondary text-ink-500">one time</span>
            </p>
            <p className="mt-3 text-body text-ink-600">
              Pay once for this business, on every device. No recurring FlowBiz software
              subscription ever again.
            </p>
            <button
              onClick={() => handlePurchase('lifetime')}
              disabled={!!loadingPlan}
              className="btn-primary mt-6 self-start"
            >
              {loadingPlan === 'lifetime' ? 'Loading…' : 'Get FlowBiz Lifetime'}
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="section-title mb-3">What's included</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CATEGORIES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="space-y-2 rounded-panel border border-line bg-surface p-5">
              <div className="text-ink-500">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h4 className="font-display text-sm font-bold text-ink-900">{title}</h4>
              <p className="text-xs leading-relaxed text-ink-500">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="section-title mb-3">Free compared with Pro</h2>
        <div className="overflow-hidden rounded-panel border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-cell">
              <thead className="border-b border-line text-left text-label uppercase text-ink-500">
                <tr><th scope="col" className="px-3 py-2">Feature</th><th scope="col" className="px-3 py-2 text-center">Free</th><th scope="col" className="px-3 py-2 text-center">Pro and Lifetime</th></tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 font-medium text-ink-900">{row.label}</td>
                    <td className="px-3 py-2 text-center text-ink-600">
                      {typeof row.free === 'boolean' ? (row.free ? <Check className="mx-auto h-4 w-4 text-success-700" strokeWidth={1.75} aria-label="Included" /> : <X className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-label="Not included" />) : row.free}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-ink-900">
                      {typeof row.pro === 'boolean' ? (row.pro ? <Check className="mx-auto h-4 w-4 text-success-700" strokeWidth={1.75} aria-label="Included" /> : <X className="mx-auto h-4 w-4 text-ink-400" strokeWidth={1.75} aria-label="Not included" />) : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-400">
        Built for Kenyan shops — pay in KES via M-Pesa or card, powered by Paystack.
      </div>
    </div>
  );
}
