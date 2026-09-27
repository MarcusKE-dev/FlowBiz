// src/routes/proPrice.js
//
// The public price list. Unauthenticated on purpose — the landing page
// and the in-app checkout both read it, and there is nothing secret about
// what FlowBiz charges. It is also the ONLY price the browser is allowed
// to believe: nothing in the client hard-codes an amount, so changing
// lib/licensing.js changes every screen at once.

import { json } from '../lib/response.js';
import {
  PRO_PLAN_PRICE_KES,
  PRO_PLAN_PERIOD_DAYS,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_NOTICE_THRESHOLD_DAYS,
  ANNUAL_SERVICE_INCLUSIONS,
  CURRENCY,
  PRICE_BOOKS,
  PRICING_REGION_KE,
  pricingRegionForCountry,
  priceBook,
} from '../lib/licensing.js';

// Kept unchanged (shape and route) for any existing caller that only knows
// about the monthly plan. New callers should use /api/pricing instead.
export async function handleProPrice() {
  return json({ amountKes: PRO_PLAN_PRICE_KES, currency: CURRENCY, periodDays: PRO_PLAN_PERIOD_DAYS });
}

/**
 * GET /api/pricing[?country=US | ?region=INTL]
 *
 * With no parameter this is the Kenyan price list, in exactly the shape it
 * has always had. `country` (ISO 3166) or `region` (a PRICE_BOOKS id)
 * selects another book. This is a DISPLAY answer only: what a checkout
 * actually charges is decided by /api/paystack/initialize from the
 * business's stored country, so asking for a cheaper book here buys
 * nothing.
 *
 * Every amount appears twice for compatibility: `amount` in the book's
 * currency, and `amountKes` only when that currency is KES.
 */
export async function handlePricing(request) {
  let regionId = PRICING_REGION_KE;
  try {
    const url = new URL(request?.url || 'https://x/');
    const region = url.searchParams.get('region');
    const country = url.searchParams.get('country');
    if (region && PRICE_BOOKS[region]) regionId = region;
    else if (country) regionId = pricingRegionForCountry(country);
  } catch { /* the default book */ }

  const book = priceBook(regionId);
  const kes = book.currency === 'KES';
  const money = (amount) => ({ amount, ...(kes ? { amountKes: amount } : {}) });

  return json({
    region: book.id,
    currency: book.currency,
    pro: { ...money(book.prices.pro), periodDays: PRO_PLAN_PERIOD_DAYS },
    // The perpetual licence. `periodDays: null` is not an oversight — a
    // licence has no period, and the field is kept for the callers that
    // already read this shape.
    lifetime: {
      ...money(book.prices.lifetime),
      periodDays: null,
      includedServiceMonths: INCLUDED_SERVICE_MONTHS,
    },
    // The renewable annual services entitlement. A separate object
    // because it is a separate thing from the licence, all the way down.
    annualServices: {
      ...money(book.prices.annual_services),
      periodMonths: RENEWAL_SERVICE_MONTHS,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      renewalNoticeDays: RENEWAL_NOTICE_THRESHOLD_DAYS,
      includes: ANNUAL_SERVICE_INCLUSIONS,
    },
  });
}
