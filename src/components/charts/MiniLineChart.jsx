// src/components/charts/MiniLineChart.jsx
//
// A dependency-free SVG line chart. No chart library is installed in this
// project, and a handful of plain SVG components is simpler to install
// (nothing to install) and to audit than adding one for four small charts.
//
// Two very different jobs, one component:
//
//   default    a real instrument — gridlines, both axes, and a hover /
//              tap readout. Sized in real pixels off a ResizeObserver, so
//              nothing is scaled and nothing is letterboxed.
//
//   compact    a KPI sparkline. Deliberately stripped: no axes, no
//              gridlines, no tooltip, no dots. It is a shape, not a chart,
//              and at 36px tall an axis label would be noise. It is still
//              measured, because a 36px sparkline in a default-150px SVG
//              box was reserving four times the height it drew into.
//
// Colours come from theme/tokens.js as raw hex, not Tailwind classes, so
// the chart, the PDF export and the screen all read one source.

import { useElementWidth } from '../../hooks/useElementWidth';
import { CHART_SERIES, PRIMARY, NEGATIVE, INK_3 } from '../../theme/tokens';
import { isPlottable } from './chartGeometry';
import PlotFrame from './PlotFrame';
import ChartEmpty from './ChartEmpty';

// The sparkline path: same maths as the full chart, minus every axis.
function Sparkline({ data, height, color }) {
  const [ref, width] = useElementWidth();
  const values = data.map((d) => Number(d.value) || 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padY = 3;

  const points = data.map((d, i) => ({
    x: data.length > 1 ? (i * width) / (data.length - 1) : width / 2,
    y: height - padY - (((Number(d.value) || 0) - min) / range) * (height - padY * 2),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${points[points.length - 1]?.x.toFixed(1)} ${height} L ${points[0]?.x.toFixed(1)} ${height} Z`;

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <path d={area} fill={color} opacity="0.08" />
          <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}

export default function MiniLineChart({
  data,
  height = 200,
  color = CHART_SERIES[0],
  formatValue = (v) => String(v),
  ariaLabel,
  compact = false,
  empty,
}) {
  if (!data || data.length === 0) return compact ? null : <ChartEmpty>{empty}</ChartEmpty>;

  const values = data.map((d) => Number(d.value) || 0);

  // One point is not a trend and a flat run of zeroes is not a chart. A
  // sparkline just disappears rather than pushing an empty block into a
  // KPI cell that has no room for one.
  if (!isPlottable(values)) {
    return compact ? null : <ChartEmpty>{empty}</ChartEmpty>;
  }

  if (compact) return <Sparkline data={data} height={height} color={color} />;

  const last = values[values.length - 1];
  const first = values[0];
  const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;

  return (
    <div>
      <PlotFrame
        data={data}
        values={values}
        height={height}
        ariaLabel={ariaLabel || 'Trend chart'}
        renderSeries={({ xAt, yAt, plot }) => {
          const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value) }));
          const line = pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ');
          const floor = plot.top + plot.height;
          const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${floor} L ${pts[0].x.toFixed(1)} ${floor} Z`;
          return (
            <g>
              <path d={area} fill={color} opacity="0.08" />
              <path d={line} fill="none" stroke={color} strokeWidth="2" />
              {data.length <= 31 && pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
              ))}
            </g>
          );
        }}
        renderHovered={({ i, xAt, yAt }) => (
          <circle cx={xAt(i)} cy={yAt(data[i].value)} r="4" fill={color} stroke="#FFFFFF" strokeWidth="1.5" />
        )}
        renderTooltip={(i) => (
          <>
            <div className="font-semibold text-ink-900">{data[i].label}</div>
            <div className="num mt-0.5 whitespace-nowrap text-ink-700">{formatValue(values[i])}</div>
          </>
        )}
      />

      {/* The trend as text as well as as a line, so it is never locked
          behind a colour someone might not be able to distinguish. */}
      {change !== null && (
        <p
          className="mt-2 text-secondary font-medium"
          style={{ color: change >= 0 ? PRIMARY : NEGATIVE }}
        >
          {change >= 0 ? 'Up' : 'Down'} {Math.abs(change).toFixed(1)}% over this period, ending at{' '}
          <span className="num" style={{ color: INK_3 }}>{formatValue(last)}</span>
        </p>
      )}
    </div>
  );
}
