// src/components/ui/Money.jsx
//
// A currency figure with the prefix demoted: smaller, muted, ahead of
// tabular digits that carry the weight. `masked` renders the privacy
// placeholder instead, with no prefix.

import { CURRENCY, amountOnly } from './format';

export default function Money({ value, masked = false, tone, className = '' }) {
  const toneClass =
    tone === 'positive' ? 'text-primary-700'
    : tone === 'negative' ? 'text-danger-700'
    : tone === 'muted' ? 'text-ink-500'
    : '';

  if (masked) return <span className={`num ${toneClass} ${className}`}>••••••</span>;

  return (
    <span className={`num whitespace-nowrap ${toneClass} ${className}`}>
      <span className="text-[0.85em] font-medium text-ink-400">{CURRENCY}</span>{' '}
      {amountOnly(value)}
    </span>
  );
}
