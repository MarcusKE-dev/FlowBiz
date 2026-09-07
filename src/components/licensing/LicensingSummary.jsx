// src/components/licensing/LicensingSummary.jsx
//
// The compact form of LicensingPanel, for the Settings list: two lines,
// two facts, and a renewal button when one is due. The full statement
// lives on /pro; this is the version that fits between "Data" and
// "Backup and restore" without turning Settings into a billing page.

import { useAuth } from '../../contexts/AuthContext';
import { useLicensingCheckout } from '../../hooks/useLicensingCheckout';
import StatusPill from '../ui/StatusPill';
import { ANNUAL_SERVICE_PLAN_ID, SERVICE_STATUS } from '../../licensing';
import {
  SERVICE_PRICE_PER_YEAR, RENEW_BUTTON_LABEL, formatServiceDate, formatDaysRemaining,
} from './licensingCopy';

export default function LicensingSummary() {
  const { entitlements, isOwner } = useAuth();
  const { startCheckout, loadingPlan } = useLicensingCheckout();

  const { license, service, cloud } = entitlements;
  if (!license.owned) return null;

  const suspended = cloud.suspendedByAdmin;
  const active = service.status === SERVICE_STATUS.ACTIVE
    || service.status === SERVICE_STATUS.GRANDFATHERED;
  const lapsed = service.status === SERVICE_STATUS.EXPIRED || suspended;

  const serviceLine = suspended
    ? 'Suspended by FlowBiz'
    : service.status === SERVICE_STATUS.ACTIVE
      ? `Active until ${formatServiceDate(service.lastCoveredDay)}`
      : service.status === SERVICE_STATUS.GRACE
        ? `Ended ${formatServiceDate(service.lastCoveredDay)}, grace period ${formatDaysRemaining(service.daysRemainingInGrace)} remaining`
        : service.status === SERVICE_STATUS.GRANDFATHERED
          ? 'Included with your licence'
          : 'Expired';

  return (
    <div className="space-y-3">
      <div className="divide-y divide-divider rounded-panel border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <span className="text-body text-ink-700">Lifetime Licence</span>
          <StatusPill tone="positive">Active, no expiry</StatusPill>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <span className="text-body text-ink-700">Cloud Services &amp; Maintenance</span>
          <span className={`text-secondary font-semibold ${lapsed ? 'text-danger-700' : active ? 'text-ink-900' : 'text-warning-700'}`}>
            {serviceLine}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
          <span className="text-body text-ink-700">Renewal</span>
          <span className="num text-secondary font-semibold tabular-nums text-ink-900">{SERVICE_PRICE_PER_YEAR}</span>
        </div>
        {service.status === SERVICE_STATUS.ACTIVE && (
          <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
            <span className="text-body text-ink-700">Days remaining</span>
            <span className="num text-secondary font-semibold tabular-nums text-ink-900">
              {formatDaysRemaining(service.daysRemaining)}
            </span>
          </div>
        )}
      </div>

      {lapsed && !suspended && (
        <p className="text-secondary leading-relaxed text-ink-600">
          Your Lifetime Licence remains active. Renew Cloud Services, Maintenance, Updates and Support
          for {SERVICE_PRICE_PER_YEAR}. Nothing you have recorded is deleted.
        </p>
      )}

      {isOwner && !suspended && (
        <button
          type="button"
          className={lapsed ? 'btn-primary w-full' : 'btn-outline w-full'}
          disabled={Boolean(loadingPlan)}
          onClick={() => startCheckout(ANNUAL_SERVICE_PLAN_ID)}
        >
          {loadingPlan === ANNUAL_SERVICE_PLAN_ID ? 'Loading…' : lapsed ? 'Renew now' : RENEW_BUTTON_LABEL}
        </button>
      )}
    </div>
  );
}
