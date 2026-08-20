// src/pages/Pro.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { Check, X, BarChart3, Boxes, FileText, MessageCircle, Users, Sparkles, ArrowLeft } from 'lucide-react';

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
  const { isPro, subscription } = useAuth();
  const [loading, setLoading] = useState(false);
  const [proPrice, setProPrice] = useState(null);

  useEffect(() => {
    fetch(`${FLOWBIZ_API_URL}/api/pro/price`)
      .then((r) => r.json())
      .then((data) => setProPrice(data.amountKes))
      .catch(() => {});
  }, []);

  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {

      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`${FLOWBIZ_API_URL}/api/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success('Payment received activating your subscription…'),
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
      setLoading(false);
    }
  };

  const expiresLabel = subscription?.expiresAt
    ? new Date(subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss-700">FlowBiz Pro</p>
          <h1 className="font-display text-2xl font-bold text-ink-900 mt-0.5">Run your shop with sharper insight</h1>
        </div>
        <Link to="/" className="btn-outline text-xs shrink-0">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Dashboard
        </Link>
      </div>

      <div className="card overflow-hidden border-moss-200">
        <div className="bg-gradient-to-br from-moss-700 to-moss-900 px-6 py-10 text-center sm:px-10">

          <h2 className="mt-4 font-display text-4xl font-extrabold text-white">
            {proPrice != null ? `KSh ${proPrice.toLocaleString('en-KE')}` : '…'}
            <span className="text-base font-medium text-moss-200"> / 30 days</span>
          </h2>
          <p className="mt-3 max-w-md mx-auto text-sm text-moss-100">Manual renewal, no auto-billing, no surprise charges. You're always in control.</p>
          {isPro ? (
            <div className="mt-7 flex flex-col items-center gap-3">
              <span className="badge bg-white text-moss-800 px-4 py-1.5 text-sm font-bold">FlowBiz Pro Active</span>
              {expiresLabel && <p className="text-xs text-moss-200">Renews / expires on {expiresLabel}</p>}
              <button onClick={handleSubscribe} disabled={loading} className="btn-outline !border-white/40 !text-white hover:!bg-white/10">
                {loading ? 'Loading…' : 'Extend subscription'}
              </button>
            </div>
          ) : (
            <button onClick={handleSubscribe} disabled={loading} className="mt-7 btn-primary !bg-white !text-moss-800 hover:!bg-moss-50 px-8 py-3 text-base">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-moss-300 border-t-moss-800" />
                  Loading payment page…
                </span>
              ) : `Upgrade to Pro KSh ${proPrice != null ? proPrice.toLocaleString('en-KE') : '…'}`}
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-500 mb-3">What's included</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CATEGORIES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-5 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl2 bg-moss-50 text-moss-700">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h4 className="font-display text-sm font-bold text-ink-900">{title}</h4>
              <p className="text-xs leading-relaxed text-ink-500">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-500 mb-3">Free vs Pro</h3>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr><th className="px-4 py-3">Feature</th><th className="px-4 py-3 text-center">Free</th><th className="px-4 py-3 text-center text-moss-700">Pro</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-medium text-ink-700">{row.label}</td>
                    <td className="px-4 py-3 text-center text-ink-500">
                      {typeof row.free === 'boolean' ? (row.free ? <Check className="mx-auto h-4 w-4 text-moss-600" strokeWidth={2} /> : <X className="mx-auto h-4 w-4 text-ink-300" strokeWidth={2} />) : row.free}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-moss-700">
                      {typeof row.pro === 'boolean' ? (row.pro ? <Check className="mx-auto h-4 w-4 text-moss-600" strokeWidth={2} /> : <X className="mx-auto h-4 w-4 text-ink-300" strokeWidth={2} />) : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-400">
        
        Built for Kenyan shops pay in KES via M-Pesa or card, powered by Paystack.
      </div>
    </div>
  );
}