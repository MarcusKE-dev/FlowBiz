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

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { friendlyErrorMessage } from '../utils/errorMessages';
import { isDemoMode } from '../demo/demoMode';
import { initialMpesaState, mpesaReducer } from '../licensing/mpesa';
import MpesaCheckoutSheet from '../components/licensing/MpesaCheckoutSheet';
import { useAuth } from './AuthContext';
import { useRegion } from '../hooks/useRegion';
import { billingProvidersFor, BILLING_PROVIDERS } from '../billing/catalog';
import { pricingRegionForCountry } from '../licensing';
import { billingPlatform } from '../platform/platform';
import { playBillingAvailable, purchaseWithPlay, restorePlayPurchases, playPrices } from '../platform/playBilling';

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
  const { businessId } = useAuth();
  const region = useRegion();
  // WHO TAKES THE MONEY on this platform, for this business — decided in
  // one pure function (billing/catalog.js), never in a component. Inside
  // the Android app that is always Google Play.
  const providers = billingProvidersFor({
    platform: billingPlatform(),
    pricingRegion: pricingRegionForCountry(region.country),
  });
  const provider = providers?.primary || null;
  const [storePrices, setStorePrices] = useState(null);
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

  // ── Google Play: the Android app ────────────────────────────────────
  useEffect(() => {
    if (provider !== BILLING_PROVIDERS.GOOGLE_PLAY || !playBillingAvailable()) return undefined;
    let alive = true;
    playPrices().then((prices) => { if (alive) setStorePrices(prices); }).catch(() => {});
    return () => { alive = false; };
  }, [provider]);

  const startPlayCheckout = useCallback(async (plan) => {
    if (loadingPlan) return;
    if (!playBillingAvailable()) {
      toast.error('Google Play purchases are not available on this device.');
      return;
    }
    setLoadingPlan(plan);
    try {
      const result = await purchaseWithPlay(plan, businessId);
      if (result.status === 'success') toast.success(PENDING_COPY[plan] || PENDING_COPY.pro);
      else if (result.status === 'pending') toast('Your payment is pending with Google Play. FlowBiz will activate it once Google confirms.');
      else if (result.status === 'failed') toast.error(result.error);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { fallback: 'The purchase could not be completed.' }));
    } finally {
      setLoadingPlan(null);
    }
  }, [loadingPlan, businessId]);

  const restorePurchases = useCallback(async () => {
    if (!playBillingAvailable()) return;
    setLoadingPlan('restore');
    try {
      const { applied, pending } = await restorePlayPurchases();
      if (applied > 0) toast.success(`Restored ${applied} purchase${applied === 1 ? '' : 's'}.`);
      else if (pending > 0) toast('A purchase is still pending with Google Play.');
      else toast('No purchases to restore.');
    } catch (err) {
      toast.error(friendlyErrorMessage(err, { fallback: 'Purchases could not be restored. Check your connection and try again.' }));
    } finally {
      setLoadingPlan(null);
    }
  }, []);

  // ── M-Pesa: the default on the web in Kenya ─────────────────────────
  const startCheckout = useCallback((plan) => {
    if (isDemoMode()) {
      toast('Payments are switched off in the demo.');
      return;
    }
    if (provider === BILLING_PROVIDERS.GOOGLE_PLAY) {
      startPlayCheckout(plan);
      return;
    }
    if (provider === BILLING_PROVIDERS.PAYSTACK) {
      // Outside Kenya there is no M-Pesa: straight to card checkout.
      startCardCheckout(plan);
      return;
    }
    if (!provider) {
      toast('Purchases are not available on this device yet.');
      return;
    }
    // Same plan, payment still in progress or just finished: reopen onto
    // it. Anything else starts a fresh form.
    const resumable = mpesa.plan === plan && mpesa.phase !== 'form' && mpesa.phase !== 'failed';
    if (!resumable) dispatch({ type: 'reset', plan });
    setSheetOpen(true);
  }, [mpesa.plan, mpesa.phase, provider, startPlayCheckout, startCardCheckout]);

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
    restorePurchases,
    // Only the hosted popup is "loading" a button; the M-Pesa sheet covers
    // the page while it is open.
    loadingPlan,
    provider,
    // Google Play's own localised price strings, when Play is the provider.
    // Play policy expects the price a user sees to be the price Play charges.
    storePrices,
  }), [startCheckout, startCardCheckout, restorePurchases, loadingPlan, provider, storePrices]);

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
