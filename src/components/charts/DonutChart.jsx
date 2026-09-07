// src/components/charts/DonutChart.jsx
//
// Small part-to-whole breakdown (payment methods, stock health). Always
// paired with a text legend showing exact values and percentages — the
// slices alone are never the only way to read the data.
//
// Segment colours default to the fixed series order in theme/tokens.js,
// so an unstyled breakdown still comes out in the house palette.
import { CHART_SERIES, DIVIDER, INK } from '../../theme/tokens';

export default function DonutChart({
  segments,
  size = 148,
  formatValue = (v) => String(v),
  centerLabel,
  stacked = false,
}) {
  const visible = (segments || []).filter((s) => (Number(s.value) || 0) > 0);
  const total = visible.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Dash lengths and their running offsets are derived, not accumulated
  // into a closure variable during render — each arc's offset is the sum
  // of every dash before it.
  const dashes = visible.map((s) => ((Number(s.value) || 0) / total) * circumference);
  const arcs = dashes.map((dash, i) => ({
    dash,
    gap: circumference - dash,
    offset: dashes.slice(0, i).reduce((sum, d) => sum + d, 0),
  }));

  return (
    <div className={`flex flex-col items-center gap-4 ${stacked ? '' : 'sm:flex-row'}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" role="img" aria-label="Breakdown chart">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={DIVIDER} strokeWidth="14" />
        {visible.map((s, i) => (
          <circle
            key={i}
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={s.color || CHART_SERIES[i % CHART_SERIES.length]}
            strokeWidth="14"
            strokeDasharray={`${arcs[i].dash} ${arcs[i].gap}`}
            strokeDashoffset={-arcs[i].offset}
            transform="rotate(-90 50 50)"
          />
        ))}
        {centerLabel && (
          <text
            x="50" y="53" textAnchor="middle" fill={INK}
            style={{ fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="w-full space-y-1.5">
        {visible.map((s, i) => {
          const value = Number(s.value) || 0;
          const pct = (value / total) * 100;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-body">
              <span className="flex min-w-0 items-center gap-2 text-ink-700">
                <span
                  className="h-2 w-2 shrink-0 rounded-pill"
                  style={{ background: s.color || CHART_SERIES[i % CHART_SERIES.length] }}
                  aria-hidden="true"
                />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="num shrink-0 font-semibold text-ink-900">
                {formatValue(value)} <span className="font-normal text-ink-500">({pct.toFixed(0)}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
