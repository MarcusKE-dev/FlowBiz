// src/contexts/CheckoutContext.jsx
//
// Paying FlowBiz, in one place.
//
// Every "Upgrade", "Buy Lifetime" and "Renew" button calls
// useLicensingCheckout().startCheckout(plan). That now opens the M-Pesa
// sheet: the customer types their number, approves the STK prompt on
// their phone, and never leaves FlowBiz. Paystack's hosted popup is still
// here as `startCardCheckout`, reached from the sheet's "Other payment
// methods" link, for cards and anyone who cannot use M-Pesa.
//
// NOTHING IN THE BROWSER GRANTS ANYTHING. The sheet shows success only
// when the Worker's status route says the payment is `success`, which it
// says only after Paystack has verified it and the entitlement has been
// written. The plan itself reaches the app through the business
// document's listener in AuthContext, exactly as it always has — which
// is also why a customer who closes FlowBiz mid-payment finds the plan
// active when they come back.
//
// The M-Pesa state lives HERE rather than inside the sheet so closing the
// sheet does not forget a prompt that is still waiting on the phone:
// reopening it for the same plan picks up where it left off.

import { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { isDemoMode } from '../demo/demoMode';
import { initialMpesaState, mpesaReducer } from '../licensing/mpesa';
import MpesaCheckoutSheet from '../components/licensing/MpesaCheckoutSheet';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const PENDING_COPY = {
  pro: 'Payment received. Activating your subscription…',
  lifetime: 'Payment received. Activating your Lifetime Licence and your first 12 months of cloud services…',
  annual_services: 'Payment received. Extending your cloud services, maintenance, updates and support…',
};

const CheckoutContext = createContext(null);

/** Calls the Worker as the signed-in owner. Throws only on network failure. */
async function callApi(path, { method = 'GET', body } = {}) {
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(`${FLOWBIZ_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export function CheckoutProvider({ children }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mpesa, dispatch] = useReducer(mpesaReducer, null, () => initialMpesaState(null));

  // ── Paystack's hosted checkout: cards and every other method ─────────
  const startCardCheckout = useCallback(async (plan) => {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    try {
      const { ok, data } = await callApi('/api/paystack/initialize', { method: 'POST', body: { plan } });
      if (!ok) {
        toast.error(data?.error || "Couldn't start the payment. Please try again.");
        return;
      }
      if (data?.access_code && window.PaystackPop) {
        const popup = new window.PaystackPop();
        popup.resumeTransaction(data.access_code, {
          // "Activating", not "activated": the webhook is what grants it.
          onSuccess: () => toast.success(PENDING_COPY[plan] || PENDING_COPY.pro),
          onCancel: () => toast('Payment cancelled.'),
        });
      } else if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error("Couldn't initialize payment. Please try again.");
      }
    } catch (err) {
      toast.error(friendlyErrorMessage(err, {
        fallback: 'Unable to load the payment page. Please check your connection and try again.',
      }));
    } finally {
      setLoadingPlan(null);
    }
  }, [loadingPlan]);

  // ── M-Pesa: the default ─────────────────────────────────────────────
  const startCheckout = useCallback((plan) => {
    if (isDemoMode()) {
      toast('Payments are switched off in the demo.');
      return;
    }
    // Same plan, payment still in progress or just finished: reopen onto
    // it. Anything else starts a fresh form.
    const resumable = mpesa.plan === plan && mpesa.phase !== 'form' && mpesa.phase !== 'failed';
    if (!resumable) dispatch({ type: 'reset', plan });
    setSheetOpen(true);
  }, [mpesa.plan, mpesa.phase]);

  const sendPrompt = useCallback(async (phone) => {
    if (mpesa.phase !== 'form' && mpesa.phase !== 'failed') return;
    dispatch({ type: 'send' });
    try {
      const { ok, data } = await callApi('/api/paystack/mpesa/charge', {
        method: 'POST',
        body: { plan: mpesa.plan, phone },
      });
      if (!ok || !data?.reference) {
        dispatch({ type: 'refused', error: data?.error });
        return;
      }
      dispatch({ type: 'payment', payment: data });
    } catch {
      // Our own request did not come back, so we cannot know whether a
      // prompt went out. Sending again is safe: the Worker resumes a live
      // prompt for this business rather than ringing the phone twice.
      dispatch({ type: 'refused', error: "Can't reach FlowBiz. Check your internet connection and try again." });
    }
  }, [mpesa.phase, mpesa.plan]);

  const checkStatus = useCallback(async (reference) => {
    try {
      const { ok, data } = await callApi(`/api/paystack/mpesa/status?reference=${encodeURIComponent(reference)}`);
      if (ok) dispatch({ type: 'payment', payment: data });
    } catch {
      // A failed poll is not a failed payment. Keep waiting.
    }
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    // A finished payment has nothing to resume; start clean next time.
    if (mpesa.phase === 'success') dispatch({ type: 'reset', plan: null });
  }, [mpesa.phase]);

  const switchToCard = useCallback(() => {
    const { plan } = mpesa;
    setSheetOpen(false);
    dispatch({ type: 'reset', plan: null });
    startCardCheckout(plan);
  }, [mpesa, startCardCheckout]);

  const value = useMemo(() => ({
    startCheckout,
    startCardCheckout,
    // Only the hosted popup is "loading" a button; the M-Pesa sheet covers
    // the page while it is open.
    loadingPlan,
  }), [startCheckout, startCardCheckout, loadingPlan]);

  return (
    <CheckoutContext.Provider value={value}>
      {children}
      <MpesaCheckoutSheet
        open={sheetOpen}
        state={mpesa}
        onSend={sendPrompt}
        onCheckStatus={checkStatus}
        onRetry={() => dispatch({ type: 'retry' })}
        onClose={closeSheet}
        onOtherMethod={switchToCard}
      />
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used inside <CheckoutProvider>.');
  return ctx;
}
