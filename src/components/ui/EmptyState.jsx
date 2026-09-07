// src/components/ui/EmptyState.jsx
//
// What a table or list says when it has nothing to show. Quiet: a
// dashed hairline, an optional 20px icon, a sentence explaining what
// would appear here, and the one action that would put something in it.

export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-panel border
                  border-dashed border-line bg-surface px-6 py-12 text-center ${className}`}
    >
      {Icon && <Icon className="h-5 w-5 text-ink-400" strokeWidth={1.75} aria-hidden="true" />}
      <h3 className="font-display text-section-title text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-secondary text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
