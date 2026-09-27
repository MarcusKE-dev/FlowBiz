// src/lib/region/time.js
//
// THE BUSINESS DAY, IN THE BUSINESS'S OWN TIMEZONE.
//
// FlowBiz stores instants (Firestore Timestamps, which are UTC) and
// decides which business day an instant belongs to here. The answer is
// never the device's timezone — a manager checking the London shop from
// Nairobi must see London's day — and never UTC, which would end a
// Nairobi shop's day at 3 a.m. It is the timezone in the business's
// region settings.
//
// This replaces a fixed UTC+3 offset. That was correct for Nairobi, which
// has no daylight saving, and wrong everywhere else twice a year, when a
// day is 23 or 25 hours long. Nothing below assumes a day is 86,400,000
// milliseconds: day boundaries are always found by asking what the wall
// clock reads, and stepping a day means "the start of the next calendar
// date", not "plus 24 hours".
//
// Pure: Intl only. Formatters are cached per timezone because
// constructing an Intl.DateTimeFormat is far more expensive than using
// one, and the reports call these in loops.

import { getActiveRegion } from './region.js';

const HOUR_MS = 3600000;

const partsFormatters = new Map();
function partsFormatter(timeZone) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'short',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function tzOf(timeZone) {
  return timeZone || getActiveRegion().timezone;
}

function toMs(date) {
  if (date instanceof Date) return date.getTime();
  if (typeof date === 'number') return date;
  if (date && typeof date.toMillis === 'function') return date.toMillis();
  if (date && typeof date.toDate === 'function') return date.toDate().getTime();
  return new Date(date ?? Date.now()).getTime();
}

/** The wall clock in `timeZone` at `date`: { year, month (1-12), day, hour, minute, second, weekday (0=Sun) }. */
export function zonedParts(date = new Date(), timeZone) {
  const tz = tzOf(timeZone);
  const out = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(toMs(date)))) {
    if (p.type === 'weekday') out.weekday = WEEKDAYS[p.value];
    else if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Milliseconds `timeZone` is ahead of UTC at `date` (negative west of Greenwich). */
export function zoneOffsetMs(date = new Date(), timeZone) {
  const ms = toMs(date);
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (ms - (ms % 1000 + 1000) % 1000);
}

function dateKeyOf(p) {
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * The first instant of the calendar date year-month-day in `timeZone`.
 * Month and day may overflow (day 0, day 32) exactly as Date.UTC allows,
 * which is how callers step by calendar days and months.
 *
 * Normally that is local midnight. Where a daylight-saving change skips
 * midnight itself (it does in a few zones), it is the first instant that
 * exists on that date.
 */
export function startOfZonedDate(year, month, day, timeZone) {
  const tz = tzOf(timeZone);
  const wall = Date.UTC(year, month - 1, day);
  const target = new Date(wall);
  const targetKey = dateKeyOf({ year: target.getUTCFullYear(), month: target.getUTCMonth() + 1, day: target.getUTCDate() });

  // Two passes: the offset at the guess can differ from the offset at the
  // answer when a transition sits between them.
  let t = wall - zoneOffsetMs(wall, tz);
  t = wall - zoneOffsetMs(t, tz);

  // A skipped midnight lands t on the PREVIOUS date. Walk forward to the
  // first instant that reads as the target date.
  let guard = 0;
  while (dateKeyOf(zonedParts(t, tz)) < targetKey && guard < 16) {
    t += 15 * 60000;
    guard += 1;
  }
  // And make sure no earlier instant also reads as the target date (an
  // overlap at midnight, when clocks go back across it).
  guard = 0;
  while (dateKeyOf(zonedParts(t - HOUR_MS, tz)) === targetKey && guard < 4) {
    t -= HOUR_MS;
    guard += 1;
  }
  return new Date(t);
}

/** 'YYYY-MM-DD' of the business day `date` falls in. Drives dailySessions document ids. */
export function businessDayKey(date = new Date(), timeZone) {
  return dateKeyOf(zonedParts(date, timeZone));
}

export function startOfBusinessDay(date = new Date(), timeZone) {
  const p = zonedParts(date, timeZone);
  return startOfZonedDate(p.year, p.month, p.day, timeZone);
}

/** The start of the business day after the one `date` falls in. */
export function startOfNextBusinessDay(date = new Date(), timeZone) {
  const p = zonedParts(date, timeZone);
  return startOfZonedDate(p.year, p.month, p.day + 1, timeZone);
}

/** The last millisecond of the business day `date` falls in. */
export function endOfBusinessDay(date = new Date(), timeZone) {
  return new Date(startOfNextBusinessDay(date, timeZone).getTime() - 1);
}

/** Monday of the business week `date` falls in. */
export function startOfBusinessWeek(date = new Date(), timeZone) {
  const p = zonedParts(date, timeZone);
  const sinceMonday = (p.weekday + 6) % 7;
  return startOfZonedDate(p.year, p.month, p.day - sinceMonday, timeZone);
}

export function startOfBusinessMonth(date = new Date(), timeZone) {
  const p = zonedParts(date, timeZone);
  return startOfZonedDate(p.year, p.month, 1, timeZone);
}

/** 0 = Sunday … 6 = Saturday, on the business's calendar. */
export function businessWeekday(date = new Date(), timeZone) {
  return zonedParts(date, timeZone).weekday;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The start of the business day named by a 'YYYY-MM-DD' string — what a
 * date <input> produces. `new Date('2026-09-26')` is UTC midnight, which is
 * the 25th in Los Angeles; this is the 26th in whatever zone the business is.
 * Returns null for anything that is not a date key.
 */
export function startOfBusinessDateKey(key, timeZone) {
  const m = DATE_KEY.exec(String(key || ''));
  if (!m) return null;
  return startOfZonedDate(Number(m[1]), Number(m[2]), Number(m[3]), timeZone);
}

export function endOfBusinessDateKey(key, timeZone) {
  const m = DATE_KEY.exec(String(key || ''));
  if (!m) return null;
  return new Date(startOfZonedDate(Number(m[1]), Number(m[2]), Number(m[3]) + 1, timeZone).getTime() - 1);
}

/** The start of the business day `days` calendar days from the one `date` is in. */
export function startOfBusinessDayOffset(date, days, timeZone) {
  const p = zonedParts(date, timeZone);
  return startOfZonedDate(p.year, p.month, p.day + Math.trunc(Number(days) || 0), timeZone);
}

/** Milliseconds until the current business day ends. For "today" timers. */
export function msUntilNextBusinessDay(now = new Date(), timeZone) {
  return Math.max(0, startOfNextBusinessDay(now, timeZone).getTime() - toMs(now));
}

// ── Display ───────────────────────────────────────────────────────────

const displayFormatters = new Map();
function displayFormatter(locale, timeZone, options) {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let f = displayFormatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    } catch {
      f = new Intl.DateTimeFormat('en', { ...options, timeZone });
    }
    displayFormatters.set(key, f);
  }
  return f;
}

/**
 * Format an instant on the business's clock and in its locale.
 * `options` are Intl.DateTimeFormat options.
 */
export function formatInBusinessZone(date, options, { region = getActiveRegion() } = {}) {
  const ms = toMs(date);
  if (!Number.isFinite(ms)) return '-';
  return displayFormatter(region.locale, region.timezone, options).format(new Date(ms));
}
