// src/components/ui/StatementBlock.jsx
//
// A ledger: label on the left, number on the right, hairline between
// rows, one tinted result row at the bottom. This is how a profit
// ladder, a till reconciliation or a drawer count should read — as a
// statement, not as a grid of cards.

// `strong` marks a subtotal: the line the ones above it add up to. It
// gets weight and a heavier rule above, so a statement reads as groups
// rather than as one undifferentiated list.
export function StatementRow({ label, value, prefix, tone = 'default', indent = false, hint, strong = false }) {
  const valueClass =
    tone === 'positive' ? 'text-success-700'
    : tone === 'negative' ? 'text-danger-700'
    : tone === 'muted' ? 'text-ink-500'
    : 'text-ink-900';

  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${
        strong ? 'border-t border-line bg-ink-50/60' : ''
      }`}
    >
      <div className={`min-w-0 ${indent ? 'pl-4' : ''}`}>
        <span className={`text-body ${strong ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{label}</span>
        {hint && <span className="ml-2 text-secondary text-ink-400">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-baseline gap-1">
        {prefix && <span className="text-[12px] font-medium text-ink-400">{prefix}</span>}
        <span className={`num text-body font-semibold tabular-nums ${valueClass}`}>{value}</span>
      </div>
    </div>
  );
}

export function StatementResult({ label, value, prefix, tone = 'neutral' }) {
  const tint =
    tone === 'positive' ? 'bg-success-50 text-success-800'
    : tone === 'negative' ? 'bg-danger-50 text-danger-700'
    : tone === 'caution' ? 'bg-warning-50 text-warning-800'
    : 'bg-primary-50 text-primary-800';

  return (
    <div className={`flex items-baseline justify-between gap-4 px-4 py-3 ${tint}`}>
      <span className="text-section-title">{label}</span>
      <div className="flex shrink-0 items-baseline gap-1">
        {prefix && <span className="text-[13px] font-medium opacity-70">{prefix}</span>}
        <span className="num text-money">{value}</span>
      </div>
    </div>
  );
}

export default function StatementBlock({ children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-panel border border-line bg-surface
                     divide-y divide-divider ${className}`}>
      {children}
    </div>
  );
}
