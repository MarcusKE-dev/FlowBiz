// src/components/ui/Section.jsx
//
// A titled group on the canvas. Generalised from the pattern Settings.jsx
// already used. A Section is NOT a card: it has a heading, an optional
// hint, an optional right-aligned action, and its content — but no
// border and no background of its own. Anything inside it that needs a
// real boundary (a table, a statement block) brings its own.

export default function Section({
  title,
  hint,
  action,
  children,
  as: Tag = 'section',
  className = '',
  headerClassName = '',
  ...rest
}) {
  return (
    <Tag className={`space-y-3 ${className}`} {...rest}>
      {(title || action) && (
        <div className={`flex items-start justify-between gap-3 ${headerClassName}`}>
          <div className="min-w-0">
            {title && <h2 className="section-title">{title}</h2>}
            {hint && <p className="section-hint mt-0.5">{hint}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
