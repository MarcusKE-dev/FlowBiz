// src/utils/tenders.js
//
// HOW A SALE WAS PAID FOR — one payment, or several.
//
// FlowBiz has always written a single `paymentMethod` string on a sale,
// and every financial calculation in the product splits cash from M-Pesa
// by reading it. That is correct for one payment and cannot express two:
// four people at a table paying 2,000 cash and 1,500 M-Pesa had to be
// recorded as two separate sales of half the food each, which is wrong in
// the sales history, wrong in the item analysis and wrong at close of day.
//
// THIS IS PLATFORM CORE, NOT FOOD SERVICE, and the placement is
// deliberate. Splitting a payment is a property of PAYMENT, not of
// restaurants: a hardware shop taking part cash and part M-Pesa for a
// roof needs exactly this, and the industry domain engines must never own
// a concept the platform's own money path depends on. utils/financials.js
// imports from here; nothing here imports from a domain engine.
//
// `paymentMethod` IS NOT BEING REMOVED and its meaning is not changing. A
// split-tender sale writes it as the method that paid the largest share,
// so every reader that predates tenders — the sales filter, the activity
// feed, the admin inspector, the CSV export — still files the sale where
// a human would expect to find it.

import { roundMoney } from './currency.js';

export const TENDER_METHODS = ['Cash', 'M-Pesa'];
export const MAX_TENDERS = 6;

export function isKnownTenderMethod(method) {
  return TENDER_METHODS.includes(method);
}

/**
 * Clean an entered tender list: known methods, positive amounts, bounded
 * count. Amounts are NOT reconciled against the check here — that is
 * tenderProblem()'s job, and it has to be able to describe the shortfall
 * rather than silently absorb it.
 */
export function normalizeTenders(raw) {
  const out = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_TENDERS) break;
    if (!isKnownTenderMethod(entry?.method)) continue;
    const amount = roundMoney(Number(entry?.amount) || 0);
    if (amount <= 0) continue;
    const tender = { method: entry.method, amount };
    const reference = String(entry?.reference ?? '').trim().slice(0, 40);
    if (reference) tender.reference = reference;
    out.push(tender);
  }
  return out;
}

export function tendersTotal(tenders) {
  return roundMoney((tenders || []).reduce((sum, t) => sum + (Number(t?.amount) || 0), 0));
}

/**
 * Do these tenders settle this check? Returns a message, or null.
 *
 * OVERPAYMENT IS REFUSED rather than treated as change. FlowBiz records
 * what was received, and a sale whose tenders exceed its total would
 * inflate the expected till by the difference and turn every close of day
 * into a hunt for money that was handed back over the counter. Change
 * given is not a payment.
 *
 * UNDERPAYMENT IS REFUSED because a partly-paid closed sale is a debt,
 * and FlowBiz already has a correct and separate model for a debt: a
 * credit sale against a named customer.
 */
export function tenderProblem(tenders, total) {
  const clean = normalizeTenders(tenders);
  if (clean.length === 0) return 'Add at least one payment.';
  const paid = tendersTotal(clean);
  const due = roundMoney(Number(total) || 0);
  const difference = roundMoney(paid - due);
  if (difference === 0) return null;
  if (difference > 0) return `That is ${difference.toFixed(2)} more than the bill. Reduce a payment.`;
  return `${Math.abs(difference).toFixed(2)} of the bill is still unpaid.`;
}

/**
 * THE COMPATIBILITY ACCESSOR. Every payment a sale, credit repayment or
 * refund represents, as a list, whatever shape it was written in.
 *
 * A sale with a `tenders` array returns it. A sale without one — which is
 * every sale FlowBiz has ever written — returns the single tender its
 * `paymentMethod` and `totalAmount` have always meant. This is the whole
 * reason split payments could be added to the financial engine without
 * changing one existing number.
 */
export function saleTenders(sale) {
  const stored = normalizeTenders(sale?.tenders);
  if (stored.length > 0) return stored;
  const method = sale?.paymentMethod;
  if (!isKnownTenderMethod(method)) return [];
  const amount = roundMoney(Number(sale?.totalAmount) || 0);
  if (amount <= 0) return [];
  return [{ method, amount }];
}

/** How much of a sale was settled in one particular method. */
export function tenderedIn(sale, method) {
  return roundMoney(
    saleTenders(sale)
      .filter((t) => t.method === method)
      .reduce((sum, t) => sum + t.amount, 0)
  );
}

/**
 * The single `paymentMethod` a split-tender sale is filed under: whichever
 * method paid the most, ties going to cash.
 *
 * This field is not decoration. Every existing reader in the product —
 * the sales list's filter, the activity feed, the admin inspector, the
 * CSV export, and any report written before tenders existed — classifies
 * a sale by it, and a null or a new sentinel value would make a
 * split-tender sale disappear from all of them.
 */
export function dominantMethod(tenders) {
  const clean = normalizeTenders(tenders);
  if (clean.length === 0) return 'Cash';
  const byMethod = new Map();
  for (const tender of clean) {
    byMethod.set(tender.method, roundMoney((byMethod.get(tender.method) || 0) + tender.amount));
  }
  let best = 'Cash';
  let bestAmount = -1;
  for (const method of TENDER_METHODS) {
    const amount = byMethod.get(method) || 0;
    if (amount > bestAmount) { best = method; bestAmount = amount; }
  }
  return best;
}

/**
 * The tender fields a sale document carries. Written ONLY when the sale
 * was genuinely split, so a one-method sale — every retail sale, and most
 * restaurant ones — stores nothing new at all.
 */
export function tenderSaleFields(tenders) {
  const clean = normalizeTenders(tenders);
  if (clean.length <= 1) return {};
  return { tenders: clean };
}
