// src/components/charts/MiniBarChart.jsx
//
// Two orientations from one component:
//   - "horizontal" — ranked comparisons (best-selling products, top
//     overstocked items). Defaults to the primary series colour: a
//     ranking is not inherently good or bad, so it stays out of the
//     positive/negative pair.
//   - "vertical" — a value over time (profit trend). Defaults to
//     positive/negative per bar based on the sign, because profit being
//     above or below zero IS the meaning here.
//
// Colours are raw hex from theme/tokens.js, never Tailwind classes.
import { CHART_SERIES, POSITIVE, NEGATIVE, DIVIDER } from '../../theme/tokens';

export default function MiniBarChart({
  data,
  orientation = 'vertical',
  height = 160,
  formatValue = (v) => String(v),
  ariaLabel,
}) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => Number(d.value) || 0);
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

  if (orientation === 'horizontal') {
    return (
      <div role="img" aria-label={ariaLabel || 'Bar chart'} className="space-y-2.5">
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const widthPct = Math.max((Math.abs(value) / maxAbs) * 100, 2);
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-secondary">
                <span className="truncate font-medium text-ink-800">{d.label}</span>
                <span className="num shrink-0 font-semibold text-ink-900">{formatValue(value)}</span>
              </div>
              <div className="h-1.5 w-full rounded-pill" style={{ background: DIVIDER }}>
                <div
                  className="h-1.5 rounded-pill"
                  style={{ width: `${widthPct}%`, background: d.color || CHART_SERIES[0] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const width = Math.max(data.length * 14, 100);
  const midY = height / 2;
  return (
    <div>
      {/* Default preserveAspectRatio — "none" used to squash the bars
          and the baseline along with them. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel || 'Bar chart'}
      >
        <line x1="0" y1={midY} x2={width} y2={midY} stroke={DIVIDER} strokeWidth="1" />
        {data.map((d, i) => {
          const value = Number(d.value) || 0;
          const gap = width / data.length;
          const barWidth = gap * 0.55;
          const x = i * gap + (gap - barWidth) / 2;
          const barHeight = (Math.abs(value) / maxAbs) * (midY - 8);
          const y = value >= 0 ? midY - barHeight : midY;
          const fill = d.color || (value >= 0 ? POSITIVE : NEGATIVE);
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 1)}
              fill={fill}
              rx="1"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-ink-500">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
