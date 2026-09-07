// src/hooks/usePricing.js
//
// What FlowBiz charges, fetched from the Worker rather than written into
// a component. The Worker is the authority — it is what actually prices a
// checkout — so a screen that hard-coded a number could show one price
// and charge another.
//
// The constants in src/licensing/config.js are used only as the value to
// render while the request is in flight, and if the request fails. They
// are the same numbers, from the same place the Worker's copy comes from,
// so the fallback is never a different price; it is just the price
// without a round trip.

import { useEffect, useState } from 'react';
import {
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  PRO_PLAN_PRICE_KES,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_NOTICE_THRESHOLD_DAYS,
} from '../licensing';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

const FALLBACK = {
  currency: 'KES',
  pro: { amountKes: PRO_PLAN_PRICE_KES, periodDays: 30 },
  lifetime: { amountKes: LIFETIME_LICENSE_PRICE_KES, periodDays: null, includedServiceMonths: INCLUDED_SERVICE_MONTHS },
  annualServices: {
    amountKes: ANNUAL_SERVICE_PRICE_KES,
    periodMonths: RENEWAL_SERVICE_MONTHS,
    gracePeriodDays: GRACE_PERIOD_DAYS,
    renewalNoticeDays: RENEWAL_NOTICE_THRESHOLD_DAYS,
  },
};

let cached = null;
let inFlight = null;

export function usePricing() {
  const [pricing, setPricing] = useState(cached || FALLBACK);
  const [confirmed, setConfirmed] = useState(Boolean(cached));

  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    inFlight = inFlight || fetch(`${FLOWBIZ_API_URL}/api/pricing`).then((r) => r.json());
    inFlight
      .then((data) => {
        if (!data?.lifetime?.amountKes) return;
        cached = { ...FALLBACK, ...data };
        if (alive) { setPricing(cached); setConfirmed(true); }
      })
      .catch(() => { /* the fallback is the same price, so this is not an error state */ })
      .finally(() => { inFlight = null; });
    return () => { alive = false; };
  }, []);

  return { pricing, confirmed };
}
