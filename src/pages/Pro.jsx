import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import { friendlyErrorMessage } from '../utils/errorMessages';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function Pro() {
  const { isPro, subscription } = useAuth();
  const [loading, setLoading] = useState(false);
 const [proPrice, setProPrice] = useState(null);

 useEffect(() => {
   fetch(`${FLOWBIZ_API_URL}/api/pro/price`)
     .then((r) => r.json())
     .then((data) => setProPrice(data.amountKes))
     .catch(() => {}); // stays on the loading placeholder rather than guessing a number
 }, []);

  const handleSubscribe = async () => {
    if (loading) return; 
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();

      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success('Payment received — activating your subscription…'),
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">FlowBiz Pro</h1>
          <p className="text-sm text-ink-500">Supercharge your shop operations.</p>
        </div>
        <Link to="/" className="btn-outline text-xs">Back to Dashboard</Link>
      </div>

      <div className="card p-8 text-center bg-moss-50 border-moss-200">
        <h2 className="font-display text-3xl font-bold text-moss-800">
          {proPrice != null ? `KSh ${proPrice.toLocaleString('en-KE')}` : '…'} <span className="text-lg font-normal text-moss-700">/ 30 days</span>
        </h2>        <p className="mt-2 text-ink-600 max-w-lg mx-auto">No recurring auto-billing. Manual renewal ensures you're always in control of your subscription.</p>
        
        {isPro ? (
          <div className="mt-6 inline-flex flex-col items-center">
            <span className="badge bg-amber-100 text-amber-800 px-4 py-2 text-sm">FlowBiz Pro Active</span>
            {subscription?.expiresAt && <p className="text-xs text-ink-500 mt-2">Expires on {new Date(subscription.expiresAt.toMillis ? subscription.expiresAt.toMillis() : subscription.expiresAt).toLocaleDateString()}</p>}
            <button onClick={handleSubscribe} disabled={loading} className="mt-4 btn-outline">Extend Subscription</button>
          </div>
        ) : (
          <button onClick={handleSubscribe} disabled={loading} className="mt-6 btn-primary px-8 py-3 text-lg">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Loading payment page...
              </span>
            ) : 'Pay KSh 599'}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-6 pt-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Advanced Analytics</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Business Health Dashboard</li>
            <li><span className="text-moss-700 mr-2">✓</span>Sales insights & Profit analysis</li>
            <li><span className="text-moss-700 mr-2">✓</span>Staff Analytics and performance tracking</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Inventory Intelligence</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Detect overstocked items holding capital</li>
            <li><span className="text-moss-700 mr-2">✓</span>Predictive stockout warnings</li>
            <li><span className="text-moss-700 mr-2">✓</span>Total capital & potential profit insights</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Professional Documents</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>Professional invoices and receipts</li>
            <li><span className="text-moss-700 mr-2">✓</span>PDF generation and direct printing</li>
            <li><span className="text-moss-700 mr-2">✓</span>Business logo prominently displayed</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900 mb-3">Communication & Team</h3>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><span className="text-moss-700 mr-2">✓</span>WhatsApp receipts directly to customers</li>
            <li><span className="text-moss-700 mr-2">✓</span>WhatsApp invoice sending</li>
            <li><span className="text-moss-700 mr-2">✓</span>Unlimited staff members (Free plan limits to 1)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}