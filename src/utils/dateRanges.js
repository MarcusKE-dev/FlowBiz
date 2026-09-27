// BUSINESS-DAY BOUNDARIES, IN THE BUSINESS'S OWN TIMEZONE.
//
// These used to add a fixed UTC+3 to every instant, which was right for
// Nairobi (no daylight saving) and for nobody else. They now ask
// src/lib/region/time.js, which uses the IANA timezone from the open
// business's region settings and handles 23- and 25-hour days. A
// business with no region stored is on Africa/Nairobi, so every existing
// Kenyan shop computes exactly the boundaries it always did — the region
// tests pin that across a whole year.
//
// Every function still takes a date and nothing else; an optional last
// argument names a timezone for the admin console and for tests.

import {
  startOfBusinessDay, endOfBusinessDay, startOfBusinessWeek, startOfBusinessMonth,
  startOfNextBusinessDay, businessDayKey, formatInBusinessZone,
  startOfBusinessDateKey, endOfBusinessDateKey, startOfBusinessDayOffset,
} from '../lib/region/time.js';

/** A date <input>'s 'YYYY-MM-DD' as the start / end of that business day. */
export function startOfDateInput(key, timeZone) {
  return startOfBusinessDateKey(key, timeZone);
}
export function endOfDateInput(key, timeZone) {
  return endOfBusinessDateKey(key, timeZone);
}
/** Start of the business day `days` calendar days from `date` (negative is back). */
export function shiftDays(date, days, timeZone) {
  return startOfBusinessDayOffset(date, days, timeZone);
}

export function startOfDay(date = new Date(), timeZone) {
  return startOfBusinessDay(date, timeZone);
}
export function endOfDay(date = new Date(), timeZone) {
  return endOfBusinessDay(date, timeZone);
}
export function startOfWeek(date = new Date(), timeZone) {
  return startOfBusinessWeek(date, timeZone);
}
export function startOfMonth(date = new Date(), timeZone) {
  return startOfBusinessMonth(date, timeZone);
}
export function getRangeForPreset(preset) {
  const now = new Date();
  switch (preset) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':  return { start: startOfWeek(now), end: endOfDay(now) };
    case 'month': return { start: startOfMonth(now), end: endOfDay(now) };
    default:      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
export function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}
export function formatDateTime(value) {
  const d = toJsDate(value);
  if (!d) return '-';
  return formatInBusinessZone(d, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function formatDate(value) {
  const d = toJsDate(value);
  if (!d) return '-';
  return formatInBusinessZone(d, { day: '2-digit', month: 'short', year: 'numeric' });
}
// The business day as 'YYYY-MM-DD'. This is the dailySessions document id,
// so it must be the business's calendar date and nothing else.
export function todayKey(date = new Date(), timeZone) {
  return businessDayKey(date, timeZone);
}

// ── Added for the Advanced Analytics redesign ──────────────────────────
// Nothing above this line changed. These two helpers are additive only.

// Converts a Firestore Timestamp, JS Date, or date-like value to millis —
// used to sort/bucket raw records (sales, expenses, repayments) by day.
export function toMillisValue(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Splits [start, end] into consecutive day or week buckets with a short
// display label — used to build trend charts from raw record arrays
// without inventing any data the app doesn't already have.
export function buildDateBuckets(start, end, granularity = 'day') {
  // Steps by CALENDAR days, not by 86,400,000 ms: a daylight-saving day is
  // 23 or 25 hours long, and a fixed step drifts a bucket into the next day.
  const buckets = [];
  const stepDays = granularity === 'week' ? 7 : 1;
  let cursor = startOfDay(start);
  const endBoundary = endOfDay(end);
  while (cursor.getTime() <= endBoundary.getTime()) {
    let next = cursor;
    for (let i = 0; i < stepDays; i += 1) next = startOfNextBusinessDay(next);
    const bucketEnd = new Date(Math.min(next.getTime() - 1, endBoundary.getTime()));
    buckets.push({
      start: cursor,
      end: bucketEnd,
      label: formatInBusinessZone(cursor, { day: '2-digit', month: 'short' }),
    });
    cursor = next;
  }
  return buckets;
}
