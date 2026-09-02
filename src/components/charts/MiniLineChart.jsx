// src/components/charts/MiniLineChart.jsx
//
// A small, dependency-free SVG line chart. No new npm package needed —
// this project has no chart library installed, and a handful of plain
// SVG components is simpler to install (nothing to install) and audit
// than adding one for three small charts.
//
// Accessible by design rather than by adding interactivity: instead of
// JS-driven hover tooltips, the start/end labels and the overall change
// are always shown as real text under the chart, so the trend is never
// locked behind a colour someone might not be able to distinguish.
//
// Colours come from theme/tokens.js as raw hex, not Tailwind classes, so
// the chart, the PDF export and the screen all read the same source.
import { CHART_SERIES, POSITIVE, NEGATIVE, INK_3 } from '../../theme/tokens';

export default function MiniLineChart({
  data,
  height = 140,
  color = CHART_SERIES[0],
  formatValue = (v) => String(v),
  ariaLabel,
  compact = false,
}) {
  if (!data || data.length === 0) return null;

  const width = 300; // viewBox units — scales to container via className="w-full"
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padY = 10;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const y = height - padY - ((Number(d.value) || 0) - min) / range * (height - padY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const showDots = !compact && data.length <= 31;

  return (
    <div>
      {/* preserveAspectRatio is deliberately left at its default. It used
          to be "none", which stretched the viewBox to the container and
          turned every data point into an ellipse. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel || 'Trend chart'}
      >
        <path d={areaPath} fill={color} opacity="0.08" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {showDots && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
        ))}
      </svg>

      {!compact && (
        <>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-500">
            <span>{data[0].label}</span>
            <span>{data[data.length - 1].label}</span>
          </div>
          {change !== null && (
            <p
              className="mt-1 text-secondary font-medium"
              style={{ color: change >= 0 ? POSITIVE : NEGATIVE }}
            >
              {change >= 0 ? 'Up' : 'Down'} {Math.abs(change).toFixed(1)}% over this period, ending at{' '}
              <span className="num" style={{ color: INK_3 }}>{formatValue(last)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
