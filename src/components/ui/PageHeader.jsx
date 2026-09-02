// src/components/ui/PageHeader.jsx
//
// The top of every page. Sits directly on the canvas — no surface, no
// icon chip, no uppercase eyebrow. Title, an optional line of context,
// and the page's actions on the right.

export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-page-title text-ink-900">{title}</h1>
        {description && (
          <p className="mt-1 text-secondary text-ink-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
