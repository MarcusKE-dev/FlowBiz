// src/components/ui/StatusPill.jsx
//
// A status is a WORD, not a container. Every status in FlowBiz used to be
// a filled 999px pill, and a table of them read as a wall of coloured
// lozenges rather than as a column of statuses — the background carried
// no information the word did not already carry, and it made every list
// visually heavier than the numbers beside it.
//
// So the default treatment is now semantic TEXT: the same tone
// vocabulary, the same label type, no fill and no radius. The word still
// carries the meaning on its own, so these read correctly in greyscale
// and to anyone who cannot separate the hues, exactly as before.
//
// `solid` is the escape hatch, not the default. Use it only where a
// filled chip genuinely earns its weight: a standing warning about the
// environment you are operating in, or a single high-risk state a reader
// must not scan past. If you are labelling one row in a list of rows, you
// do not want it.

const TONES = {
  neutral:  'text-ink-500',
  positive: 'text-primary-700',
  negative: 'text-danger-700',
  caution:  'text-warning-700',
  info:     'text-deep-600',
};

const SOLID_TONES = {
  neutral:  'bg-ink-100 text-ink-700',
  positive: 'bg-primary-50 text-primary-800',
  negative: 'bg-danger-50 text-danger-700',
  caution:  'bg-warning-50 text-warning-800',
  info:     'bg-primary-50 text-primary-800',
};

export default function StatusPill({ tone = 'neutral', solid = false, icon: Icon, children, className = '', ...rest }) {
  const base = solid
    ? `badge ${SOLID_TONES[tone] || SOLID_TONES.neutral}`
    : `inline-flex items-center gap-1 text-label leading-4 ${TONES[tone] || TONES.neutral}`;
  return (
    <span className={`${base} ${className}`} {...rest}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </span>
  );
}
