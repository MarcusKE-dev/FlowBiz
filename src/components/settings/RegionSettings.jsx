// src/components/settings/RegionSettings.jsx
//
// COUNTRY, CURRENCY AND TIME — the business's region, owner-only.
//
// Picking a country fills in the rest from that country's defaults, and
// each field can then be changed on its own: a Somali shop that trades in
// shillings rather than dollars, a US business on Chicago time, a Kenyan
// shop that calls its till "Airtel Money".
//
// CHANGING THE CURRENCY IS CONFIRMED, and the confirmation says exactly
// what it does. FlowBiz stores amounts as plain numbers in the business's
// currency; it never converts them. So switching KES to USD makes a
// KES 1,000 sale read as $1,000.00 — a relabel, not a conversion. That is
// the correct behaviour (converting history at today's rate would falsify
// every past report) but nobody should find it out by surprise.
//
// Changing the TIMEZONE moves where every business day starts and ends
// from now on. Past daily sessions keep the dates they were opened under.

import { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useSettings } from '../../contexts/SettingsContext';
import { raceWithTimeout } from '../../utils/offlineWrite';
import ConfirmDialog from '../common/ConfirmDialog';
import {
  countriesForPicker, countryByCode, timezonesForCountry,
  resolveRegion, regionForStorage, supportedCurrencies, supportedTimeZones,
  formatMoney,
} from '../../lib/region';

export default function RegionSettings({ businessId, canEdit }) {
  const { settings } = useSettings();
  const stored = useMemo(() => resolveRegion(settings), [settings]);

  const [draft, setDraft] = useState(null);
  const current = draft || {
    country: stored.country,
    currency: stored.currency,
    timezone: stored.timezone,
    locale: stored.locale,
    phoneCountryCode: stored.phoneCountryCode,
    digitalTenderLabel: stored.digitalTenderLabel,
  };
  const [saving, setSaving] = useState(false);
  const [confirmCurrency, setConfirmCurrency] = useState(false);
  const [showAllZones, setShowAllZones] = useState(false);

  const countries = useMemo(() => countriesForPicker(), []);
  const currencies = useMemo(() => supportedCurrencies(), []);
  const allZones = useMemo(() => (showAllZones ? supportedTimeZones() : []), [showAllZones]);
  const countryZones = timezonesForCountry(current.country);
  const zoneOptions = showAllZones
    ? allZones
    : Array.from(new Set([...countryZones, current.timezone]));

  const preview = resolveRegion(current);
  const dirty = draft !== null;
  const currencyChanged = current.currency !== stored.currency;

  const update = (patch) => setDraft({ ...current, ...patch });

  const pickCountry = (code) => {
    const c = countryByCode(code);
    if (!c) return;
    // A new country brings its own defaults for everything, including the
    // tender name — keeping "M-Pesa" after moving a business to London
    // would be exactly the Kenya-by-default problem this screen fixes.
    setDraft({
      country: c.code,
      currency: c.currency,
      timezone: c.timezone,
      locale: c.locale,
      phoneCountryCode: c.dialCode,
      digitalTenderLabel: c.digitalTender,
    });
  };

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      const write = setDoc(doc(db, 'businessSettings', businessId), { region: regionForStorage(current) }, { merge: true });
      const { queuedOffline, error } = await raceWithTimeout(write, 4000);
      if (error) throw error;
      setDraft(null);
      toast.success(queuedOffline ? 'Saved offline. It will sync when you reconnect.' : 'Region saved');
    } catch (err) {
      toast.error(err?.code === 'permission-denied'
        ? 'Only the business owner can change the region.'
        : 'The region could not be saved. Please try again.');
    } finally {
      setSaving(false);
      setConfirmCurrency(false);
    }
  };

  const onSave = (e) => {
    e.preventDefault();
    if (currencyChanged) setConfirmCurrency(true);
    else save();
  };

  if (!canEdit) {
    return (
      <div className="space-y-1">
        <Row label="Country" value={stored.countryName} />
        <Row label="Currency" value={stored.currency} />
        <Row label="Timezone" value={stored.timezone.replace(/_/g, ' ')} />
        <p className="pt-1 text-secondary text-ink-500">Only the owner can change these.</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSave}>
      <div>
        <label className="label" htmlFor="region-country">Country</label>
        <select id="region-country" className="input" value={current.country} onChange={(e) => pickCountry(e.target.value)}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="region-currency">Currency</label>
          <select id="region-currency" className="input" value={current.currency} onChange={(e) => update({ currency: e.target.value })}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="region-timezone">Timezone</label>
          <select id="region-timezone" className="input" value={current.timezone} onChange={(e) => update({ timezone: e.target.value })}>
            {zoneOptions.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
          </select>
          {!showAllZones && (
            <button type="button" className="mt-1 text-secondary font-medium text-primary-700 underline underline-offset-2" onClick={() => setShowAllZones(true)}>
              Show all timezones
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="region-tender">Name of your non-cash payment</label>
        <input
          id="region-tender"
          className="input"
          maxLength={24}
          value={current.digitalTenderLabel}
          onChange={(e) => update({ digitalTenderLabel: e.target.value })}
          placeholder="M-Pesa, Card, Mobile money…"
        />
        <p className="mt-1 text-secondary text-ink-500">
          What the counter, close of day and reports call the second way customers pay, beside Cash.
        </p>
      </div>

      <div className="rounded-panel border border-line bg-canvas px-3 py-2.5 text-secondary text-ink-600">
        Prices will look like <span className="num font-semibold text-ink-900">{formatMoney(1234.5, { region: preview })}</span>.
        Business days run midnight to midnight, {preview.timezone.replace(/_/g, ' ')} time.
      </div>

      <div className="flex gap-2">
        {dirty && (
          <button type="button" className="btn-secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save region'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmCurrency}
        title={`Change currency to ${current.currency}?`}
        message={`Amounts you have already recorded will NOT be converted. A sale recorded as ${formatMoney(1000, { region: stored })} will show as ${formatMoney(1000, { region: preview })}.\n\nOnly change the currency if the business has not started trading, or if the amounts were entered in the wrong currency.`}
        confirmLabel="Change currency"
        danger
        confirmDisabled={saving}
        onConfirm={save}
        onCancel={() => setConfirmCurrency(false)}
      />
    </form>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-body">
      <span className="text-ink-600">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}
