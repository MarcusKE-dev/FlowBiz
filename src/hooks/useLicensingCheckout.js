// src/hooks/useLicensingCheckout.js
//
// Starting a FlowBiz payment. Kept as its own hook so every button that
// already calls `startCheckout(plan)` keeps working unchanged.
//
// `startCheckout` opens the M-Pesa sheet (see contexts/CheckoutContext).
// `startCardCheckout` opens Paystack's hosted popup for cards and other
// methods. Either way the browser sends a PLAN NAME and nothing else: the
// Worker prices it, and only a Paystack-verified payment grants anything.

import { useCheckout } from '../contexts/CheckoutContext';

export function useLicensingCheckout() {
  const { startCheckout, startCardCheckout, restorePurchases, loadingPlan, provider, storePrices } = useCheckout();
  return { startCheckout, startCardCheckout, restorePurchases, loadingPlan, provider, storePrices, busy: Boolean(loadingPlan) };
}
