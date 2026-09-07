// src/utils/batches.js
//
// Batch and expiry tracking, and FEFO — first expired, first out.
//
// WHY THIS EXISTS, precisely. Kenya's Pharmacy and Poisons Board
// Guidelines for Good Pharmacy Practice require a retail pharmacy to keep
// "records of all stocks received including their source, batch number,
// expiry date and quantity received". That sentence is the specification
// for the document shape below, and it is the reason batch, expiry,
// supplier and received-quantity are all mandatory parts of a batch
// rather than optional extras.
//
// WHAT THIS IS NOT. FlowBiz is not a compliant pharmacy management
// system, and nothing here should be described as one. The same
// guidelines require a prescription/patient recording system and a
// separate controlled-drug register with a five-year retention rule;
// none of that is implemented, none of it is claimed, and adding it is a
// separately scoped piece of work with its own regulatory review.
//
// EXPIRY IS A DATE, NOT AN INSTANT. It is stored as a plain 'YYYY-MM-DD'
// string, because that is what is printed on the box. A Firestore
// Timestamp would make "expires today" depend on the device's timezone,
// which is exactly the kind of ambiguity a pharmacy cannot have. ISO
// date strings also sort lexicographically in the same order they sort
// chronologically, so Firestore can order by them directly.

import { roundQuantity, DEFAULT_UNIT } from '../industry/units.js';
import { roundMoney } from './currency.js';

export const DEFAULT_EXPIRY_WARNING_DAYS = 90;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as 'YYYY-MM-DD', in the device's own calendar. */
export function todayISO(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isValidExpiryDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. Negative is past. */
export function daysBetween(from, to) {
  if (!isValidExpiryDate(from) || !isValidExpiryDate(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export const EXPIRY_STATUS = { EXPIRED: 'expired', EXPIRING: 'expiring', OK: 'ok', UNKNOWN: 'unknown' };

/**
 * Where a batch stands. A batch expires at the END of its printed date,
 * so a box stamped 2026-09-04 is still good on 2026-09-04 and expired on
 * the 5th — which is how the date on the box is universally read.
 */
export function expiryStatus(batch, { today = todayISO(), warningDays = DEFAULT_EXPIRY_WARNING_DAYS } = {}) {
  const expiry = batch?.expiryDate;
  if (!isValidExpiryDate(expiry)) return EXPIRY_STATUS.UNKNOWN;
  const days = daysBetween(today, expiry);
  if (days < 0) return EXPIRY_STATUS.EXPIRED;
  if (days <= warningDays) return EXPIRY_STATUS.EXPIRING;
  return EXPIRY_STATUS.OK;
}

export function daysToExpiry(batch, today = todayISO()) {
  return isValidExpiryDate(batch?.expiryDate) ? daysBetween(today, batch.expiryDate) : null;
}

export function remainingOf(batch, unit = DEFAULT_UNIT) {
  return roundQuantity(Number(batch?.remainingQuantity ?? batch?.quantity) || 0, unit);
}

/**
 * FEFO order: earliest expiry first. A batch with no expiry date sorts
 * LAST rather than first — an unknown date is not an urgent one, and
 * treating it as year zero would sell the untraceable stock before
 * everything else, which is the opposite of what a pharmacy wants.
 * Ties break on when the batch was received, so the older delivery moves.
 */
export function sortFefo(batches) {
  return [...(batches || [])].sort((a, b) => {
    const aExpiry = isValidExpiryDate(a?.expiryDate) ? a.expiryDate : null;
    const bExpiry = isValidExpiryDate(b?.expiryDate) ? b.expiryDate : null;
    if (aExpiry !== bExpiry) {
      if (aExpiry === null) return 1;
      if (bExpiry === null) return -1;
      return aExpiry < bExpiry ? -1 : 1;
    }
    const aReceived = String(a?.receivedAt?.toDate?.()?.toISOString?.() ?? a?.receivedAt ?? '');
    const bReceived = String(b?.receivedAt?.toDate?.()?.toISOString?.() ?? b?.receivedAt ?? '');
    if (aReceived !== bReceived) return aReceived < bReceived ? -1 : 1;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/**
 * Allocate a quantity across batches, earliest-expiring first, splitting
 * across as many batches as it takes.
 *
 * Expired stock is EXCLUDED by default. Selling an expired medicine is the
 * failure this whole feature exists to prevent, and a system that silently
 * picks the expired box because it happens to expire soonest would be
 * worse than no batch tracking at all. `allowExpired` exists so a
 * deliberate, acknowledged decision can still be recorded rather than
 * blocked — but it is never the default.
 *
 * Returns what it COULD allocate plus the shortfall. It never throws and
 * never over-allocates, so the caller decides what to do about a short
 * count rather than discovering it mid-write.
 */
export function allocateFefo(batches, quantity, {
  unit = DEFAULT_UNIT,
  today = todayISO(),
  allowExpired = false,
} = {}) {
  const wanted = roundQuantity(Number(quantity) || 0, unit);
  const allocations = [];
  let remaining = wanted;
  let usedExpired = false;

  if (wanted > 0) {
    for (const batch of sortFefo(batches)) {
      if (remaining <= 0) break;
      const available = remainingOf(batch, unit);
      if (available <= 0) continue;
      const expired = expiryStatus(batch, { today }) === EXPIRY_STATUS.EXPIRED;
      if (expired && !allowExpired) continue;

      const take = roundQuantity(Math.min(available, remaining), unit);
      if (take <= 0) continue;
      if (expired) usedExpired = true;

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber || null,
        expiryDate: isValidExpiryDate(batch.expiryDate) ? batch.expiryDate : null,
        quantity: take,
        costPrice: Number(batch.costPrice) || 0,
      });
      remaining = roundQuantity(remaining - take, unit);
    }
  }

  return {
    allocations,
    allocated: roundQuantity(wanted - remaining, unit),
    shortfall: roundQuantity(Math.max(0, remaining), unit),
    usedExpired,
  };
}

/**
 * The true cost of a line, from the batches it was actually taken from.
 * A pharmacy that bought the same drug at two prices should see the
 * profit on the box it actually sold, not on an average nobody paid.
 */
export function allocatedUnitCost(allocations, fallbackCost = 0) {
  const total = (allocations || []).reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  if (total <= 0) return roundMoney(Number(fallbackCost) || 0);
  const cost = (allocations || []).reduce(
    (sum, a) => sum + (Number(a.quantity) || 0) * (Number(a.costPrice) || 0), 0
  );
  return roundMoney(cost / total);
}

/** How much of a product is on hand across its batches. */
export function batchStockFor(batches, productId, unit = DEFAULT_UNIT) {
  return roundQuantity(
    (batches || [])
      .filter((b) => b?.productId === productId)
      .reduce((sum, b) => sum + remainingOf(b, unit), 0),
    unit
  );
}

/** The same, but only counting stock that is actually sellable today. */
export function sellableBatchStockFor(batches, productId, { unit = DEFAULT_UNIT, today = todayISO() } = {}) {
  return roundQuantity(
    (batches || [])
      .filter((b) => b?.productId === productId && expiryStatus(b, { today }) !== EXPIRY_STATUS.EXPIRED)
      .reduce((sum, b) => sum + remainingOf(b, unit), 0),
    unit
  );
}

/**
 * The expiry picture, for the dashboard and the expiry page. Only batches
 * that still hold stock are counted — a finished batch cannot expire in
 * any sense that matters.
 */
export function summarizeExpiry(batches, products = [], {
  today = todayISO(), warningDays = DEFAULT_EXPIRY_WARNING_DAYS,
} = {}) {
  const costByProduct = new Map((products || []).map((p) => [p.id, Number(p.costPrice) || 0]));
  const groups = { expired: [], expiring: [], ok: [], unknown: [] };
  let expiredValue = 0;
  let expiringValue = 0;

  for (const batch of batches || []) {
    const remaining = remainingOf(batch);
    if (remaining <= 0) continue;
    const status = expiryStatus(batch, { today, warningDays });
    const row = {
      ...batch,
      remaining,
      status,
      daysToExpiry: daysToExpiry(batch, today),
    };
    groups[status].push(row);
    const value = remaining * (Number(batch.costPrice) || costByProduct.get(batch.productId) || 0);
    if (status === EXPIRY_STATUS.EXPIRED) expiredValue += value;
    if (status === EXPIRY_STATUS.EXPIRING) expiringValue += value;
  }

  const byExpiry = (a, b) => String(a.expiryDate || '9999').localeCompare(String(b.expiryDate || '9999'));
  groups.expired.sort(byExpiry);
  groups.expiring.sort(byExpiry);

  return {
    ...groups,
    expiredCount: groups.expired.length,
    expiringCount: groups.expiring.length,
    expiredValue: roundMoney(expiredValue),
    expiringValue: roundMoney(expiringValue),
    warningDays,
  };
}

/** The batch document a receiving writes. */
export function buildBatchDocument({
  productId, productName, batchNumber, expiryDate, quantity, costPrice,
  supplierId = null, supplierName = null, unit = DEFAULT_UNIT,
  receivedBy = null, receivedByName = null, at = new Date(),
}) {
  const received = roundQuantity(Number(quantity) || 0, unit);
  return {
    productId,
    productName: productName || '',
    batchNumber: String(batchNumber || '').trim().slice(0, 48) || null,
    expiryDate: isValidExpiryDate(expiryDate) ? expiryDate : null,
    quantity: received,
    remainingQuantity: received,
    costPrice: roundMoney(Number(costPrice) || 0),
    supplierId,
    supplierName,
    ...(unit !== DEFAULT_UNIT ? { unit } : {}),
    receivedBy,
    receivedByName,
    receivedAt: at,
  };
}
