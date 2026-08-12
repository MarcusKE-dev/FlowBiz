// Africa/Nairobi is a fixed UTC+3 with no DST, so business-day boundaries
// can be computed with a constant offset instead of the device's own
// (potentially different) local timezone. This keeps "today" consistent
// with todayKey() below, which drives dailySessions doc IDs.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDay(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiMidnightMs = Math.floor(nairobiMs / 86400000) * 86400000;
  return new Date(nairobiMidnightMs - NAIROBI_OFFSET_MS);
}
export function endOfDay(date = new Date()) {
  return new Date(startOfDay(date).getTime() + 86400000 - 1);
}
export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const nairobiDate = new Date(d.getTime() + NAIROBI_OFFSET_MS);
  const dayOfWeek = nairobiDate.getUTCDay();
  const diff = (dayOfWeek + 6) % 7;
  return new Date(d.getTime() - diff * 86400000);
}
export function startOfMonth(date = new Date()) {
  const nairobiMs = date.getTime() + NAIROBI_OFFSET_MS;
  const nairobiDate = new Date(nairobiMs);
  const firstOfMonthUTC = Date.UTC(nairobiDate.getUTCFullYear(), nairobiDate.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(firstOfMonthUTC - NAIROBI_OFFSET_MS);
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
  if (!d) return '—';
  return d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function formatDate(value) {
  const d = toJsDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric' });
}
export function todayKey(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(date);
  return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;
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
  const buckets = [];
  const stepMs = granularity === 'week' ? 7 * 86400000 : 86400000;
  let cursor = startOfDay(start);
  const endBoundary = endOfDay(end);
  while (cursor.getTime() <= endBoundary.getTime()) {
    const bucketEndMs = Math.min(cursor.getTime() + stepMs - 1, endBoundary.getTime());
    const bucketEnd = new Date(bucketEndMs);
    buckets.push({
      start: cursor,
      end: bucketEnd,
      label: cursor.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short' }),
    });
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return buckets;
}
