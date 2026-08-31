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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [bizFilter, setBizFilter] = useState('');

  const loadLogs = () => {
    setLoading(true);
    setError(null);
    fetchAdminAuditLogs({ action: actionFilter, businessId: bizFilter, limit: 100 })
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Platform Audit Trail</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">Immutable record of every privileged administrative action.</p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="btn-outline !min-h-0 !py-1.5 !px-3 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Logs
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 bg-white flex flex-wrap items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input !w-auto text-xs font-semibold"
        >
          <option value="">All Actions</option>
          <option value="ADMIN_LOGIN">Admin Logins</option>
          <option value="VIEW_BUSINESS">Business Profile Views</option>
          <option value="VIEW_BUSINESS_DATA">Sub-Collection Inspections</option>
          <option value="ENTER_SUPPORT_MODE">Support Mode Sessions</option>
          <option value="UPDATE_SUBSCRIPTION">Subscription Modifications</option>
          <option value="ADD_SYSTEM_ADMIN">Admin Additions</option>
          <option value="SEND_COMMUNICATION">Communications Sent</option>
        </select>

        <input
          type="text"
          placeholder="Filter by Business ID…"
          value={bizFilter}
          onChange={(e) => setBizFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') loadLogs(); }}
          className="input !w-48 text-xs"
        />

        <button type="button" onClick={loadLogs} className="btn-primary !min-h-0 !py-2 !px-3 text-xs font-bold">
          Filter
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingSpinner label="Fetching audit records…" />
      ) : logs.length === 0 ? (
        <div className="card p-12 text-center bg-white space-y-2">
          <ScrollText className="h-8 w-8 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-800">No audit logs match</h3>
          <p className="text-xs text-ink-400">All administrative operations will automatically appear here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ink-50 uppercase text-[10px] font-bold text-ink-400 border-b border-ink-100">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Target Business</th>
                  <th className="px-4 py-3">Metadata / Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-ink-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="badge bg-ink-900 text-white font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-ink-900 block">{log.adminName || 'Admin'}</span>
                      <span className="text-[11px] text-ink-500">{log.adminEmail}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.targetBusinessId ? (
                        <Link to={`/admin/businesses/${log.targetBusinessId}`} className="font-mono text-moss-700 font-bold hover:underline">
                          {log.targetBusinessId}
                        </Link>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600 font-mono text-[11px]">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-ink-400 font-mono text-[11px]">
                      {log.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}