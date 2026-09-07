// src/pages/admin/AdminAuditLogs.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminAuditLogs } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import { ScrollText, RefreshCw } from 'lucide-react';
import { formatDateTime } from '../../utils/dateRanges';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [bizFilter, setBizFilter] = useState('');

  // Cursor paging, not offset paging: Firestore charges for the documents
  // an offset skips, so "page 20" of the audit trail used to cost 2,000
  // reads to show 100 rows.
  const loadLogs = (nextCursor = null) => {
    if (nextCursor) setLoadingMore(true);
    else { setLoading(true); setError(null); }

    fetchAdminAuditLogs({ action: actionFilter, businessId: bizFilter, limit: 100, cursor: nextCursor })
      .then((res) => {
        setLogs((prev) => (nextCursor ? [...prev, ...res.logs] : res.logs));
        setCursor(res.nextCursor || null);
        setHasMore(Boolean(res.hasMore && res.nextCursor));
      })
      .catch((err) => setError(err.message))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-page-title font-bold text-ink-900">Platform audit trail</h1>
          <p className="text-secondary sm:text-body text-ink-500 mt-0.5">
            Every privileged administrative action, and every business inspection. Repeated
            inspections of the same resource inside ten minutes are recorded once: this is a
            security record, not a click log.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
 className="btn-outline !px-3 text-secondary font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-panel border border-line bg-surface p-4 bg-white flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input !w-auto text-secondary font-semibold"
        >
          <option value="">All actions</option>
          <option value="ADMIN_LOGIN">Admin sign-ins</option>
          <option value="VIEW_BUSINESS">Business Profile Views</option>
          <option value="VIEW_BUSINESS_DATA">Sub-Collection Inspections</option>
          <option value="INSPECT_BUSINESS_SECTION">Inspector sections opened</option>
          <option value="VIEW_BUSINESS_USAGE">Usage inspections</option>
          <option value="TOGGLE_BUSINESS_STATUS">Suspensions / reactivations</option>
          <option value="DELETE_BUSINESS_COMPLETELY">Business deletions</option>
          <option value="ADMIN_TRIGGERED_PASSWORD_RESET">Owner password resets</option>
          <option value="DEACTIVATE_SYSTEM_ADMIN">Admin deactivations</option>
          <option value="ENTER_SUPPORT_MODE">Support sessions</option>
          <option value="UPDATE_SUBSCRIPTION">Subscription changes</option>
          <option value="ADD_SYSTEM_ADMIN">Admin additions</option>
          <option value="SEND_COMMUNICATION">Messages sent</option>
        </select>

        <input
          type="text"
          placeholder="Filter by Business ID…"
          value={bizFilter}
          onChange={(e) => setBizFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadLogs(); }}
          className="input !w-48 text-secondary"
        />

 <button type="button" onClick={loadLogs} className="btn-primary !px-3 text-secondary font-bold">
          Filter
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner label="Fetching audit records…" />
      ) : logs.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-12 text-center bg-white space-y-2">
          <ScrollText className="h-8 w-8 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-800">No audit logs match</h3>
          <p className="text-secondary text-ink-400">All administrative operations will automatically appear here.</p>
        </div>
      ) : (
        <div className="rounded-panel border border-line bg-surface overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-secondary text-left">
              <thead className="bg-ink-50 uppercase text-label font-bold text-ink-400 border-b border-divider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Metadata / Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-ink-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-label font-bold leading-4 text-deep-600">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-ink-900 block">{log.adminName || 'Admin'}</span>
                      <span className="text-label text-ink-500">{log.adminEmail}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.targetBusinessId ? (
                        <Link to={`/admin/businesses/${log.targetBusinessId}`} className="font-mono text-primary-700 font-bold hover:underline">
                          {log.targetBusinessId}
                        </Link>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600 font-mono text-label">
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-400 font-mono text-label">
                      {log.ip || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="border-t border-divider p-3 text-center">
              <button
                type="button"
                onClick={() => loadLogs(cursor)}
                disabled={loadingMore}
                className="btn-outline !px-3 text-button"
              >
                {loadingMore ? 'Loading…' : 'Load older entries'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}