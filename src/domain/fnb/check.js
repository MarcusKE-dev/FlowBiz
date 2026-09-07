// src/domain/fnb/check.js
//
// THE CHECK — what a ticket costs, what came off it, what was added to
// it, and how it was paid for.
//
// THREE THINGS FOOD SERVICE NEEDS THAT RETAIL DOES NOT, and FlowBiz had
// none of them:
//
//   A DISCOUNT. A manager takes 500 off a table because the main came out
//   cold. Retail's answer — edit the unit price — destroys the record: the
//   sale then says the steak costs 1,300, the menu says 1,800, and there
//   is nothing anywhere saying a discount was given, by whom, or why.
//
//   A SERVICE CHARGE. Added AFTER the discount, on the discounted amount,
//   which is the order every hospitality system uses and the only order
//   that is defensible to a customer reading the bill.
//
//   SPLIT PAYMENT. Four people at a table pay 2,000 cash, 1,500 M-Pesa
//   and 900 M-Pesa. FlowBiz stored one `paymentMethod` string, so the only
//   way to record that was three separate sales of a third of the food
//   each — which is wrong in the sales history, wrong in the item
//   analysis, and wrong at close of day.
//
// WHAT IS DELIBERATELY NOT HERE.
//
//   NO TAX ENGINE. FlowBiz prices are tax-inclusive and the product
//   expressly makes no claim about VAT, eTIMS or KRA compliance (see the
//   Terms). A tax field that is not backed by real tax handling is worse
//   than no field, because it looks like compliance. Prices stay
//   tax-inclusive and this module does not invent a tax line.
//
//   NO TIP LINE. A tip is money that passes through the business to a
//   person, and recording it as revenue without a distribution ledger
//   overstates income and understates what is owed to staff. FlowBiz has
//   no payroll, so it has no honest place to put a tip. A house that adds
//   a service charge is charging for service, which IS the business's
//   revenue, and that is the case this supports.
//
//   NO SEPARATELY-CLOSED SUB-CHECKS. Splitting a party into checks that
//   are each closed and receipted independently would be a fourth entity
//   between the ticket and the line. It is not needed, because lines are
//   their own documents: moving some of them to a second ticket IS a
//   split check, and each ticket is then charged normally. One primitive,
//   no new entity. See planLineMove() in ticket.js.
//
// THE ORDER OF OPERATIONS, once, so that nothing recomputes it its own
// way:
//
//     gross          Σ live line totals, at menu price with modifiers
//   − discount       a manager's reduction, reason recorded
//   = net sales      what the food and drink was actually sold for
//   + service charge net sales × rate
//   = TOTAL          the amount charged, and the ONLY field that has to
//                    match what FlowBiz has always written
//
// That last line is the compatibility contract. `totalAmount` keeps
// meaning "the money this sale brought in", so computeFinancials(), close
// of day, the till reconciliation, every report and every export are
// correct on a discounted, service-charged, split-tender restaurant sale
// without being changed at all. The new fields are additions that explain
// the total; they never redefine it.

import { roundMoney } from '../../utils/currency.js';

export const DISCOUNT_TYPES = Object.freeze({ PERCENT: 'percent', AMOUNT: 'amount' });

/** A discount can take a check to zero and never below it. */
export const MAX_DISCOUNT_PERCENT = 100;
/** A service charge above this is far more likely to be a typo than a policy. */
export const MAX_SERVICE_CHARGE_PERCENT = 30;
export const MAX_REASON_LENGTH = 120;

/**
 * Clean a stored or entered discount. Anything unusable becomes NO
 * discount rather than a partial one — a malformed discount that silently
 * became "50% off" is the failure this shape exists to make impossible.
 */
export function normalizeDiscount(raw) {
  if (!raw) return null;
  const type = raw.type === DISCOUNT_TYPES.PERCENT ? DISCOUNT_TYPES.PERCENT : DISCOUNT_TYPES.AMOUNT;
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const bounded = type === DISCOUNT_TYPES.PERCENT
    ? Math.min(MAX_DISCOUNT_PERCENT, value)
    : roundMoney(value);
  const reason = String(raw.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_REASON_LENGTH);
  return { type, value: bounded, ...(reason ? { reason } : {}) };
}

/**
 * What a discount takes off a given gross amount.
 *
 * Never more than the gross: a 2,000-shilling voucher on a 1,500-shilling
 * bill discounts 1,500, it does not hand over 500. A check that could go
 * negative would make a sale that pays the customer, and every downstream
 * total — revenue, gross profit, the till — would then be wrong in a way
 * nobody would look for.
 */
export function discountAmountOn(gross, discount) {
  const clean = normalizeDiscount(discount);
  if (!clean) return 0;
  const base = Math.max(0, Number(gross) || 0);
  const raw = clean.type === DISCOUNT_TYPES.PERCENT
    ? base * (clean.value / 100)
    : clean.value;
  return roundMoney(Math.min(base, Math.max(0, raw)));
}

/** A service-charge rate as a percentage, bounded and never negative. */
export function normalizeServiceChargeRate(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_SERVICE_CHARGE_PERCENT, roundMoney(value));
}

/**
 * THE CHECK TOTAL. One function, used by the ticket screen, the checkout
 * panel and the code that writes the sale, so the number on the screen
 * and the number in the database are produced by the same arithmetic.
 *
 * `lines` are live ticket lines or sale line items — both carry
 * `lineTotal` and `lineCost`, which is the whole reason the two shapes
 * were kept identical.
 */
export function computeCheck(lines, { discount = null, serviceChargeRate = 0 } = {}) {
  const rows = lines || [];
  const grossAmount = roundMoney(rows.reduce((sum, l) => sum + (Number(l?.lineTotal) || 0), 0));
  // COST IS NOT REDUCED BY A DISCOUNT. Taking 500 off the bill does not
  // make the steak cheaper to buy. Gross margin on a discounted check is
  // genuinely lower, and that is the fact the owner needs to see.
  const costOfGoodsSold = roundMoney(rows.reduce((sum, l) => sum + (Number(l?.lineCost) || 0), 0));

  const discountAmount = discountAmountOn(grossAmount, discount);
  const netSales = roundMoney(grossAmount - discountAmount);

  const rate = normalizeServiceChargeRate(serviceChargeRate);
  const serviceChargeAmount = rate > 0 ? roundMoney(netSales * (rate / 100)) : 0;

  const totalAmount = roundMoney(netSales + serviceChargeAmount);

  return {
    grossAmount,
    discount: normalizeDiscount(discount),
    discountAmount,
    netSales,
    serviceChargeRate: rate,
    serviceChargeAmount,
    totalAmount,
    costOfGoodsSold,
    // Gross profit on a check includes the service charge, because a
    // service charge is revenue the business keeps and it carries no cost
    // of goods. Food cost percentage is reported against NET SALES alone
    // — see costing.js — because mixing a service charge into the
    // denominator would flatter every food-cost figure a kitchen reads.
    grossProfit: roundMoney(totalAmount - costOfGoodsSold),
  };
}

/**
 * The fields a check contributes to the sale document.
 *
 * ABSENT WHEN THEY SAY NOTHING. A sale with no discount and no service
 * charge writes neither field, so a shop that uses neither — which is
 * every retail business in FlowBiz — produces byte-for-byte the document
 * it always did, and every existing reader is provably unaffected.
 */
export function checkSaleFields(check) {
  const fields = {};
  if (!check) return fields;
  if (check.discountAmount > 0) {
    fields.grossAmount = check.grossAmount;
    fields.discountAmount = check.discountAmount;
    if (check.discount?.type) fields.discountType = check.discount.type;
    if (check.discount?.value) fields.discountValue = check.discount.value;
    if (check.discount?.reason) fields.discountReason = check.discount.reason;
  }
  if (check.serviceChargeAmount > 0) {
    fields.grossAmount = check.grossAmount;
    fields.serviceChargeAmount = check.serviceChargeAmount;
    fields.serviceChargeRate = check.serviceChargeRate;
  }
  return fields;
}

// Tenders — how a check was actually paid for — are PLATFORM CORE, in
// src/utils/tenders.js, not here. Splitting a payment is a property of
// payment rather than of food service, utils/financials.js depends on it,
// and the platform's money path must never import from an industry domain
// engine. A screen that needs both imports each from where it lives.
