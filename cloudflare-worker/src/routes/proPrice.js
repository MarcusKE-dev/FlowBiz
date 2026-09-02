import { json } from '../lib/response.js';
import { PRO_PLAN_AMOUNT_KES, LIFETIME_PLAN_AMOUNT_KES } from './paystackInitialize.js';

// Kept unchanged (shape and route) for any existing caller that only knows
// about the monthly plan. New callers should use /api/pricing instead.
export async function handleProPrice() {
  return json({ amountKes: PRO_PLAN_AMOUNT_KES, currency: 'KES', periodDays: 30 });
}

export async function handlePricing() {
  return json({
    currency: 'KES',
    pro: { amountKes: PRO_PLAN_AMOUNT_KES, periodDays: 30 },
    lifetime: { amountKes: LIFETIME_PLAN_AMOUNT_KES, periodDays: null },
  });
}