import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminOverview } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import {
  Building2,
  Sparkles,
  Store,
  Users,
  ArrowRight,
  TrendingUp,
  ScrollText,
  Search,
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateRanges';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');

  useEffect(() => {
    fetchAdminOverview()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Loading platform overview…" />;
  if (error) return <ErrorBanner message={error} />;

  const proPct = data.totalBusinesses > 0 ? ((data.proBusinesses / data.totalBusinesses) * 100).toFixed(0) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Quick Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Platform Overview</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">Real-time status of all stores registered on FlowBiz.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (quickSearch.trim()) {
              window.location.href = `/admin/businesses?search=${encodeURIComponent(quickSearch.trim())}`;
            }
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Quick search business ID or name…"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="input !py-1.5 !pl-8 text-xs w-64 bg-white"
            />
          </div>
          <button type="submit" className="btn-primary !min-h-0 !py-1.5 !px-3 text-xs">
            Search
          </button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-ink-400">Total Registered</span>
            <Building2 className="h-4 w-4 text-ink-400" />
          </div>
          <p className="font-display text-2xl font-extrabold text-ink-900">{data.totalBusinesses}</p>
          <span className="text-[11px] text-moss-700 font-semibold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +{data.newBusinessesThisMonth} new in 30 days
          </span>
        </div>

        <div className="card p-5 bg-white space-y-1 border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-amber-700">Pro Subscriptions</span>
            <Sparkles className="h-4 w-4 text-amber-600" />
          </div>
          <p className="font-display text-2xl font-extrabold text-amber-800">{data.proBusinesses}</p>
          <span className="text-[11px] text-ink-400">
            {proPct}% of total platform accounts
          </span>
        </div>

        <div className="card p-5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-ink-400">Free Tier Stores</span>
            <Store className="h-4 w-4 text-ink-400" />
          </div>
          <p className="font-display text-2xl font-extrabold text-ink-800">{data.freeBusinesses}</p>
          <span className="text-[11px] text-ink-400">Standard Starter capacity</span>
        </div>

        <div className="card p-5 bg-white space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-ink-400">Active Workspaces</span>
            <Users className="h-4 w-4 text-moss-600" />
          </div>
          <p className="font-display text-2xl font-extrabold text-moss-700">{data.activeBusinesses}</p>
          <span className="text-[11px] text-ink-400">Unrestricted operational accounts</span>
        </div>
      </div>

      {/* Grid: Recent Registrations & Live Audit Trail */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Registrations */}
        <div className="card p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <h2 className="font-display text-sm font-bold text-ink-900">Recent Registrations</h2>
            <Link to="/admin/businesses" className="text-xs font-semibold text-moss-700 hover:underline flex items-center gap-1">
              View All ({data.totalBusinesses}) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-ink-100">
            {data.recentBusinesses.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <Link to={`/admin/businesses/${b.id}`} className="font-semibold text-ink-900 hover:text-moss-700 block">
                    {b.name}
                  </Link>
                  <span className="text-[11px] text-ink-400 font-mono">{b.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${b.plan === 'pro' ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-ink-100 text-ink-600'}`}>
                    {b.plan.toUpperCase()}
                  </span>
                  <Link to={`/admin/businesses/${b.id}`} className="btn-outline !min-h-0 !py-1 !px-2 text-[11px]">
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Admin Audit Log Feed */}
        <div className="card p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-ink-500" />
              <h2 className="font-display text-sm font-bold text-ink-900">Live Audit Trail</h2>
            </div>
            <Link to="/admin/audit-logs" className="text-xs font-semibold text-moss-700 hover:underline flex items-center gap-1">
              All Logs <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-ink-100 max-h-72 overflow-y-auto">
            {data.recentAuditLogs.length === 0 ? (
              <p className="text-xs text-ink-400 py-6 text-center">No audit logs recorded yet.</p>
            ) : (
              data.recentAuditLogs.map((log) => (
                <div key={log.id} className="py-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink-800">{log.action}</span>
                    <span className="text-[10px] text-ink-400">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <p className="text-[11px] text-ink-500">
                    By <strong className="text-ink-700">{log.adminName || log.adminEmail}</strong>
                    {log.targetBusinessId && <span> &middot; Business: <code className="font-mono text-ink-700">{log.targetBusinessId}</code></span>}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}