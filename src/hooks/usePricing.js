// src/hooks/usePricing.js
//
// What FlowBiz charges, fetched from the Worker rather than written into
// a component. The Worker is the authority — it is what actually prices a
// checkout — so a screen that hard-coded a number could show one price
// and charge another.
//
// WHICH PRICE BOOK: the open business's country (Kenya pays KES, everyone
// else the international USD book — see PRICE_BOOKS in
// src/licensing/config.js). Signed-out pages pass `country` explicitly.
//
// The local price book is rendered while the request is in flight and if
// it fails. It is the same numbers, from the same file the Worker imports,
// so the fallback is never a different price; it is just the price
// without a round trip.

import { useEffect, useState } from 'react';
import {
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_NOTICE_THRESHOLD_DAYS,
  PRO_PLAN_PERIOD_DAYS,
  priceBook,
  pricingRegionForCountry,
} from '../licensing';
import { useRegion } from './useRegion';
import { isDemoMode } from '../demo/demoMode';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

/** The /api/pricing shape, built from the local price book. */
export function localPricing(regionId) {
  const book = priceBook(regionId);
  const kes = book.currency === 'KES';
  const money = (amount) => ({ amount, ...(kes ? { amountKes: amount } : {}) });
  return {
    region: book.id,
    currency: book.currency,
    pro: { ...money(book.prices.pro), periodDays: PRO_PLAN_PERIOD_DAYS },
    lifetime: { ...money(book.prices.lifetime), periodDays: null, includedServiceMonths: INCLUDED_SERVICE_MONTHS },
    annualServices: {
      ...money(book.prices.annual_services),
      periodMonths: RENEWAL_SERVICE_MONTHS,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      renewalNoticeDays: RENEWAL_NOTICE_THRESHOLD_DAYS,
    },
  };
}

const cache = new Map();
const inFlight = new Map();

/**
 * @param {{ country?: string }} [options] a country for signed-out pages;
 *   otherwise the open business's.
 * @returns {{ pricing, confirmed }} `pricing.<plan>.amount` in `pricing.currency`.
 */
export function usePricing({ country } = {}) {
  const region = useRegion();
  const regionId = pricingRegionForCountry(country || region.country);
  const [state, setState] = useState(() => ({
    regionId,
    pricing: cache.get(regionId) || localPricing(regionId),
    confirmed: cache.has(regionId),
  }));

  useEffect(() => {
    let alive = true;
    if (cache.has(regionId)) {
      setState({ regionId, pricing: cache.get(regionId), confirmed: true });
      return undefined;
    }
    setState({ regionId, pricing: localPricing(regionId), confirmed: false });
    // The demo talks to no server at all; the local book is the same price.
    if (isDemoMode()) return () => { alive = false; };
    let request = inFlight.get(regionId);
    if (!request) {
      request = fetch(`${FLOWBIZ_API_URL}/api/pricing?region=${encodeURIComponent(regionId)}`).then((r) => r.json());
      inFlight.set(regionId, request);
    }
    request
      .then((data) => {
        if (!Number.isFinite(data?.lifetime?.amount)) return;
        // Only a Worker that NAMES the book it answered from is believed. A
        // Worker deployed before regional pricing ignores ?region= and
        // answers in KES; showing that to a US business would quote the
        // wrong currency, so the local book (identical to the server's)
        // stands instead.
        if (data.region !== regionId) return;
        const normalised = { ...localPricing(regionId), ...data };
        cache.set(regionId, normalised);
        if (alive) setState({ regionId, pricing: normalised, confirmed: true });
      })
      .catch(() => { /* the fallback is the same price, so this is not an error state */ })
      .finally(() => { inFlight.delete(regionId); });
    return () => { alive = false; };
  }, [regionId]);

  return { pricing: state.pricing, confirmed: state.confirmed };
}
