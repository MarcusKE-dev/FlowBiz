// src/pages/admin/AdminSecurity.jsx
//
// The security page. It exists to answer five questions quickly and to
// claim nothing beyond what it can prove:
//
//     Is somebody repeatedly trying to get into an account?
//     Which account are they targeting?
//     When did it happen?
//     Did they get in?
//     What can I do about it right now?
//
// SO THE FIRST THING ON IT IS WHAT NEEDS LOOKING AT, not a chart. The
// clusters — one account under repeated failure, one address working
// through several accounts — come first with the action beside them, and
// the full log is underneath for the answer to "what actually happened".
//
// PROVENANCE IS SHOWN, NOT ASSUMED. A successful sign-in is proved by a
// verified Firebase ID token. A FAILED one produces no token, so the
// browser is the only witness and the row says so. Building a page that
// presented both as equally certain would be the easy thing to do and the
// wrong one — see cloudflare-worker/src/lib/loginEvents.js.
//
// Every button here calls the Worker, which re-derives the caller's
// authority from the systemAdmins register on every request. `canAct` only
// decides what is rendered.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, RefreshCw, Ban, LogOut, Check, CircleCheck, CircleX } from 'lucide-react';
import { fetchSecurityOverview, fetchSecurityEvents, performSecurityAction } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import AdminApiError from '../../components/admin/AdminApiError';
import { formatDateTime } from '../../utils/dateRanges';

const REASON_LABELS = {
  wrong_password: 'Wrong password',
  no_such_account: 'No such account',
  malformed_email: 'Malformed email',
  account_disabled: 'Account disabled',
  rate_limited: 'Rate limited by Firebase',
  network: 'Network failure',
  unknown: 'Unknown',
};

function Stat({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <p className="text-label uppercase text-ink-400">{label}</p>
      <p className={`font-display text-page-title font-bold ${tone === 'alert' ? 'text-danger-700' : 'text-ink-900'}`}>
        {value}
      </p>
    </div>
  );
}

export default function AdminSecurity() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [outcome, setOutcome] = useState('all');
  const [search, setSearch] = useState('');

  // Nothing here sets state synchronously — every setState happens in a
  // promise callback — so mounting this page is one render, not a
  // cascade. The refresh button is what turns the spinner back on.
  const load = useCallback(
    () => fetchSecurityOverview()
      .then((res) => { setData(res); setEvents(res.events || []); setError(null); })
      .catch((err) => setError(err))
      .finally(() => setLoading(false)),
    []
  );

  useEffect(() => { load(); }, [load]);

  const filter = (nextOutcome = outcome, nextSearch = search) => {
    setOutcome(nextOutcome);
    fetchSecurityEvents({ outcome: nextOutcome, search: nextSearch })
      .then((res) => setEvents(res.events || []))
      .catch((err) => setError(err));
  };

  const act = async (key, payload) => {
    setBusyKey(key);
    try {
      await performSecurityAction(payload);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !data) return <LoadingSpinner label="Loading security activity…" />;
  if (error && !data) return <AdminApiError error={error} onRetry={load} />;

  const canAct = data?.permissions?.canAct === true;
  const summary = data?.summary || {};
  const clusters = data?.clusters || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-page-title font-bold text-ink-900">Security</h1>
          <p className="text-secondary text-ink-500 sm:text-body">
            Who has been signing in, who has been failing to, and from where.
          </p>
        </div>
        <button type="button" onClick={() => { setLoading(true); load(); }} className="btn-outline !px-3 flex items-center gap-1.5 self-start text-secondary font-semibold sm:self-auto">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <ErrorBanner message={error?.message} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sign-ins today" value={summary.signInsToday ?? 0} />
        <Stat label="Failures today" value={summary.failuresToday ?? 0} tone={summary.failuresToday > 0 ? 'alert' : 'default'} />
        <Stat label="Failures this week" value={summary.failuresThisWeek ?? 0} />
        <Stat label="Needing review" value={summary.unresolvedFailures ?? 0} tone={summary.unresolvedFailures > 0 ? 'alert' : 'default'} />
      </div>

      {/* ── What needs looking at ─────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="section-title">Suspicious activity</h2>
          <p className="section-hint">
            Five or more failed attempts in 24 hours against one account or address, and any
            address that succeeded after a run of failures.
          </p>
        </div>

        {clusters.length === 0 ? (
          <div className="flex items-center gap-3 rounded-panel border border-line bg-surface p-4">
            <CircleCheck className="h-5 w-5 text-success-600" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-body text-ink-600">Nothing repeated in the last 24 hours.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clusters.map((cluster) => (
              <div
                key={`${cluster.kind}:${cluster.key}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-panel border border-line bg-surface p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert
                      className={`h-4 w-4 ${cluster.breachedAfterFailures ? 'text-danger-600' : 'text-warning-600'}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <p className="text-body font-semibold text-ink-900">{cluster.label}</p>
                    <span className="text-label uppercase text-ink-400">
                      {cluster.kind === 'account' ? 'Account targeted' : 'Address'}
                    </span>
                  </div>
                  <p className="text-secondary text-ink-500">
                    <span className="num">{cluster.failures}</span> failed attempts
                    {cluster.kind === 'account'
                      ? ` from ${cluster.distinctAddresses} address${cluster.distinctAddresses === 1 ? '' : 'es'}`
                      : ` against ${cluster.distinctAccounts} account${cluster.distinctAccounts === 1 ? '' : 's'}`}
                    {' · last '}{formatDateTime(cluster.lastAt)}
                    {cluster.reasons?.length ? ` · ${cluster.reasons.map((r) => REASON_LABELS[r] || r).join(', ')}` : ''}
                  </p>
                  {cluster.breachedAfterFailures && (
                    <p className="text-secondary font-semibold text-danger-700">
                      A sign-in SUCCEEDED from this address after those failures.
                    </p>
                  )}
                  {cluster.kind === 'account' && !cluster.knownAccount && (
                    <p className="text-secondary text-ink-400">
                      No FlowBiz account matches this address.
                    </p>
                  )}
                </div>

                {cluster.kind === 'account' && cluster.knownAccount && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {cluster.targetBusinessId && (
                      <Link to={`/admin/businesses/${cluster.targetBusinessId}`} className="btn-outline !px-3 text-secondary font-semibold">
                        Open workspace
                      </Link>
                    )}
                    {canAct && cluster.targetUid && (
                      <>
                        <button
                          type="button"
                          className="btn-outline !px-3 text-secondary font-semibold"
                          disabled={busyKey === `revoke:${cluster.targetUid}`}
                          onClick={() => act(`revoke:${cluster.targetUid}`, {
                            action: 'revokeSessions', uid: cluster.targetUid,
                            reason: 'Repeated failed sign-in attempts',
                          })}
                        >
                          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Sign out everywhere
                        </button>
                        <button
                          type="button"
                          className="btn-outline !px-3 text-secondary font-semibold text-danger-700"
                          disabled={busyKey === `disable:${cluster.targetUid}`}
                          onClick={() => act(`disable:${cluster.targetUid}`, {
                            action: 'disableUser', uid: cluster.targetUid,
                            reason: 'Repeated failed sign-in attempts',
                          })}
                        >
                          <Ban className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Disable sign-in
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── The log ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="section-title">Login activity</h2>
            <p className="section-hint">
              {data?.provenance?.note}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={outcome}
              onChange={(e) => filter(e.target.value)}
              className="input !w-auto text-secondary font-semibold"
              aria-label="Filter by outcome"
            >
              <option value="all">All attempts</option>
              <option value="failure">Failures only</option>
              <option value="success">Successes only</option>
            </select>
            <form
              onSubmit={(e) => { e.preventDefault(); filter(outcome, search); }}
              className="flex items-center gap-2"
            >
              <input
                className="input !w-48"
                placeholder="Email or IP address"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search login activity"
              />
              <button type="submit" className="btn-outline !px-3 text-secondary font-semibold">Search</button>
            </form>
          </div>
        </div>

        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-left">
            <caption className="sr-only">Recent sign-in attempts</caption>
            <thead>
              <tr className="border-b border-divider text-label uppercase text-ink-400">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">Workspace</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-body text-ink-500">
                    No sign-in activity recorded yet.
                  </td>
                </tr>
              )}
              {events.map((event) => (
                <tr key={event.id} className="border-b border-divider last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-secondary text-ink-600">
                    {formatDateTime(event.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-body text-ink-900">{event.targetEmail || event.emailMasked || 'Unknown'}</p>
                    {event.targetName && <p className="text-secondary text-ink-500">{event.targetName}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-secondary font-semibold ${event.outcome === 'success' ? 'text-success-700' : 'text-danger-700'}`}>
                      {event.outcome === 'success'
                        ? <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        : <CircleX className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
                      {event.outcome === 'success' ? 'Signed in' : (REASON_LABELS[event.reason] || 'Failed')}
                    </span>
                    <span className="text-label uppercase text-ink-400">
                      {event.verified ? 'Verified' : 'Reported'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary text-ink-600">
                    <p className="font-mono">{event.ip || '-'}</p>
                    <p className="max-w-[16rem] truncate text-ink-400">{event.userAgent || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary text-ink-600">
                    {event.targetBusinessId ? (
                      <Link to={`/admin/businesses/${event.targetBusinessId}`} className="text-deep-600 hover:underline">
                        Open
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.outcome === 'failure' && canAct && (
                      event.resolved ? (
                        <span className="text-secondary text-ink-400">Reviewed</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost !px-2 text-ink-500"
                          disabled={busyKey === `resolve:${event.id}`}
                          onClick={() => act(`resolve:${event.id}`, { action: 'resolveEvent', eventId: event.id, resolved: true })}
                        >
                          <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          Mark reviewed
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-secondary text-ink-400">
        Suspending or reactivating a whole workspace stays on the workspace itself, under
        Directory, so there is one audited place it can happen.
      </p>
    </div>
  );
}
