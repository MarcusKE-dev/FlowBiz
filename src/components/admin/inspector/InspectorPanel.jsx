// src/components/admin/inspector/InspectorPanel.jsx
//
// The frame every Inspector tab renders inside: an optional toolbar
// (search, date range), then exactly one of four states — loading, error,
// empty, or the table — followed by an honest footer.
//
// The footer is the part worth reading. A support agent looking at 25 of
// a shop's 9,000 sales needs to know that is what they are looking at,
// and an agent whose search found nothing needs to know whether "nothing"
// means "not in this business" or "not in the first 600 records we were
// willing to scan". Both are printed, always.

import { useState } from 'react';
import { Inbox, Search, RotateCw } from 'lucide-react';
import AdminApiError from '../AdminApiError';
import DataTable from '../../ui/DataTable';
import EmptyState from '../../ui/EmptyState';
import { SkeletonRows } from '../../ui/Skeleton';

function DateRange({ from, to, onChange, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-label uppercase text-ink-500">{label}</label>
      <input
        type="date"
        value={from || ''}
        onChange={(e) => onChange({ from: e.target.value || null, to })}
        className="input !w-auto !py-1.5 text-cell"
        aria-label="From date"
      />
      <span className="text-cell text-ink-400">to</span>
      <input
        type="date"
        value={to || ''}
        onChange={(e) => onChange({ from, to: e.target.value || null })}
        className="input !w-auto !py-1.5 text-cell"
        aria-label="To date"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange({ from: null, to: null })}
          className="text-cell text-ink-500 underline hover:text-ink-900"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default function InspectorPanel({
  title,
  description,
  columns,
  rows,
  meta,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onReload,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  dateRange,
  onDateRange,
  dateLabel = 'Date range',
  emptyTitle = 'Nothing recorded',
  emptyDescription,
  onRowClick,
  leading,
  actions,
}) {
  const [draft, setDraft] = useState(search || '');

  const submitSearch = (e) => {
    e.preventDefault();
    onSearch?.(draft.trim());
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-hint mt-0.5">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onReload}
            className="btn-outline !px-2.5 flex items-center gap-1.5 text-button"
            title="Re-read this section"
          >
            <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Refresh
          </button>
        </div>
      </div>

      {(onSearch || onDateRange) && (
        <div className="flex flex-wrap items-center gap-3">
          {onSearch && (
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="input !w-64 !py-1.5 !pl-8 text-cell"
                />
              </div>
              <button type="submit" className="btn-outline !px-3 text-button">Search</button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setDraft(''); onSearch(''); }}
                  className="text-cell text-ink-500 underline hover:text-ink-900"
                >
                  Clear
                </button>
              )}
            </form>
          )}
          {onDateRange && (
            <DateRange
              from={dateRange?.from}
              to={dateRange?.to}
              onChange={onDateRange}
              label={dateLabel}
            />
          )}
        </div>
      )}

      {error ? (
        <AdminApiError error={error} onRetry={onReload} />
      ) : loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={search ? Search : Inbox}
          title={search ? 'No match in the records searched' : emptyTitle}
          description={
            search
              ? meta?.searchTruncated
                ? `Nothing matched “${search}” in the ${meta.searchScanned} most recent records. The search stops at a fixed depth, so narrow it with a date range if the record is older.`
                : `Nothing in this business matched “${search}”.`
              : emptyDescription
          }
        />
      ) : (
        <>
          {meta?.degradedOrdering && (
            <p className="rounded-panel border border-line bg-surface px-3 py-2 text-cell text-ink-600">
              {meta.degradedReason}
            </p>
          )}
          <DataTable
            columns={columns}
            rows={rows}
            mobileLayout="row"
            leading={leading}
            onRowClick={onRowClick}
            caption={title}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-cell text-ink-500">
            <span>
              Showing {rows.length} record{rows.length === 1 ? '' : 's'}
              {meta?.searchScanned != null && ` from the ${meta.searchScanned} most recent scanned`}
              {hasMore && ', more available'}
            </span>
            {hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="btn-outline !px-3 text-button"
              >
                {loadingMore ? 'Loading…' : 'Load next page'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
