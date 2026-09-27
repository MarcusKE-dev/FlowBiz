# Countries, currencies, locales and timezones

How FlowBiz stopped being a Kenyan product and became a product that
serves Kenya — and every other country — correctly.

Written September 2026.

---

## 1. The rule

**Kenya is one supported market, not an assumption baked into the code.**
A business has a region; the region decides how money is shown, when the
business day starts, what a phone number means and what the counter calls
its non-cash tender. Nothing is decided from the device's location.

## 2. Where everything lives

| Concern | File |
|---|---|
| Country table (defaults per country) | `src/lib/region/countries.js` |
| Resolving a stored region, validation, the active region | `src/lib/region/region.js` |
| Money formatting (`Intl.NumberFormat`) | `src/lib/region/money.js` |
| Business-day boundaries, IANA timezones, DST | `src/lib/region/time.js` |
| E.164 phone normalisation | `src/lib/region/phone.js` |
| React: `useRegion()`, `useBusinessToday()` | `src/hooks/useRegion.js` |
| Owner UI | `src/components/settings/RegionSettings.jsx` (Settings → Country, currency and time) |
| Sign-up | `src/pages/Setup.jsx` (country picker) |
| Security rules | `regionOk()` in `firestore.rules` |
| Tests | `src/lib/region/region.test.js` |

`src/lib/region/` is pure — no React, no Firebase, no `import.meta` — so
the Cloudflare Worker imports it directly (public receipts, reminder
emails), exactly as it imports `src/licensing/`.

## 3. The data model

One map on `businessSettings/{businessId}`:

```
region: {
  country,             ISO 3166-1 alpha-2   'KE', 'US', 'GB'
  currency,            ISO 4217             'KES', 'USD', 'GBP'
  locale,              BCP 47               'en-KE', 'en-US'
  timezone,            IANA                 'Africa/Nairobi', 'America/Chicago'
  phoneCountryCode,    digits               '254', '1', '44'
  digitalTenderLabel?  what the counter calls the non-cash tender
  currencyDisplay?     'code' | 'symbol'
}
```

It lives on `businessSettings` because that document already has exactly
one shared listener (`SettingsContext`), so the region costs zero extra
reads, and because it is owner-writable there under the same rules as
every other business setting.

### Migration: none needed

**No stored region means Kenya.** Every business created before this
existed is Kenyan and stores nothing, so `resolveRegion(undefined)` is
KES / Africa/Nairobi / en-KE / +254 / "M-Pesa". No document is rewritten
and no backfill runs. Tests pin that Kenyan money output is byte-for-byte
what `formatKES` printed, and that Nairobi day boundaries are identical to
the old fixed UTC+3 arithmetic for every hour of a year.

New businesses get a full region at sign-up (`defaultRegionFor(country)`).
A partly-filled or invalid region is completed from its country's
defaults, never left half-set.

## 4. Money

**Formatting never changes a number.** Every amount is stored as a plain
number in the business's own currency. `roundMoney()` (two decimals) is
still the only rounding the accounting engine does. Nothing converts
between currencies, anywhere.

- `formatMoney(v)` — the business's currency via `Intl.NumberFormat`.
  Kenya keeps `KES 1,234.00` (code display); elsewhere a symbol (`$1,234.00`,
  `1.234,50 €`) in the business locale.
- `formatPdfMoney(v)` — always code display (`NGN 1,234.00`), because
  jsPDF's built-in fonts cannot draw ₦, ₹, ₱ and most other symbols.
- `currencyMarker()` / `formatAmount()` — the split "muted prefix, bold
  digits" presentation used by metrics and statements.
- `formatCount()` — plain counts, grouped for the locale.

**Three-decimal currencies are refused** (KWD, BHD, OMR, JOD, TND, LYD,
IQD). Every money path rounds to two decimals; supporting them would mean
changing the accounting engine. `isSupportedCurrency()` enforces this.

**Changing a business's currency relabels, it does not convert.** Settings
confirms this in plain words before saving. Converting history at today's
rate would falsify every past report, so FlowBiz never does it.

## 5. The non-cash tender ("M-Pesa")

Every sale, daily session and report splits cash from the second tender
using the stored string `'M-Pesa'` (`paymentMethod`, `openingMpesaFloat`,
`actualMpesaAtClose`, `totalMpesaSales`…). **That key is internal and
unchanged.** Renaming it would be a migration of every sale ever recorded
for a label change.

What a person reads comes from `tenderLabel('M-Pesa')`: "M-Pesa" in Kenya,
"Card" in the US and UK, "Mobile money" in Uganda, "UPI" in India, or
whatever the owner types in Settings. The transaction-code field is
**required** only where the tender is literally M-Pesa (so close of day
can match the till statement — CR-7); elsewhere it is an optional
reference.

## 6. Time: the business day

`src/lib/region/time.js` decides which business day an instant belongs
to, **in the business's IANA timezone** — not the device's (a manager in
Nairobi checking a London shop sees London's day) and not UTC (which would
end a Nairobi day at 3 a.m.).

- Day boundaries are found by asking what the wall clock reads, never by
  adding 86,400,000 ms. Daylight-saving days are 23 or 25 hours and are
  handled; so is a zone that skips midnight itself (America/Santiago).
- `todayKey()` — the `dailySessions` document id — is the business's
  calendar date.
- Date inputs (`'YYYY-MM-DD'`) are converted with `startOfDateInput()`;
  `new Date('2026-09-26')` is UTC midnight, which is the 25th in Los Angeles.
- `useBusinessToday()` rolls "today" over at the business's midnight; the
  dashboard previously kept yesterday's range until reloaded.
- Timestamps are still stored as Firestore Timestamps (UTC instants).

Changing the timezone moves day boundaries from then on; past daily
sessions keep the dates they were opened under.

## 7. Phone numbers and WhatsApp

`toE164Digits(raw)` reads a typed number using the business's country:
international forms (`+44…`, `0044…`) as written, a trunk prefix (`0` in
Kenya and the UK, `1` in the US) replaced by the country code, a bare
national number prefixed. `+254` is never assumed for a non-Kenyan
business. Owner phone numbers are stored in E.164 from sign-up.

This is deliberately not libphonenumber (~150 KB of metadata); it answers
the question WhatsApp links actually ask.

## 8. Adding a country

Add a row to `COUNTRIES` in `countries.js`. The table test validates every
row (ISO codes, a real IANA zone, a supported currency, a valid locale).
Nothing else changes: an owner could already pick any currency or timezone
Intl knows.

## 9. Known limitations

- The UI language is English everywhere; `locale` controls number and date
  formatting only.
- Three-decimal currencies are not supported (§4).
- Tax (VAT/GST) is not modelled per country; FlowBiz has never computed tax.
- Existing Kenyan receipts, CSV exports and PDFs are unchanged by design.
