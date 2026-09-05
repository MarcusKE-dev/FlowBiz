// src/pages/admin/AdminBusinesses.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdminBusinesses } from '../../utils/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBanner from '../../components/common/ErrorBanner';
import {
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
} from 'lucide-react';
import { formatDate } from '../../utils/dateRanges';
import StatusPill from '../../components/ui/StatusPill';

// Plan reads as a coloured word, not a filled chip. The directory is a
// list of rows, and a lozenge on every one of them buried the names.
const PLAN_BADGE_CLASS = {
  lifetime: 'text-deep-600 font-bold',
  pro: 'text-warning-700 font-bold',
  free: 'text-ink-500',
};

export default function AdminBusinesses() {
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [plan, setPlan] = useState(searchParams.get('plan') || 'all');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchAdminBusinesses({ search, plan, status, page, pageSize: 25 })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [plan, status, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-page-title font-bold text-ink-900">Businesses</h1>
          <p className="text-secondary sm:text-body text-ink-500 mt-0.5">Search, inspect, and manage merchant accounts across FlowBiz.</p>
        </div>
        <span className="text-secondary font-bold text-ink-500 bg-white border border-line px-3 py-1.5 rounded-panel self-start sm:self-auto">
          {data?.total ?? '…'} Registered Businesses
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-panel border border-line bg-surface p-4 bg-white space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by business name, ID, owner email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input !pl-9 text-secondary sm:text-body"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={plan}
              onChange={(e) => { setPlan(e.target.value); setPage(1); }}
              className="input !w-auto text-secondary font-semibold"
            >
              <option value="all">All plans</option>
              <option value="lifetime">Lifetime</option>
              <option value="pro">Pro Plan</option>
              <option value="free">Free</option>
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="input !w-auto text-secondary font-semibold"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
            <button type="submit" className="btn-primary !py-2 text-secondary font-bold">
              Filter
            </button>
          </div>
        </form>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Directory Content */}
      {loading ? (
        <LoadingSpinner label="Querying business directory…" />
      ) : data?.businesses?.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-12 text-center bg-white space-y-2">
          <Building2 className="h-8 w-8 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-800">No businesses match</h3>
          <p className="text-secondary text-ink-400">Try adjusting your keyword, plan filter, or status criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Card View (< sm screens) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {data.businesses.map((b) => (
              <div key={b.id} className="rounded-panel border border-line bg-surface p-4 bg-white space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/admin/businesses/${b.id}`} className="font-bold text-ink-900 text-body hover:text-primary-700 block">
                      {b.name}
                    </Link>
                    <span className="font-mono text-label text-ink-400">{b.id}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-label leading-4 ${PLAN_BADGE_CLASS[b.plan] || PLAN_BADGE_CLASS.free}`}>
                      {b.plan.toUpperCase()}
                    </span>
                    <StatusPill tone={b.status === 'active' ? 'positive' : 'negative'}>
                      {b.status}
                    </StatusPill>
                  </div>
                </div>

                <div className="text-secondary text-ink-600 space-y-0.5 border-t border-divider pt-2">
                  <p><strong className="text-ink-800">{b.owner?.name || 'Owner'}</strong> &middot; {b.owner?.email || b.settings?.email || 'No email'}</p>
                  <p className="text-label text-ink-400">Registered on {formatDate(b.createdAt)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/admin/businesses/${b.id}`}
 className="btn-outline text-secondary font-semibold flex items-center justify-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> Inspect
                  </Link>
                  <Link
                    to={`/admin/businesses/${b.id}/support`}
 className="btn-outline text-secondary font-semibold flex items-center justify-center gap-1 text-warning-700 hover:bg-warning-50"
                  >
                    <Shield className="h-3.5 w-3.5" /> Support
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= sm screens) */}
          <div className="hidden overflow-hidden rounded-panel border border-line bg-surface sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-secondary text-left">
                <thead className="bg-ink-50 uppercase text-label font-bold text-ink-400 border-b border-divider">
                  <tr>
                    <th className="px-4 py-3">Business Name &amp; ID</th>
                    <th className="px-4 py-3">Owner contact</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider font-medium">
                  {data.businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-ink-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/businesses/${b.id}`} className="font-bold text-ink-900 hover:text-primary-700 block text-body">
                          {b.name}
                        </Link>
                        <span className="font-mono text-label text-ink-400">{b.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink-800 block">{b.owner?.name || 'Owner'}</span>
                        <span className="text-label text-ink-500">{b.owner?.email || b.settings?.email || 'No email on file'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-label leading-4 ${PLAN_BADGE_CLASS[b.plan] || PLAN_BADGE_CLASS.free}`}>
                          {b.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={b.status === 'active' ? 'positive' : 'negative'}>
                          {b.status}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {formatDate(b.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/businesses/${b.id}`}
 className="btn-outline !px-2 text-label font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Inspect
                          </Link>
                          <Link
                            to={`/admin/businesses/${b.id}/support`}
 className="btn-outline !px-2 text-label font-semibold inline-flex items-center gap-1 text-warning-700 hover:bg-warning-50"
                            title="View as Business (Read-Only)"
                          >
                            <Shield className="h-3 w-3" /> Support
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-divider px-4 py-3 text-secondary text-ink-500">
                <span>
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
 className="btn-outline !px-2 text-secondary disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
 className="btn-outline !px-2 text-secondary disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}