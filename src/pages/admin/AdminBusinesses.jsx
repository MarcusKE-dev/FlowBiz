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
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Business Directory</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-0.5">Search, inspect, and manage merchant accounts across FlowBiz.</p>
        </div>
        <span className="text-xs font-bold text-ink-500 bg-white border border-ink-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {data?.total ?? '…'} Registered Businesses
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 bg-white space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by business name, ID, owner email or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input !pl-9 text-xs sm:text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={plan}
              onChange={(e) => { setPlan(e.target.value); setPage(1); }}
              className="input !w-auto text-xs font-semibold"
            >
              <option value="all">All Plans</option>
              <option value="pro">Pro Plan</option>
              <option value="free">Free Starter</option>
            </select>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="input !w-auto text-xs font-semibold"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
            <button type="submit" className="btn-primary !py-2 text-xs font-bold">
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
        <div className="card p-12 text-center bg-white space-y-2">
          <Building2 className="h-8 w-8 mx-auto text-ink-300" />
          <h3 className="font-bold text-ink-800">No businesses match</h3>
          <p className="text-xs text-ink-400">Try adjusting your keyword, plan filter, or status criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Card View (< sm screens) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {data.businesses.map((b) => (
              <div key={b.id} className="card p-4 bg-white space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/admin/businesses/${b.id}`} className="font-bold text-ink-900 text-sm hover:text-moss-700 block">
                      {b.name}
                    </Link>
                    <span className="font-mono text-[10px] text-ink-400">{b.id}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`badge ${b.plan === 'pro' ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-ink-100 text-ink-600'}`}>
                      {b.plan.toUpperCase()}
                    </span>
                    <span className={`badge ${b.status === 'active' ? 'bg-moss-100 text-moss-800' : 'bg-rust-100 text-rust-700'}`}>
                      {b.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-ink-600 space-y-0.5 border-t border-ink-100 pt-2">
                  <p><strong className="text-ink-800">{b.owner?.name || 'Owner'}</strong> &middot; {b.owner?.email || b.settings?.email || 'No email'}</p>
                  <p className="text-[11px] text-ink-400">Registered on {formatDate(b.createdAt)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/admin/businesses/${b.id}`}
                    className="btn-outline !min-h-0 !py-1.5 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" /> Inspect
                  </Link>
                  <Link
                    to={`/admin/businesses/${b.id}/support`}
                    className="btn-outline !min-h-0 !py-1.5 text-xs font-semibold flex items-center justify-center gap-1 text-amber-700 hover:bg-amber-50"
                  >
                    <Shield className="h-3.5 w-3.5" /> Support
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= sm screens) */}
          <div className="hidden sm:block card overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-ink-50 uppercase text-[10px] font-bold text-ink-400 border-b border-ink-100">
                  <tr>
                    <th className="px-4 py-3">Business Name &amp; ID</th>
                    <th className="px-4 py-3">Owner Contact</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 font-medium">
                  {data.businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-ink-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/businesses/${b.id}`} className="font-bold text-ink-900 hover:text-moss-700 block text-sm">
                          {b.name}
                        </Link>
                        <span className="font-mono text-[10px] text-ink-400">{b.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-ink-800 block">{b.owner?.name || 'Owner'}</span>
                        <span className="text-[11px] text-ink-500">{b.owner?.email || b.settings?.email || 'No email on file'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${b.plan === 'pro' ? 'bg-amber-100 text-amber-800 font-black' : 'bg-ink-100 text-ink-600'}`}>
                          {b.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${b.status === 'active' ? 'bg-moss-100 text-moss-800' : 'bg-rust-100 text-rust-700'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {formatDate(b.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/businesses/${b.id}`}
                            className="btn-outline !min-h-0 !py-1 !px-2 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Inspect
                          </Link>
                          <Link
                            to={`/admin/businesses/${b.id}/support`}
                            className="btn-outline !min-h-0 !py-1 !px-2 text-[11px] font-semibold inline-flex items-center gap-1 text-amber-700 hover:bg-amber-50"
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
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
                <span>
                  Page {data.page} of {data.totalPages} ({data.total} total)
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-outline !min-h-0 !py-1 !px-2 text-xs disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <button
                    type="button"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-outline !min-h-0 !py-1 !px-2 text-xs disabled:opacity-40"
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