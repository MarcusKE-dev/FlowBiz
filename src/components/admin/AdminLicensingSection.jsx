// src/components/admin/AdminLicensingSection.jsx
//
// Licence and cloud services, for one business, in the support console.
//
// THE SHAPE OF THIS PANEL IS THE ARGUMENT IT MAKES. Three separate
// statements, never one:
//
//   Lifetime Licence     what the customer owns outright
//   Annual services      what they renew, and when it runs out
//   Cloud services       what FlowBiz is actually running for them today
//
// An operator about to switch something off should be able to see, on the
// same screen and without reading any documentation, that suspending
// cloud services leaves the first block untouched. The panel says so in
// words as well, directly above the buttons.
//
// Nothing here is a security control. Each button is rendered only when
// the Worker said this administrator holds the capability, and the Worker
// re-derives that on every request — `licensing.cloud` to suspend or
// restore, `licensing.service` to move a period or migrate, and
// `licensing.revoke`, which is SUPER_ADMIN only.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CloudOff, Cloud, CalendarClock, ShieldOff, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import Section from '../ui/Section';
import StatementBlock, { StatementRow } from '../ui/StatementBlock';
import StatusPill from '../ui/StatusPill';
import Modal from '../common/Modal';
import { performLicensingAction } from '../../utils/adminService';
import { formatPrice } from '../../licensing';

function day(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function yesNo(value) {
  return value ? 'Available' : 'Suspended';
}

const SERVICE_TONES = {
  active: 'positive',
  grandfathered: 'positive',
  grace: 'caution',
  expired: 'negative',
  not_applicable: 'neutral',
};

/**
 * One licensing action, with the reason box that every one of them
 * requires. The Worker refuses an action with no reason, so this is the
 * client half of a rule the server actually enforces rather than a form
 * nicety.
 */
function ActionModal({ open, onClose, title, description, danger, businessId, action, extraFields, onDone }) {
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [graceDays, setGraceDays] = useState('');
  const [months, setMonths] = useState('12');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { action, reason };
      if (extraFields === 'service') {
        payload.serviceExpiryDate = expiry ? new Date(`${expiry}T00:00:00Z`).toISOString() : null;
        if (graceDays !== '') payload.graceDays = Number(graceDays);
      }
      if (extraFields === 'migrate') payload.months = Number(months);
      await performLicensingAction(businessId, payload);
      toast.success('Done. The action is in the audit trail.');
      onClose();
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-body leading-relaxed text-ink-600">{description}</p>

        {extraFields === 'service' && (
          <>
            <div>
              <label className="label" htmlFor="lic-expiry">New service expiry date</label>
              <input
                id="lic-expiry"
                type="date"
                className="input"
                required
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
              <p className="mt-1 text-secondary text-ink-500">
                This is the exclusive expiry instant. The last covered day is the day before it.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="lic-grace">Grace period (days, optional)</label>
              <input
                id="lic-grace"
                type="number"
                min="0"
                max="365"
                className="input"
                placeholder="Leave blank to keep the current grace period"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
              />
            </div>
          </>
        )}

        {extraFields === 'migrate' && (
          <div>
            <label className="label" htmlFor="lic-months">Service period to grant (months)</label>
            <input
              id="lic-months"
              type="number"
              min="1"
              max="36"
              className="input"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
            <p className="mt-1 text-secondary text-ink-500">
              Counted from today, not from the original purchase date. Migration can only ever add
              time to a licence sold before the annual services model existed.
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="lic-reason">Reason (required, recorded in the audit trail)</label>
          <input
            id="lic-reason"
            className="input"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Ticket #4821, chargeback under investigation"
          />
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'} disabled={busy}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminLicensingSection({ businessId, licensing, permissions = {}, onChanged }) {
  const [modal, setModal] = useState(null);

  if (!licensing) return null;

  const { license, service, cloud, maintenance } = licensing;

  // A business with no perpetual licence has nothing to show here. The
  // monthly-plan controls elsewhere on the page are what govern it.
  if (!license?.owned && license?.status !== 'revoked') {
    return (
      <Section
        title="Licence and cloud services"
        hint="This business does not own a FlowBiz Lifetime Licence. Its plan is governed by the subscription controls."
      >
        <StatementBlock>
          <StatementRow label="Licence" value="None" tone="muted" />
          <StatementRow label="Effective plan" value={(licensing.plan || 'free').toUpperCase()} />
          <StatementRow label="Cloud services" value={yesNo(cloud?.entitled)} />
        </StatementBlock>
      </Section>
    );
  }

  const revoked = license.status === 'revoked';

  return (
    <>
      <Section
        title="Licence and cloud services"
        hint="The perpetual licence and the renewable annual services are two separate records. Suspending cloud services does not touch the licence."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Owned outright ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-section-title">Lifetime Licence</h3>
              <StatusPill tone={revoked ? 'negative' : 'positive'}>
                {revoked ? 'Revoked' : 'Active'}
              </StatusPill>
            </div>
            <StatementBlock>
              <StatementRow label="Type" value={license.type ? license.type.toUpperCase() : '—'} />
              <StatementRow label="Status" value={license.status} tone={revoked ? 'negative' : 'default'} />
              <StatementRow label="Expires" value="Never" hint="perpetual" />
              <StatementRow label="Purchased" value={day(license.purchasedAt)} />
              <StatementRow label="Purchase price" value={formatPrice(license.purchaseAmountKes)} tone="muted" />
              {license.purchaseReference && (
                <StatementRow label="Reference" value={license.purchaseReference} tone="muted" />
              )}
              {revoked && (
                <>
                  <StatementRow label="Revoked" value={day(license.revokedAt)} tone="negative" />
                  <StatementRow label="Revocation reason" value={license.revokedReason || '—'} tone="muted" />
                </>
              )}
            </StatementBlock>
          </div>

          {/* ── Renewed annually ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-section-title">Annual services</h3>
              <StatusPill tone={SERVICE_TONES[service.status] || 'neutral'}>
                {service.status.replace(/_/g, ' ')}
              </StatusPill>
            </div>
            <StatementBlock>
              <StatementRow label="Service start" value={day(service.startDate)} />
              <StatementRow label="Service expiry" value={day(service.expiryDate)} />
              <StatementRow label="Last covered day" value={day(service.lastCoveredDay)} tone="muted" />
              <StatementRow
                label="Days remaining"
                value={Number.isFinite(service.daysRemaining) ? String(service.daysRemaining) : '—'}
                tone={Number.isFinite(service.daysRemaining) && service.daysRemaining <= 30 ? 'negative' : 'default'}
              />
              <StatementRow label="Grace period" value={`${service.graceDays} days`} />
              <StatementRow
                label="In grace period"
                value={service.inGracePeriod ? `Yes, ${service.daysRemainingInGrace} days left` : 'No'}
                tone={service.inGracePeriod ? 'negative' : 'default'}
              />
              <StatementRow label="Next renewal" value={formatPrice(service.renewalPriceKes)} />
              <StatementRow label="Renewals so far" value={String(service.renewalCount ?? 0)} tone="muted" />
              <StatementRow label="Last payment" value={day(service.lastPaymentAt)} tone="muted" />
              {service.lastPaymentReference && (
                <StatementRow label="Payment reference" value={service.lastPaymentReference} tone="muted" />
              )}
            </StatementBlock>
          </div>

          {/* ── Running right now ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-section-title">Cloud services</h3>
              <StatusPill tone={cloud.entitled ? 'positive' : 'negative'}>
                {cloud.status.replace(/_/g, ' ')}
              </StatusPill>
            </div>
            <StatementBlock>
              <StatementRow label="Cloud access" value={yesNo(cloud.entitled)} tone={cloud.entitled ? 'default' : 'negative'} />
              <StatementRow label="Synchronisation" value={yesNo(cloud.synchronisation)} />
              <StatementRow label="Storage" value={yesNo(cloud.storage)} />
              <StatementRow label="Backups" value={yesNo(cloud.backups)} />
              <StatementRow label="Document publishing" value={yesNo(cloud.documents)} />
              <StatementRow label="Maintenance" value={yesNo(maintenance.maintenance)} />
              <StatementRow label="Updates" value={yesNo(maintenance.updates)} />
              <StatementRow label="Support" value={yesNo(maintenance.support)} />
              <StatementRow
                label="Local application"
                value={licensing.localApplicationAvailable ? 'Available' : 'Unavailable'}
                tone="muted"
                hint="never withdrawn"
              />
              <StatementRow label="Licensed features" value={yesNo(licensing.proFeatures)} tone="muted" />
            </StatementBlock>

            {cloud.suspendedByAdmin && (
              <div className="rounded-panel border border-danger-200 bg-danger-50 p-3">
                <p className="text-secondary font-semibold text-danger-700">Suspended by an administrator</p>
                <p className="mt-1 text-secondary text-ink-700">
                  {cloud.suspendedBy || 'unknown'} on {day(cloud.suspendedAt)}
                </p>
                {cloud.suspendedReason && (
                  <p className="mt-1 text-secondary text-ink-600">Reason: {cloud.suspendedReason}</p>
                )}
              </div>
            )}
            {!cloud.suspendedByAdmin && cloud.restoredAt && (
              <p className="text-secondary text-ink-500">
                Last restored by {cloud.restoredBy || 'unknown'} on {day(cloud.restoredAt)}.
              </p>
            )}
          </div>
        </div>
      </Section>

      {(permissions.canSuspendCloud || permissions.canOverrideService || permissions.canRevokeLicense) && (
        <Section
          title="Licensing actions"
          hint="Suspending cloud services never revokes the licence and never deletes data. Revoking a licence is a separate, deliberate action. Every one of these is recorded in the audit trail with your name and your stated reason."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {permissions.canSuspendCloud && (
              cloud.suspendedByAdmin ? (
                <button type="button" className="btn-outline flex items-center justify-center gap-2 text-button" onClick={() => setModal('restore-cloud')}>
                  <Cloud className="h-4 w-4" strokeWidth={1.75} /> Restore cloud services
                </button>
              ) : (
                <button type="button" className="btn-outline flex items-center justify-center gap-2 border-danger-200 text-button text-danger-700" onClick={() => setModal('suspend-cloud')}>
                  <CloudOff className="h-4 w-4" strokeWidth={1.75} /> Suspend cloud services
                </button>
              )
            )}
            {permissions.canOverrideService && (
              <button type="button" className="btn-outline flex items-center justify-center gap-2 text-button" onClick={() => setModal('set-service')}>
                <CalendarClock className="h-4 w-4" strokeWidth={1.75} /> Adjust service period
              </button>
            )}
            {permissions.canOverrideService && service.needsMigration && (
              <button type="button" className="btn-outline flex items-center justify-center gap-2 text-button" onClick={() => setModal('migrate')}>
                <ArrowRightLeft className="h-4 w-4" strokeWidth={1.75} /> Migrate to annual services
              </button>
            )}
            {permissions.canRevokeLicense && (
              revoked ? (
                <button type="button" className="btn-outline flex items-center justify-center gap-2 text-button" onClick={() => setModal('reinstate-license')}>
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.75} /> Reinstate licence
                </button>
              ) : (
                <button type="button" className="btn-outline flex items-center justify-center gap-2 border-danger-200 text-button text-danger-700" onClick={() => setModal('revoke-license')}>
                  <ShieldOff className="h-4 w-4" strokeWidth={1.75} /> Revoke licence
                </button>
              )
            )}
          </div>
        </Section>
      )}

      <ActionModal
        open={modal === 'suspend-cloud'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="suspend-cloud"
        danger
        title="Suspend cloud services"
        description="Cloud synchronisation, cloud storage, backups, document publishing, maintenance, updates and support stop for this business. Its Lifetime Licence stays active, FlowBiz keeps running on its devices, and no data is deleted. This is fully reversible."
      />
      <ActionModal
        open={modal === 'restore-cloud'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="restore-cloud"
        title="Restore cloud services"
        description="Cloud services are switched back on immediately. If the annual services period has also lapsed, the customer still needs to renew before hosted services resume."
      />
      <ActionModal
        open={modal === 'set-service'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="set-service"
        extraFields="service"
        title="Adjust the annual services period"
        description="Moves the service expiry date, and optionally the grace window. Use this for goodwill extensions and for corrections after a payment problem. It cannot reach the licence."
      />
      <ActionModal
        open={modal === 'migrate'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="migrate"
        extraFields="migrate"
        title="Migrate this licence onto the annual services model"
        description="This licence was sold before annual cloud services existed, so it currently has no service period at all and is fully entitled. Migrating grants a fresh service period from today. It can only add time; it can never leave a customer worse off than they are now."
      />
      <ActionModal
        open={modal === 'revoke-license'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="revoke-license"
        danger
        title="Revoke this perpetual licence"
        description="This takes away software the customer bought outright, and is not how an unpaid service fee is handled. Use it only where there is a documented legal or contractual basis. It does not delete any business data."
      />
      <ActionModal
        open={modal === 'reinstate-license'}
        onClose={() => setModal(null)}
        onDone={onChanged}
        businessId={businessId}
        action="reinstate-license"
        title="Reinstate this licence"
        description="Returns the perpetual licence to active. The annual services period is unchanged."
      />
    </>
  );
}
