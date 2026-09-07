// src/components/charts/PlotFrame.jsx
//
// The shell every plotted chart sits in: a measured container, an SVG with
// real pixel width and height, gridlines, both axes, and one hover readout
// shared by mouse and touch.
//
// The SVG's width and height are set to the measured pixel size and the
// viewBox is set to exactly the same box, so the scale factor is 1 and no
// preserveAspectRatio letterboxing can occur. Nothing is ever squashed
// because nothing is ever scaled.
//
// The container div is ALWAYS rendered, even at width 0. Returning null
// before the first measurement would mean the ref never attaches, the
// ResizeObserver never fires, and the width stays 0 forever.
//
// Series are supplied by render props rather than by children so they can
// be handed the scales:
//   renderSeries({ xAt, yAt, plot })   SVG nodes for the data itself
//   renderHovered({ i, xAt, yAt })     SVG nodes drawn on the hovered index
//   renderTooltip(i)                   HTML nodes for the tooltip body
//
// `xMode` is 'point' for line charts (the first and last points sit on the
// plot edges) or 'band' for bar charts (each bucket owns a slice).
//
// X-axis thinning differs between the two, deliberately. A dense time
// series is always capped at six labels. A band axis is categorical — its
// labels are the categories — so it labels every bucket while the bands
// are wide enough to hold one, and only thins when they are not. Capping
// seven weekdays at six would label Sun-Tue and Thu-Sat and drop
// Wednesday, which reads as a fault rather than as thinning.

import { useCallback, useEffect, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { DIVIDER, LINE, INK_3 } from '../../theme/tokens';
import {
  PLOT, MIN_PLOT_WIDTH, MIN_BAND_LABEL_WIDTH,
  compactNumber, domainOf, gridValues, labelIndices,
} from './chartGeometry';

export default function PlotFrame({
  data,
  values,
  height,
  ariaLabel,
  formatY = compactNumber,
  xMode = 'point',
  renderSeries,
  renderHovered,
  renderTooltip,
}) {
  const [ref, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const clear = useCallback(() => setHovered(null), []);

  // A tap anywhere else dismisses the readout. The buckets stop their own
  // touches from bubbling, so tapping bucket B while A is open re-targets
  // rather than closing.
  useEffect(() => {
    if (hovered === null) return undefined;
    document.addEventListener('touchstart', clear);
    return () => document.removeEventListener('touchstart', clear);
  }, [hovered, clear]);

  const n = data.length;
  const plotW = width - PLOT.left - PLOT.right;
  const plotH = height - PLOT.top - PLOT.bottom;
  const ready = width > 0 && plotW >= MIN_PLOT_WIDTH && plotH > 0;

  const domain = domainOf(values);
  const yAt = (v) =>
    PLOT.top + plotH - (((Number(v) || 0) - domain.min) / domain.range) * plotH;
  const band = n > 0 ? plotW / n : plotW;
  const xAt =
    xMode === 'band'
      ? (i) => PLOT.left + band * (i + 0.5)
      : (i) => PLOT.left + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
  const scales = { xAt, yAt, plot: { ...PLOT, width: plotW, height: plotH, band } };

  const grid = ready ? gridValues(domain) : [];
  const roomForEveryBand = xMode === 'band' && band >= MIN_BAND_LABEL_WIDTH;
  const xLabels = ready ? labelIndices(n, roomForEveryBand ? n : 6) : [];
  const showZero = ready && domain.min < 0 && domain.max > 0;

  // Keep the tooltip inside the container at both ends.
  const inset = Math.min(60, width / 2);
  const tipLeft = hovered === null
    ? 0
    : Math.min(Math.max(xAt(hovered), inset), width - inset);

  return (
    <div ref={ref} className="relative w-full" style={{ height }} onTouchStart={clear}>
      {ready && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel || 'Chart'}
          onMouseLeave={clear}
        >
          {/* Gridlines, with their value in the left gutter. */}
          {grid.map((v, i) => (
            <g key={`g${i}`}>
              <line
                x1={PLOT.left}
                y1={yAt(v)}
                x2={PLOT.left + plotW}
                y2={yAt(v)}
                stroke={DIVIDER}
                strokeWidth="1"
              />
              <text
                x={PLOT.left - 8}
                y={yAt(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-label"
                fill={INK_3}
              >
                {formatY(v)}
              </text>
            </g>
          ))}

          {/* The baseline reads heavier than the gridlines it crosses. */}
          {showZero && (
            <line
              x1={PLOT.left}
              y1={yAt(0)}
              x2={PLOT.left + plotW}
              y2={yAt(0)}
              stroke={LINE}
              strokeWidth="1"
            />
          )}

          {renderSeries?.(scales)}

          {/* X axis: at most six buckets, never rotated. The extremes
              anchor inward so a wide label cannot clip the container. */}
          {xLabels.map((i) => (
            <text
              key={`x${i}`}
              x={xAt(i)}
              y={height - 8}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              className="text-label"
              fill={INK_3}
            >
              {data[i].label}
            </text>
          ))}

          {/* Hover readout: a vertical guide plus whatever the series
              wants to mark, then one invisible bucket per data point. */}
          {hovered !== null && (
            <>
              <line
                x1={xAt(hovered)}
                y1={PLOT.top}
                x2={xAt(hovered)}
                y2={PLOT.top + plotH}
                stroke={LINE}
                strokeWidth="1"
              />
              {renderHovered?.({ i: hovered, ...scales })}
            </>
          )}

          {data.map((d, i) => {
            const w = xMode === 'band' ? band : plotW / Math.max(n - 1, 1);
            const centre = xMode === 'band' ? PLOT.left + band * (i + 0.5) : xAt(i);
            const x0 = Math.max(centre - w / 2, PLOT.left);
            const x1 = Math.min(centre + w / 2, PLOT.left + plotW);
            return (
              <rect
                key={`hit${i}`}
                x={x0}
                y={PLOT.top}
                width={Math.max(x1 - x0, 1)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onTouchStart={(e) => { e.stopPropagation(); setHovered(i); }}
              />
            );
          })}
        </svg>
      )}

      {/* HTML, not SVG, so it can carry the panel's own border, radius,
          shadow and type scale. */}
      {ready && hovered !== null && renderTooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-panel
                     border border-line bg-surface px-2.5 py-1.5 text-secondary shadow-pop"
          style={{ left: tipLeft, top: PLOT.top }}
        >
          {renderTooltip(hovered)}
        </div>
      )}
    </div>
  );
}
