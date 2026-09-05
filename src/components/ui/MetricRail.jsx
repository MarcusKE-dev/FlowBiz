// src/components/ui/MetricRail.jsx
//
// The KPI row, as one bordered strip divided by vertical hairlines —
// not four separate cards. The data has one boundary, so it gets one
// boundary. Four across on desktop, two across on mobile.
//
// Numbers are the hero here: big, tabular, ink-900, with the currency
// prefix rendered smaller and muted so the digits carry the weight. The
// value is `text-money` at every breakpoint (and larger again from xl),
// so the cell claws back its horizontal padding on a 2-up phone grid —
// otherwise a six-figure value truncates by a few pixels.
//
// The internal hairlines are drawn by the container's background showing
// through a 1px grid gap, rather than by per-cell borders — that way a
// wrapped row never doubles up a border or leaves a stub at the end.

export function Metric({ label, value, prefix, delta, deltaTone = 'neutral', hint }) {
  // The delta rides beside the number as semantic text. It used to be a
  // filled pill, which put a second coloured container next to the one
  // thing on this tile that is meant to carry the weight.
  const deltaClass =
    deltaTone === 'positive' ? 'text-primary-700'
    : deltaTone === 'negative' ? 'text-danger-700'
    : 'text-ink-500';

  return (
    <div className="min-w-0 bg-surface px-3 py-3 sm:px-4">
      <div className="text-label uppercase text-ink-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <div className="flex min-w-0 items-baseline gap-1">
          {prefix && (
            <span className="shrink-0 text-secondary font-medium text-ink-400">{prefix}</span>
          )}
          <span className="num truncate text-money text-ink-900 xl:text-[1.5rem] xl:leading-[1.875rem]">{value}</span>
        </div>
        {delta && <span className={`num shrink-0 text-label leading-4 ${deltaClass}`}>{delta}</span>}
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
