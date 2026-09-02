// src/components/ui/MetricRail.jsx
//
// The KPI row, as one bordered strip divided by vertical hairlines —
// not four separate cards. The data has one boundary, so it gets one
// boundary. Four across on desktop, two across on mobile.
//
// Numbers are the hero here: big, tabular, ink-900, with the currency
// prefix rendered smaller and muted so the digits carry the weight.
//
// The internal hairlines are drawn by the container's background showing
// through a 1px grid gap, rather than by per-cell borders — that way a
// wrapped row never doubles up a border or leaves a stub at the end.

export function Metric({ label, value, prefix, delta, deltaTone = 'neutral', hint }) {
  const deltaClass =
    deltaTone === 'positive' ? 'bg-success-50 text-success-800'
    : deltaTone === 'negative' ? 'bg-danger-50 text-danger-700'
    : 'bg-ink-100 text-ink-700';

  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <div className="text-label uppercase text-ink-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <div className="flex min-w-0 items-baseline gap-1">
          {prefix && (
            <span className="shrink-0 text-[13px] font-medium text-ink-400">{prefix}</span>
          )}
          <span className="num truncate text-[17px] font-semibold leading-[22px] text-ink-900 sm:text-money">{value}</span>
        </div>
        {delta && <span className={`badge shrink-0 ${deltaClass}`}>{delta}</span>}
      </div>
      {hint && <div className="mt-1 truncate text-secondary text-ink-500">{hint}</div>}
    </div>
  );
}

export default function MetricRail({ children, columns = 4, className = '' }) {
  const cols =
    columns === 3 ? 'sm:grid-cols-3'
    : columns === 2 ? 'sm:grid-cols-2'
    : 'sm:grid-cols-4';

  // Mobile is always 2-up. An odd number of metrics would leave a hole,
  // and because the hairlines are the container's background showing
  // through the grid gap, that hole reads as a grey block. Let the last
  // cell span the full width instead — and undo that from `sm` up, where
  // the real column count takes over.
  const odd = Array.isArray(children)
    ? children.filter(Boolean).length % 2 === 1
    : false;

  return (
    <div
      className={`grid grid-cols-2 ${cols} gap-px overflow-hidden rounded-panel
                  border border-line bg-line
                  ${odd ? '[&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1' : ''}
                  ${className}`}
    >
      {children}
    </div>
  );
}
