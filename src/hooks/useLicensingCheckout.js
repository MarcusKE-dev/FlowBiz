// src/hooks/useLicensingCheckout.js
//
// Starting a Paystack checkout, in one place.
//
// The browser sends a PLAN NAME and nothing else. It does not send an
// amount, and it could not usefully lie about one: the Worker prices the
// plan from its own table, records the amount it charged before handing
// back a reference, and the webhook refuses to grant anything if what
// Paystack actually collected does not match. So this hook is a button
// handler, not a payment path.
//
// It also deliberately does NOT grant anything on `onSuccess`. Paystack's
// popup calling back means the customer's payment went through on
// Paystack's side; the entitlement arrives when the signed webhook does,
// and the business document's listener pushes it into the app on its own.
// The toast says "activating", not "activated", for exactly that reason.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { friendlyErrorMessage } from '../utils/errorMessages';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const PENDING_COPY = {
  pro: 'Payment received. Activating your subscription…',
  lifetime: 'Payment received. Activating your Lifetime Licence and your first 12 months of cloud services…',
  annual_services: 'Payment received. Extending your cloud services, maintenance, updates and support…',
};

export function useLicensingCheckout() {
  const [loadingPlan, setLoadingPlan] = useState(null);

  const startCheckout = async (plan) => {
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

      if (!response.ok) {
        toast.error(data?.error || "Couldn't start the payment. Please try again.");
        return;
      }
      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: () => toast.success(PENDING_COPY[plan] || PENDING_COPY.pro),
          onCancel: () => toast('Payment cancelled.'),
        });
      } else if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error(data?.error || "Couldn't initialize payment. Please try again.");
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        fallback: 'Unable to load the payment page. Please check your connection and try again.',
      }));
    } finally {
      setLoadingPlan(null);
    }
  };

  return { startCheckout, loadingPlan, busy: Boolean(loadingPlan) };
}
