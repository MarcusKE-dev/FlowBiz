// src/components/charts/chartGeometry.js
//
// Pure geometry and formatting for the plotted charts. No JSX, no React —
// everything here is a function of numbers, so the axis maths can be read
// (and reasoned about) without a browser.

// The plot area's gutters, in CSS pixels. Left is wide enough for a
// compact y-axis label ("1.2M"), bottom for a single line of x labels.
export const PLOT = { left: 48, right: 8, top: 8, bottom: 24 };

// Four horizontal gridlines: the domain floor, two thirds, and the ceiling.
export const GRIDLINE_COUNT = 4;

// Below this there is no plot area worth drawing into — a 56px gutter
// plus a few pixels of series is not a chart.
export const MIN_PLOT_WIDTH = 40;

// A categorical band this wide comfortably holds a short label ("Wed",
// "Mon"). Narrower than this and the band axis thins like a time axis.
export const MIN_BAND_LABEL_WIDTH = 34;

// "KES 12,000.00" does not fit in a 48px gutter. These do.
export function compactNumber(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const trim = (x) => String(Number(x.toFixed(1))); // 1.0 -> "1", 1.25 -> "1.3"
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}k`;
  return `${sign}${Math.round(abs)}`;
}

// Zero is always inside the domain, so the baseline is always visible and
// a series that never dips negative still reads against a true floor.
export function domainOf(values) {
  const nums = values.map((v) => Number(v) || 0);
  const max = Math.max(...nums, 0);
  const min = Math.min(...nums, 0);
  return { min, max, range: max - min || 1 };
}

// Gridline values from the domain floor to its ceiling, inclusive.
export function gridValues({ min, max }, count = GRIDLINE_COUNT) {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

// At most `max` evenly spaced bucket indices. Labelling all 90 days of a
// quarter produces an unreadable smear, and rotating them is worse.
export function labelIndices(n, max = 6) {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = new Set();
  for (let i = 0; i < max; i += 1) {
    out.add(Math.round((i * (n - 1)) / (max - 1)));
  }
  return [...out].sort((a, b) => a - b);
}

// A single point is not a trend, and a flat run of zeroes is not a chart —
// both should show the empty state rather than a line along the floor.
export function isPlottable(values) {
  if (!values || values.length < 2) return false;
  return values.some((v) => (Number(v) || 0) !== 0);
}
