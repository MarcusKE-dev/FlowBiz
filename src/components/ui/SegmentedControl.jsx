// src/components/ui/SegmentedControl.jsx
//
// Period pickers, tab switches, view toggles. One control, hairline
// border, the selected segment filled with the primary tint — blue as
// selection, which is one of the four things blue is allowed to mean.

export default function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-control border border-line
                  bg-surface p-0.5 ${className}`}
    >
      {options.map((o) => {
        const id = o.value ?? o;
        const label = o.label ?? o;
        const selected = id === value;
        // `title` is what makes an icon-only segment usable: it is the
        // tooltip AND the accessible name, so a control whose labels are
        // glyphs still announces itself. Text segments carry their own
        // name in their label and pass nothing.
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={o.title}
            aria-label={o.title}
            onClick={() => onChange(id)}
            className={`rounded-[2px] text-button transition-colors
              ${o.title ? 'flex h-7 w-7 items-center justify-center px-0' : 'px-3'}
              ${selected
                ? 'bg-primary-50 text-primary-800'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
