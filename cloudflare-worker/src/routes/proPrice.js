import { json } from '../lib/response.js';
import { PRO_PLAN_AMOUNT_KES } from './paystackInitialize.js';

export async function handleProPrice() {
  return json({ amountKes: PRO_PLAN_AMOUNT_KES, currency: 'KES', periodDays: 30 });
}