// src/lib/region/region.test.js
//
// Country, currency, timezone and phone behaviour for a business. The
// Kenyan cases are pinned first and exactly: every business created
// before regional settings existed stores no region, and must see
// precisely what it saw before.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COUNTRIES, countriesForPicker, timezonesForCountry,
  resolveRegion, defaultRegionFor, regionForStorage, DEFAULT_REGION,
  getActiveRegion, setActiveRegion, subscribeActiveRegion,
  isSupportedCurrency, isValidTimeZone, isValidLocale,
  tenderLabel, isMpesaRegion,
  formatMoney, formatMoneyCompact, formatAmount, currencyMarker, formatCount,
  businessDayKey, startOfBusinessDay, endOfBusinessDay, startOfNextBusinessDay,
  startOfBusinessWeek, startOfBusinessMonth, businessWeekday, zoneOffsetMs,
  msUntilNextBusinessDay, formatInBusinessZone,
  toE164Digits, toE164,
} from './index.js';

const KE = resolveRegion({ country: 'KE' });
const US = resolveRegion({ country: 'US' });
const GB = resolveRegion({ country: 'GB' });
const NY = resolveRegion({ country: 'US', timezone: 'America/New_York' });
const LA = resolveRegion({ country: 'US', timezone: 'America/Los_Angeles' });
const UG = resolveRegion({ country: 'UG' });

// ── The table ─────────────────────────────────────────────────────────

test('every country row is internally valid', () => {
  const seen = new Set();
  for (const c of COUNTRIES) {
    assert.ok(!seen.has(c.code), `duplicate ${c.code}`);
    seen.add(c.code);
    assert.match(c.code, /^[A-Z]{2}$/);
    assert.ok(isSupportedCurrency(c.currency), `${c.code}: ${c.currency} must be a supported currency`);
    assert.ok(isValidTimeZone(c.timezone), `${c.code}: ${c.timezone}`);
    for (const tz of timezonesForCountry(c.code)) assert.ok(isValidTimeZone(tz), `${c.code}: ${tz}`);
    assert.ok(timezonesForCountry(c.code).includes(c.timezone), `${c.code}: default timezone must be offered`);
    assert.ok(isValidLocale(c.locale), `${c.code}: ${c.locale}`);
    assert.match(c.dialCode, /^[1-9]\d{0,3}$/);
    assert.ok(c.nationalLengths.length > 0);
    assert.ok(c.digitalTender);
  }
});

test('the picker pins the main markets first and lists every country once', () => {
  const list = countriesForPicker();
  assert.equal(list[0].code, 'KE');
  assert.equal(list.length, COUNTRIES.length);
  assert.equal(new Set(list.map((c) => c.code)).size, COUNTRIES.length);
});

test('three-decimal currencies are refused, because roundMoney is two decimals', () => {
  for (const code of ['KWD', 'BHD', 'OMR', 'JOD', 'TND']) assert.equal(isSupportedCurrency(code), false, code);
  for (const code of ['KES', 'USD', 'GBP', 'EUR', 'JPY', 'UGX', 'NGN']) assert.equal(isSupportedCurrency(code), true, code);
  assert.equal(isSupportedCurrency('XXXX'), false);
  assert.equal(isSupportedCurrency('kes'), false);
});

// ── Resolution and the migration ──────────────────────────────────────

test('NO STORED REGION IS KENYA — the migration for every existing business', () => {
  for (const input of [undefined, null, {}, { region: null }, { shopName: 'Duka' }, 'garbage', 42]) {
    const r = resolveRegion(input);
    assert.equal(r.country, 'KE');
    assert.equal(r.currency, 'KES');
    assert.equal(r.timezone, 'Africa/Nairobi');
    assert.equal(r.locale, 'en-KE');
    assert.equal(r.phoneCountryCode, '254');
    assert.equal(r.digitalTenderLabel, 'M-Pesa');
    assert.equal(r.currencyDisplay, 'code');
  }
  assert.deepEqual(DEFAULT_REGION, resolveRegion(null));
});

test('the settings document or its region map both resolve', () => {
  assert.equal(resolveRegion({ region: { country: 'GB' } }).currency, 'GBP');
  assert.equal(resolveRegion({ country: 'GB' }).currency, 'GBP');
});

test('a country fills in everything it is not told', () => {
  assert.deepEqual(
    { c: US.currency, t: US.timezone, l: US.locale, p: US.phoneCountryCode, d: US.currencyDisplay },
    { c: 'USD', t: 'America/New_York', l: 'en-US', p: '1', d: 'symbol' },
  );
  assert.deepEqual(
    { c: GB.currency, t: GB.timezone, p: GB.phoneCountryCode },
    { c: 'GBP', t: 'Europe/London', p: '44' },
  );
});

test('explicit choices win, invalid ones fall back to the country default', () => {
  const r = resolveRegion({ country: 'US', timezone: 'America/Chicago', currency: 'EUR' });
  assert.equal(r.timezone, 'America/Chicago');
  assert.equal(r.currency, 'EUR');
  const bad = resolveRegion({ country: 'US', timezone: 'Mars/Olympus', currency: 'KWD', locale: '!!', phoneCountryCode: 'abc' });
  assert.equal(bad.timezone, 'America/New_York');
  assert.equal(bad.currency, 'USD');
  assert.equal(bad.locale, 'en-US');
  assert.equal(bad.phoneCountryCode, '1');
});

test('the currency never follows the device — only the stored region decides it', () => {
  // resolveRegion takes no device input at all; this pins that it stays so.
  assert.equal(resolveRegion.length, 1);
  assert.equal(resolveRegion({ country: 'KE' }).currency, 'KES');
});

test('defaultRegionFor is what sign-up stores, and it round-trips', () => {
  const stored = defaultRegionFor('GB');
  assert.deepEqual(stored, { country: 'GB', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London', phoneCountryCode: '44' });
  assert.equal(resolveRegion(stored).currency, 'GBP');
  assert.equal(defaultRegionFor('ZZ').country, 'KE');
});

test('regionForStorage keeps only rule-accepted fields and drops a default tender label', () => {
  assert.deepEqual(Object.keys(regionForStorage({ country: 'KE', junk: 1 })).sort(),
    ['country', 'currency', 'locale', 'phoneCountryCode', 'timezone']);
  assert.equal(regionForStorage({ country: 'KE', digitalTenderLabel: 'M-Pesa' }).digitalTenderLabel, undefined);
  assert.equal(regionForStorage({ country: 'KE', digitalTenderLabel: '  Airtel   Money ' }).digitalTenderLabel, 'Airtel Money');
});

// ── Tenders ───────────────────────────────────────────────────────────

test('the stored M-Pesa key is labelled for the region, and nothing else is relabelled', () => {
  assert.equal(tenderLabel('M-Pesa', KE), 'M-Pesa');
  assert.equal(tenderLabel('M-Pesa', US), 'Card');
  assert.equal(tenderLabel('M-Pesa', UG), 'Mobile money');
  assert.equal(tenderLabel('M-Pesa', resolveRegion({ country: 'US', digitalTenderLabel: 'Venmo' })), 'Venmo');
  assert.equal(tenderLabel('Cash', US), 'Cash');
  assert.equal(tenderLabel('Credit', US), 'Credit');
  assert.equal(isMpesaRegion(KE), true);
  assert.equal(isMpesaRegion(US), false);
});

// ── Money ─────────────────────────────────────────────────────────────

test('KENYAN OUTPUT IS BYTE-FOR-BYTE WHAT formatKES ALWAYS PRINTED', () => {
  const legacy = (v) => `KES ${(Number(v) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  for (const v of [0, 1, 1234, 1234.5, 0.1 + 0.2, -5, -1234.56, 1e7, 'abc', null, undefined, NaN]) {
    assert.equal(formatMoney(v, { region: KE }), legacy(v).replace(/[\u00a0\u202f]/g, ' '), `for ${v}`);
  }
  // The one deliberate difference: the old formatter printed "KES ∞".
  assert.equal(formatMoney(Infinity, { region: KE }), 'KES 0.00');
  assert.equal(formatMoneyCompact(1234.6, { region: KE }), 'KES 1,235');
  assert.equal(currencyMarker({ region: KE }), 'KES');
  assert.equal(formatAmount(1234, { region: KE }), '1,234.00');
});

test('other currencies use their own symbol, placement and minor units', () => {
  assert.equal(formatMoney(1234.5, { region: US }), '$1,234.50');
  assert.equal(formatMoney(1234.5, { region: GB }), '£1,234.50');
  assert.equal(formatMoney(-12, { region: US }), '-$12.00');
  // UGX has no minor unit.
  assert.equal(formatAmount(1234.4, { region: UG }), '1,234');
  // A locale that writes the symbol after the number.
  const de = resolveRegion({ country: 'DE' });
  assert.equal(formatMoney(1234.5, { region: de }), '1.234,50 €');
  assert.equal(currencyMarker({ region: US }), '$');
  assert.equal(currencyMarker({ region: de }), '€');
});

test('code display is available everywhere, for PDFs', () => {
  assert.equal(formatMoney(1234.5, { region: US, display: 'code' }), 'USD 1,234.50');
  assert.equal(formatMoney(1234.5, { region: resolveRegion({ country: 'NG' }), display: 'code' }), 'NGN 1,234.50');
  assert.equal(currencyMarker({ region: US, display: 'code' }), 'USD');
});

test('formatting never changes the number it is given', () => {
  const value = 0.1 + 0.2;
  formatMoney(value, { region: US });
  assert.equal(value, 0.30000000000000004);
});

test('counts are grouped for the locale', () => {
  assert.equal(formatCount(12480, { region: KE }), '12,480');
  assert.equal(formatCount(12480, { region: resolveRegion({ country: 'DE' }) }), '12.480');
});

// ── The active region ─────────────────────────────────────────────────

test('the active region defaults to Kenya, switches, notifies and restores', () => {
  assert.equal(getActiveRegion().country, 'KE');
  const seen = [];
  const off = subscribeActiveRegion((r) => seen.push(r.currency));
  try {
    assert.equal(setActiveRegion({ country: 'GB' }), true);
    assert.equal(formatMoney(5), '£5.00');
    assert.equal(setActiveRegion({ country: 'GB' }), false, 'an identical region is not a change');
    assert.deepEqual(seen, ['GBP']);
  } finally {
    setActiveRegion(null);
    off();
  }
  assert.equal(formatMoney(5), 'KES 5.00');
});

// ── Timezones: the business day ───────────────────────────────────────

test('NAIROBI: identical to the old fixed UTC+3 arithmetic, for a whole year of hours', () => {
  const OFFSET = 3 * 3600000;
  const legacyStart = (d) => new Date(Math.floor((d.getTime() + OFFSET) / 86400000) * 86400000 - OFFSET);
  const start = Date.UTC(2026, 0, 1);
  for (let t = start; t < start + 366 * 86400000; t += 3600000 * 5 + 17 * 60000) {
    const d = new Date(t);
    assert.equal(startOfBusinessDay(d, 'Africa/Nairobi').getTime(), legacyStart(d).getTime(), d.toISOString());
    assert.equal(endOfBusinessDay(d, 'Africa/Nairobi').getTime(), legacyStart(d).getTime() + 86400000 - 1);
  }
});

test('midnight rollover: 23:59:59 and 00:00:00 belong to different business days', () => {
  // 20:59:59Z is 23:59:59 in Nairobi; one second later is the next day.
  assert.equal(businessDayKey(new Date('2026-09-26T20:59:59Z'), 'Africa/Nairobi'), '2026-09-26');
  assert.equal(businessDayKey(new Date('2026-09-26T21:00:00Z'), 'Africa/Nairobi'), '2026-09-27');
  // The same instant is a different business day in London and Los Angeles.
  const instant = new Date('2026-09-26T23:30:00Z');
  assert.equal(businessDayKey(instant, 'Europe/London'), '2026-09-27');
  assert.equal(businessDayKey(instant, 'America/Los_Angeles'), '2026-09-26');
  assert.equal(businessDayKey(instant, 'UTC'), '2026-09-26');
});

test('a business day never ends at UTC midnight unless the business is on UTC', () => {
  const day = startOfBusinessDay(new Date('2026-06-15T12:00:00Z'), 'America/Chicago');
  assert.equal(day.toISOString(), '2026-06-15T05:00:00.000Z');
});

test('DST spring forward: the day is 23 hours, and nothing is double-counted', () => {
  // US clocks go forward 8 March 2026. New York midnight is 05:00Z before, 04:00Z after.
  const s = startOfBusinessDay(new Date('2026-03-08T15:00:00Z'), 'America/New_York');
  const e = startOfNextBusinessDay(new Date('2026-03-08T15:00:00Z'), 'America/New_York');
  assert.equal(s.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(e.toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(e - s, 23 * 3600000);
  // London goes forward 29 March 2026.
  const ls = startOfBusinessDay(new Date('2026-03-29T12:00:00Z'), 'Europe/London');
  const le = startOfNextBusinessDay(new Date('2026-03-29T12:00:00Z'), 'Europe/London');
  assert.equal(le - ls, 23 * 3600000);
});

test('DST fall back: the day is 25 hours, and the repeated hour stays in one day', () => {
  // US clocks go back 1 November 2026.
  const s = startOfBusinessDay(new Date('2026-11-01T12:00:00Z'), 'America/New_York');
  const e = startOfNextBusinessDay(s, 'America/New_York');
  assert.equal(e - s, 25 * 3600000);
  // Both 01:30s (05:30Z and 06:30Z) are the same business day.
  assert.equal(businessDayKey(new Date('2026-11-01T05:30:00Z'), 'America/New_York'), '2026-11-01');
  assert.equal(businessDayKey(new Date('2026-11-01T06:30:00Z'), 'America/New_York'), '2026-11-01');
});

test('a zone that skips midnight itself still gets a first instant of the day', () => {
  // Chile's clocks go forward at 00:00 on 6 Sep 2026 (00:00 → 01:00).
  const tz = 'America/Santiago';
  const s = startOfBusinessDay(new Date('2026-09-06T15:00:00Z'), tz);
  assert.equal(businessDayKey(s, tz), '2026-09-06');
  assert.equal(businessDayKey(new Date(s.getTime() - 1), tz), '2026-09-05');
});

test('consecutive business days tile time with no gaps and no overlaps, across DST, in many zones', () => {
  for (const tz of ['Africa/Nairobi', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'America/Santiago', 'Asia/Kolkata', 'Pacific/Auckland']) {
    let start = startOfBusinessDay(new Date('2026-01-01T12:00:00Z'), tz);
    for (let i = 0; i < 370; i += 1) {
      const next = startOfNextBusinessDay(start, tz);
      assert.ok(next > start, `${tz} day ${i}`);
      const len = next - start;
      assert.ok(len >= 22 * 3600000 && len <= 26 * 3600000, `${tz}: day ${i} is ${len / 3600000}h`);
      assert.equal(endOfBusinessDay(start, tz).getTime(), next.getTime() - 1);
      assert.equal(businessDayKey(new Date(next.getTime() - 1), tz) < businessDayKey(next, tz), true);
      start = next;
    }
  }
});

test('weeks start on Monday and months on the 1st, on the business calendar', () => {
  // Sunday 27 Sep 2026, 23:30 in Nairobi.
  const sunday = new Date('2026-09-27T20:30:00Z');
  assert.equal(businessWeekday(sunday, 'Africa/Nairobi'), 0);
  assert.equal(businessDayKey(startOfBusinessWeek(sunday, 'Africa/Nairobi'), 'Africa/Nairobi'), '2026-09-21');
  // …which is already Monday 28 Sep in Auckland.
  assert.equal(businessDayKey(startOfBusinessWeek(sunday, 'Pacific/Auckland'), 'Pacific/Auckland'), '2026-09-28');
  assert.equal(startOfBusinessMonth(new Date('2026-03-15T12:00:00Z'), 'Europe/London').toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(startOfBusinessMonth(new Date('2026-07-15T12:00:00Z'), 'Europe/London').toISOString(), '2026-06-30T23:00:00.000Z');
});

test('offsets and timers', () => {
  assert.equal(zoneOffsetMs(new Date('2026-07-01T00:00:00Z'), 'Africa/Nairobi'), 3 * 3600000);
  assert.equal(zoneOffsetMs(new Date('2026-07-01T00:00:00Z'), 'America/Los_Angeles'), -7 * 3600000);
  assert.equal(zoneOffsetMs(new Date('2026-07-01T00:00:00Z'), 'Asia/Kolkata'), 5.5 * 3600000);
  assert.equal(msUntilNextBusinessDay(new Date('2026-09-26T20:59:00Z'), 'Africa/Nairobi'), 60000);
});

test('the active region timezone is the default timezone', () => {
  const instant = new Date('2026-09-26T23:30:00Z');
  assert.equal(businessDayKey(instant), '2026-09-27', 'Nairobi by default');
  setActiveRegion({ country: 'US', timezone: 'America/Los_Angeles' });
  try {
    assert.equal(businessDayKey(instant), '2026-09-26');
  } finally {
    setActiveRegion(null);
  }
});

test('dates are displayed on the business clock, not the device clock', () => {
  const instant = new Date('2026-09-26T23:30:00Z');
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  assert.match(formatInBusinessZone(instant, opts, { region: KE }), /^27 /);
  assert.match(formatInBusinessZone(instant, opts, { region: LA }), /26/);
  assert.match(formatInBusinessZone(instant, opts, { region: NY }), /26/);
});

// ── Phone numbers ─────────────────────────────────────────────────────

test('Kenyan numbers normalise exactly as before', () => {
  for (const typed of ['0741104469', '+254741104469', '+254 741 104 469', '254741104469', '741104469', '0741 104 469']) {
    assert.equal(toE164Digits(typed, { region: KE }), '254741104469', typed);
  }
  assert.equal(toE164Digits('0111234567', { region: KE }), '254111234567');
  assert.equal(toE164('0741104469', { region: KE }), '+254741104469');
});

test('US, UK and other national forms become E.164', () => {
  assert.equal(toE164Digits('(415) 555-2671', { region: US }), '14155552671');
  assert.equal(toE164Digits('1 415 555 2671', { region: US }), '14155552671');
  assert.equal(toE164Digits('+1 415 555 2671', { region: US }), '14155552671');
  assert.equal(toE164Digits('07911 123456', { region: GB }), '447911123456');
  assert.equal(toE164Digits('+44 7911 123456', { region: GB }), '447911123456');
  assert.equal(toE164Digits('0772 123456', { region: UG }), '256772123456');
});

test('an international number is taken as written, whatever the business country', () => {
  assert.equal(toE164Digits('+254741104469', { region: US }), '254741104469');
  assert.equal(toE164Digits('00447911123456', { region: KE }), '447911123456');
  assert.equal(toE164Digits('+256772123456', { region: KE }), '256772123456');
});

test('+254 is never assumed for a non-Kenyan business', () => {
  assert.notEqual(toE164Digits('0741104469', { region: US })?.slice(0, 3), '254');
  assert.equal(toE164Digits('741104469', { region: GB }), null);
});

test('junk is refused', () => {
  for (const junk of ['', '   ', 'abc', '12', '+12', '1234567890123456789', null, undefined]) {
    assert.equal(toE164Digits(junk, { region: KE }), null, String(junk));
  }
});
