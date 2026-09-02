// src/components/ui/StatusPill.jsx
//
// The only 999px radius in the app. Every pill carries a word — status
// is never conveyed by colour alone, so these read correctly in
// greyscale and to anyone who can't separate the hues.

const TONES = {
  neutral:  'bg-ink-100 text-ink-700',
  positive: 'bg-success-50 text-success-800',
  negative: 'bg-danger-50 text-danger-700',
  caution:  'bg-warning-50 text-warning-800',
  info:     'bg-primary-50 text-primary-800',
};

export default function StatusPill({ tone = 'neutral', icon: Icon, children, className = '', ...rest }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.neutral} ${className}`} {...rest}>
      {Icon && <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </span>
  );
}
