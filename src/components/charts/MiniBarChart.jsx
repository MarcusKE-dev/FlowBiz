// src/components/charts/MiniBarChart.jsx
//
// Two orientations from one component:
//
//   "horizontal"  ranked comparisons (best-selling products, top
//                 overstocked items). An HTML bar list, not an SVG: it
//                 reads correctly at any width, wraps its labels, and
//                 never needed measuring. Defaults to the primary series
//                 colour — a ranking is not inherently good or bad.
//
//   "vertical"    a value over time (profit by weekday). A real plotted
//                 chart: gridlines, both axes, a hover / tap readout, and
//                 pixel-exact sizing. Defaults to primary/negative per bar
//                 based on the sign, because being above or below zero IS
//                 the meaning here. Above zero is blue, not green — blue
//                 on a chart is data, and filled blue is only ever an
//                 action on a control.
//
//   "compact"     a KPI sparkline, as BARS. Same job as MiniLineChart's
//                 compact mode and deliberately the alternative to it: at
//                 36px tall a line is a squiggle with no scale, no zero
//                 and no unit, and there is nothing in it a reader can
//                 name. One bar per bucket is a shape a person can
//                 actually read — how many periods, which were big, which
//                 fell below zero, and where the latest one sits.
//
// Colours are raw hex from theme/tokens.js, never Tailwind classes.

import { useElementWidth } from '../../hooks/useElementWidth';
import { CHART_SERIES, PRIMARY, NEGATIVE, DIVIDER, LINE } from '../../theme/tokens';
import { isPlottable } from './chartGeometry';
import PlotFrame from './PlotFrame';
import ChartEmpty from './ChartEmpty';

// The sparkline, as bars. Measured like every other chart here, so it
// reserves exactly the height it draws into.
//
// Two things carry meaning and neither depends on hue: bars below the
// baseline hang under it, and the most recent bucket is drawn at full
// strength while the rest are held back. "Where are we now, and is it
// above or below the line" is answerable at a glance.
function SparkBars({ data, height, color }) {
  const [ref, width] = useElementWidth();
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const n = values.length;

  const band = n > 0 ? width / n : width;
  const barW = Math.max(band * 0.6, 1);
  const yAt = (v) => height - ((v - min) / range) * height;
  const zeroY = yAt(0);
  const crossesZero = min < 0 && max > 0;

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {crossesZero && (
            <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke={LINE} strokeWidth="1" />
          )}
          {values.map((v, i) => {
            const y = yAt(v);
            return (
              <rect
                key={i}
                x={band * i + (band - barW) / 2}
                y={Math.min(y, zeroY)}
                width={barW}
                height={Math.max(Math.abs(zeroY - y), 1)}
                fill={v < 0 ? NEGATIVE : color}
                opacity={i === n - 1 ? 1 : 0.45}
                rx={barW > 3 ? 1 : 0}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default function MiniBarChart({
  data,
  orientation = 'vertical',
  height = 220,
  formatValue = (v) => String(v),
  ariaLabel,
  empty,
  compact = false,
  color = PRIMARY,
}) {
  if (!data || data.length === 0) return compact ? null : <ChartEmpty>{empty}</ChartEmpty>;

  const values = data.map((d) => Number(d.value) || 0);

  // A sparkline in a KPI cell has no room for an empty state, so it just
  // is not there when there is nothing to show — same rule as the line.
  if (compact) {
    return isPlottable(values) ? <SparkBars data={data} height={height} color={color} /> : null;
  }

  // ── Ranked list ────────────────────────────────────────────────────
  // A single ranked row is still a legible ranking, so this branch only
  // needs the values to be non-zero.
  if (orientation === 'horizontal') {
    const maxAbs = Math.max(...values.map(Math.abs), 1);
    return (
      <div role="img" aria-label={ariaLabel || 'Bar chart'} className="space-y-2.5">
        {data.map((d, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between gap-2 text-secondary">
              <span className="truncate font-medium text-ink-800">{d.label}</span>
              <span className="num shrink-0 font-semibold text-ink-900">{formatValue(values[i])}</span>
            </div>
            <div className="h-1.5 w-full rounded-pill" style={{ background: DIVIDER }}>
              <div
                className="h-1.5 rounded-pill"
                style={{
                  width: `${Math.max((Math.abs(values[i]) / maxAbs) * 100, 2)}%`,
                  background: d.color || CHART_SERIES[0],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Plotted bars ───────────────────────────────────────────────────
  if (!isPlottable(values)) return <ChartEmpty>{empty}</ChartEmpty>;

  const fillFor = (i) => data[i].color || (values[i] >= 0 ? PRIMARY : NEGATIVE);

  return (
    <PlotFrame
      data={data}
      values={values}
      height={height}
      xMode="band"
      ariaLabel={ariaLabel || 'Bar chart'}
      renderSeries={({ yAt, plot }) => {
        const barW = plot.band * 0.55;
        const zeroY = yAt(0);
        return (
          <g>
            {data.map((d, i) => {
              const y = yAt(values[i]);
              return (
                <rect
                  key={i}
                  x={plot.left + plot.band * i + (plot.band - barW) / 2}
                  y={Math.min(y, zeroY)}
                  width={barW}
                  height={Math.max(Math.abs(zeroY - y), 1)}
                  fill={fillFor(i)}
                  rx="1"
                />
              );
            })}
          </g>
        );
      }}
      renderHovered={({ i, xAt, yAt, plot }) => {
        const barW = plot.band * 0.55;
        const y = yAt(values[i]);
        const zeroY = yAt(0);
        return (
          <rect
            x={xAt(i) - barW / 2}
            y={Math.min(y, zeroY)}
            width={barW}
            height={Math.max(Math.abs(zeroY - y), 1)}
            fill={fillFor(i)}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            rx="1"
          />
        );
      }}
      renderTooltip={(i) => (
        <>
          <div className="font-semibold text-ink-900">{data[i].label}</div>
          <div className="num mt-0.5 whitespace-nowrap text-ink-700">{formatValue(values[i])}</div>
        </>
      )}
    />
  );
}
