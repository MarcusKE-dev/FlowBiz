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
  LIFETIME_LICENSE_PRICE_KES,
  ANNUAL_SERVICE_PRICE_KES,
  INCLUDED_SERVICE_MONTHS,
  RENEWAL_SERVICE_MONTHS,
  GRACE_PERIOD_DAYS,
  RENEWAL_NOTICE_THRESHOLD_DAYS,
  ANNUAL_SERVICE_INCLUSIONS,
  CURRENCY,
} from '../lib/licensing.js';

// Kept unchanged (shape and route) for any existing caller that only knows
// about the monthly plan. New callers should use /api/pricing instead.
export async function handleProPrice() {
  return json({ amountKes: PRO_PLAN_PRICE_KES, currency: CURRENCY, periodDays: PRO_PLAN_PERIOD_DAYS });
}

export async function handlePricing() {
  return json({
    currency: CURRENCY,
    pro: { amountKes: PRO_PLAN_PRICE_KES, periodDays: PRO_PLAN_PERIOD_DAYS },
    // The perpetual licence. `periodDays: null` is not an oversight — a
    // licence has no period, and the field is kept for the callers that
    // already read this shape.
    lifetime: {
      amountKes: LIFETIME_LICENSE_PRICE_KES,
      periodDays: null,
      includedServiceMonths: INCLUDED_SERVICE_MONTHS,
    },
    // The renewable annual services entitlement. A separate object
    // because it is a separate thing from the licence, all the way down.
    annualServices: {
      amountKes: ANNUAL_SERVICE_PRICE_KES,
      periodMonths: RENEWAL_SERVICE_MONTHS,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      renewalNoticeDays: RENEWAL_NOTICE_THRESHOLD_DAYS,
      includes: ANNUAL_SERVICE_INCLUSIONS,
    },
  });
}
