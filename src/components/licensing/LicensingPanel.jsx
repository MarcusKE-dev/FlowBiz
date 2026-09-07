// src/components/licensing/LicensingPanel.jsx
//
// The customer's own view of what they own and what they rent.
//
// It is built as TWO SEPARATE STATEMENTS, never one status line, because
// the whole commercial model is that these are two different things:
//
//     Lifetime Licence            Active. No expiry.
//     Cloud Services & Maintenance Active until 6 September 2027
//
// A single "subscription status" row would collapse that distinction and
// is exactly what this replaces.

import { Link } from 'react-router-dom';
import { CloudOff, Check, ShieldCheck } from 'lucide-react';
import Section from '../ui/Section';
import StatusPill from '../ui/StatusPill';
import { StatementRow } from '../ui/StatementBlock';
import { useAuth } from '../../contexts/AuthContext';
import { useLicensingCheckout } from '../../hooks/useLicensingCheckout';
import { ANNUAL_SERVICE_PLAN_ID, SERVICE_STATUS } from '../../licensing';
import {
  SERVICE_PRICE_PER_YEAR, RENEW_BUTTON_LABEL, WHAT_RENEWAL_PROVIDES,
  DATA_IS_SAFE, OFFLINE_FALLBACK_SUMMARY,
  formatServiceDate, formatDaysRemaining,
} from './licensingCopy';

function serviceTone(status, suspended) {
  if (suspended) return 'negative';
  if (status === SERVICE_STATUS.ACTIVE || status === SERVICE_STATUS.GRANDFATHERED) return 'positive';
  if (status === SERVICE_STATUS.GRACE) return 'caution';
  return 'negative';
}

function serviceHeadline(entitlements) {
  const { service, cloud } = entitlements;
  if (cloud.suspendedByAdmin) return 'Suspended';
  switch (service.status) {
    case SERVICE_STATUS.ACTIVE:
      return `Active until ${formatServiceDate(service.lastCoveredDay)}`;
    case SERVICE_STATUS.GRACE:
      return `Ended ${formatServiceDate(service.lastCoveredDay)}, in grace period`;
    case SERVICE_STATUS.EXPIRED:
      return 'Expired';
    case SERVICE_STATUS.GRANDFATHERED:
      return 'Included with your licence';
    default:
      return 'Not applicable';
  }
}

export default function LicensingPanel({ showRenewButton = true }) {
  const { entitlements, isOwner } = useAuth();
  const { startCheckout, loadingPlan } = useLicensingCheckout();

  const { license, service, cloud } = entitlements;
  if (!license.owned) return null;

  const suspended = cloud.suspendedByAdmin;
  const lapsed = service.status === SERVICE_STATUS.EXPIRED || suspended;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* ── What the customer OWNS ── */}
        <div className="rounded-panel border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label uppercase text-ink-500">Lifetime Licence</p>
              <p className="mt-1 font-display text-page-title text-ink-900">Active</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary-600" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <p className="mt-2 text-secondary leading-relaxed text-ink-600">
            You own a permanent right to use the licensed FlowBiz application. This licence has no expiry
            date and is not cancelled if you choose not to renew the annual service fee.
          </p>
          {license.purchasedAt && (
            <p className="mt-3 text-label text-ink-500">
              Purchased {formatServiceDate(license.purchasedAt)}
            </p>
          )}
        </div>

        {/* ── What the customer RENTS ── */}
        <div className={`rounded-panel border p-5 ${lapsed ? 'border-warning-200 bg-warning-50' : 'border-line bg-surface'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-label uppercase text-ink-500">Cloud Services &amp; Maintenance</p>
              <p className="mt-1 font-display text-page-title text-ink-900">
                {serviceHeadline(entitlements)}
              </p>
            </div>
            <StatusPill tone={serviceTone(service.status, suspended)}>
              {suspended ? 'Suspended' : service.status === SERVICE_STATUS.ACTIVE ? 'Active'
                : service.status === SERVICE_STATUS.GRACE ? 'Grace period'
                  : service.status === SERVICE_STATUS.GRANDFATHERED ? 'Included' : 'Expired'}
            </StatusPill>
          </div>

          <div className="mt-4 divide-y divide-divider rounded-panel border border-line bg-surface">
            <StatementRow label="Renewal" value={SERVICE_PRICE_PER_YEAR} />
            {service.status === SERVICE_STATUS.ACTIVE && (
              <StatementRow label="Days remaining" value={formatDaysRemaining(service.daysRemaining)} />
            )}
            {service.status === SERVICE_STATUS.GRACE && (
              <StatementRow
                label="Grace period remaining"
                value={formatDaysRemaining(service.daysRemainingInGrace)}
                tone="negative"
              />
            )}
            {service.expiryDate && (
              <StatementRow
                label={service.status === SERVICE_STATUS.ACTIVE ? 'Covered until' : 'Cover ended'}
                value={formatServiceDate(service.lastCoveredDay)}
              />
            )}
            {service.lastPaymentAt && (
              <StatementRow label="Last payment" value={formatServiceDate(service.lastPaymentAt)} />
            )}
          </div>

          {showRenewButton && isOwner && !suspended && (
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={Boolean(loadingPlan)}
              onClick={() => startCheckout(ANNUAL_SERVICE_PLAN_ID)}
            >
              {loadingPlan === ANNUAL_SERVICE_PLAN_ID ? 'Loading…'
                : lapsed ? 'Renew now' : RENEW_BUTTON_LABEL}
            </button>
          )}

          {suspended && (
            <p className="mt-4 text-secondary leading-relaxed text-ink-600">
              FlowBiz has suspended cloud services for this business. Your Lifetime Licence is unaffected.
              Please contact FlowBiz support.
              {cloud.suspendedReason ? ` Reason on file: ${cloud.suspendedReason}` : ''}
            </p>
          )}
        </div>
      </div>

      <Section
        title="Included with the annual renewal"
        hint={`${SERVICE_PRICE_PER_YEAR}. Your Lifetime Licence itself never expires and is never charged again.`}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {WHAT_RENEWAL_PROVIDES.map((item) => (
            <li key={item} className="flex items-start gap-2 text-secondary text-ink-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.75} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {lapsed && (
        <Section
          title="What happens while cloud services are paused"
          hint="Your licence and your business data are not affected."
        >
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            <div className="divide-y divide-divider">
              {OFFLINE_FALLBACK_SUMMARY.map(({ label, value }) => (
                <StatementRow
                  key={label}
                  label={label}
                  value={value}
                  tone={value === 'Paused' ? 'muted' : 'positive'}
                />
              ))}
            </div>
          </div>
          <p className="flex items-start gap-2 text-secondary leading-relaxed text-ink-600">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
            <span>{DATA_IS_SAFE}</span>
          </p>
        </Section>
      )}

      <p className="text-secondary text-ink-400">
        The full terms are in the{' '}
        <Link to="/terms" className="font-semibold text-ink-600 underline underline-offset-2">Terms of Service</Link>
        {' '}and the{' '}
        <Link to="/privacy" className="font-semibold text-ink-600 underline underline-offset-2">Privacy Policy</Link>.
      </p>
    </div>
  );
}
