// src/components/licensing/ServiceRenewalNotice.jsx
//
// The renewal notice that rides above every page.
//
// THREE RULES IT KEEPS.
//
//   IT IS NEVER A BLOCKING MODAL. A shop in the middle of a sale must not
//   have to dismiss a billing dialog to ring one up. This is a banner in
//   the normal document flow; it scrolls away with the page.
//
//   IT SAYS THE LICENCE IS SAFE, FIRST. Every variant leads with the
//   Lifetime Licence being permanent, because a renewal notice that reads
//   like a shutdown warning is a misleading one.
//
//   IT CAN BE PUT AWAY. Dismissal is remembered per stage, per device, so
//   dismissing the 30-day notice is not dismissing the 3-day one — the
//   customer stops being nagged about a thing they have already read, and
//   still hears about it again when it actually gets close.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ShieldCheck, TriangleAlert, CloudOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLicensingCheckout } from '../../hooks/useLicensingCheckout';
import { isDemoMode } from '../../demo/demoMode';
import { ANNUAL_SERVICE_PLAN_ID } from '../../licensing';
import {
  RENEW_BUTTON_LABEL, renewalBody, renewalHeadline, formatServiceDate,
} from './licensingCopy';

const DISMISS_KEY = 'flowbiz_service_notice_dismissed';

function dismissedStage() {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}
function rememberDismissal(key) {
  try { localStorage.setItem(DISMISS_KEY, key); } catch { /* private mode */ }
}

const TONES = {
  info: {
    wrap: 'border-line bg-surface',
    icon: 'text-deep-600',
    Icon: ShieldCheck,
  },
  warning: {
    wrap: 'border-warning-200 bg-warning-50',
    icon: 'text-warning-700',
    Icon: TriangleAlert,
  },
  urgent: {
    wrap: 'border-warning-200 bg-warning-50',
    icon: 'text-warning-700',
    Icon: TriangleAlert,
  },
  expired: {
    wrap: 'border-danger-200 bg-danger-50',
    icon: 'text-danger-700',
    Icon: CloudOff,
  },
};

export default function ServiceRenewalNotice() {
  const { entitlements, isOwner } = useAuth();
  const { startCheckout, busy } = useLicensingCheckout();
  // The stage the customer last put away, read once. Because the stored
  // value is the stage KEY, a new stage — or a new service period — is
  // simply a different key and the notice comes back on its own. There is
  // no effect resetting anything.
  const [dismissed, setDismissed] = useState(dismissedStage);
  const demo = isDemoMode();

  const service = entitlements?.service;
  const cloud = entitlements?.cloud;
  const stage = entitlements?.renewal?.stage ?? null;
  const suspendedByAdmin = Boolean(cloud?.suspendedByAdmin);

  // A dismissal is scoped to the stage AND the service period, so the
  // next period's 30-day notice is a new notice.
  const noticeKey = suspendedByAdmin
    ? 'admin-suspended'
    : `${service?.expiryDate ? new Date(service.expiryDate).toISOString().slice(0, 10) : 'none'}:${stage}`;

  // Nothing to say: no licence, nothing due, or the demo build (which has
  // no real billing at all).
  if (demo) return null;
  if (!entitlements?.license?.owned) return null;
  if (!suspendedByAdmin && !stage) return null;
  if (dismissed === noticeKey) return null;

  const level = suspendedByAdmin ? 'expired' : entitlements.renewal.level;
  const tone = TONES[level] || TONES.info;
  const { Icon } = tone;

  const headline = suspendedByAdmin
    ? 'Cloud services are suspended for this business'
    : renewalHeadline(entitlements);

  return (
    <div
      role="status"
      className={`mb-5 flex flex-col gap-3 rounded-panel border p-4 sm:flex-row sm:items-start ${tone.wrap}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${tone.icon}`} strokeWidth={1.75} aria-hidden="true" />

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-body font-semibold text-ink-900">{headline}</p>
        <p className="text-secondary leading-relaxed text-ink-600">{renewalBody(entitlements)}</p>
        {service?.lastCoveredDay && !suspendedByAdmin && (
          <p className="text-label text-ink-500">
            Annual services {service.status === 'active' ? 'active until' : 'ended'}{' '}
            {formatServiceDate(service.lastCoveredDay)}. Lifetime Licence: no expiry.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Only an owner can pay. A cashier sees the notice and is told
            what it means, rather than being handed a button that the
            Worker would refuse. */}
        {isOwner && !suspendedByAdmin && (
          <button
            type="button"
            className="btn-primary whitespace-nowrap"
            disabled={busy}
            onClick={() => startCheckout(ANNUAL_SERVICE_PLAN_ID)}
          >
            {busy ? 'Loading…' : RENEW_BUTTON_LABEL}
          </button>
        )}
        {isOwner && (
          <Link to="/pro" className="btn-secondary whitespace-nowrap">Details</Link>
        )}
        <button
          type="button"
          aria-label="Dismiss this notice"
          className="rounded-panel p-1.5 text-ink-400 transition-colors hover:text-ink-700"
          onClick={() => { rememberDismissal(noticeKey); setDismissed(noticeKey); }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
