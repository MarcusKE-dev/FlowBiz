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
// Colours are raw hex from theme/tokens.js, never Tailwind classes.

import { CHART_SERIES, PRIMARY, NEGATIVE, DIVIDER } from '../../theme/tokens';
import { isPlottable } from './chartGeometry';
import PlotFrame from './PlotFrame';
import ChartEmpty from './ChartEmpty';

export default function MiniBarChart({
  data,
  orientation = 'vertical',
  height = 220,
  formatValue = (v) => String(v),
  ariaLabel,
  empty,
}) {
  if (!data || data.length === 0) return <ChartEmpty>{empty}</ChartEmpty>;

  const values = data.map((d) => Number(d.value) || 0);

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
