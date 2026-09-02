// src/components/ui/Toolbar.jsx
//
// The filter / search / segmented-control row that sits under a
// PageHeader. Wraps to multiple lines on narrow screens rather than
// scrolling sideways, so nothing ever ends up unreachable on a phone.

export default function Toolbar({ children, right, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
