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

// How wide a label actually renders, near enough. Measured off the label
// type scale (11px, 600, 0.04em): a six-character date comes out at about
// 44px, so a shade over 7px per character. It only has to be right enough
// to decide how many labels fit, and erring high costs a label, while
// erring low costs a collision.
export const LABEL_CHAR_WIDTH = 7.2;

// Clear air either side of a label before it reads as touching its
// neighbour.
export const LABEL_GAP = 10;

// The widest label in the set. Every label on one axis is the same type,
// and dates in one range are the same length, so the longest is the one
// that has to fit.
export function estimateLabelWidth(labels) {
  const longest = (labels || []).reduce(
    (max, l) => Math.max(max, String(l ?? '').length), 0
  );
  return longest * LABEL_CHAR_WIDTH;
}

// How many labels an axis of this width can hold.
//
// This used to be the constant 6 at every size and for every label, which
// is where the x axis on a phone fell apart. Six labels over a seven-day
// period means labelling six of the seven points — on a 300px plot that
// puts their centres 50px apart while "07 Sept" is 50px wide, so
// consecutive dates collide and the axis reads as a smear. Six is still
// the ceiling (a 90-day axis labelled fourteen times is unreadable for
// the opposite reason), but it is a ceiling rather than a target now.
export function maxLabelsFor(span, labelWidth, ceiling = 6) {
  // The binding constraint is at the ENDS, not in the middle. The first
  // and last labels are anchored inward (so they cannot clip the
  // container), which means each occupies a whole label width from its
  // own centre rather than half of one. So the first gap has to clear a
  // full width plus the next label's half — 1.5 widths — and even
  // spacing then satisfies every gap after it.
  const step = labelWidth * 1.5 + LABEL_GAP;
  if (step <= 0) return ceiling;
  return Math.max(2, Math.min(ceiling, Math.floor(span / step) + 1));
}

// The guarantee, applied after the even spread above.
//
// `labelIndices` spreads its picks across whole buckets, so it ROUNDS —
// its gaps are only approximately equal, and on a narrow axis two
// adjacent picks can still land on top of each other even when the
// average spacing is fine. This walks the picks in order and drops any
// that would touch the one kept before it, or crowd the last one.
//
// The two ends are never dropped: the first and last bucket are the two
// labels a reader actually needs (where does this axis start, and where
// does it end), and they are the ones anchored inward so they cannot
// clip the container either.
export function spaceOutLabels(indices, xOf, labelWidth, gap = LABEL_GAP) {
  if (!indices || indices.length <= 2) return indices || [];
  const half = labelWidth / 2;
  const first = indices[0];
  const last = indices[indices.length - 1];

  const kept = [first];
  // The first label is start-anchored and the last is end-anchored, so
  // each occupies a full label width inward from its own centre.
  let lastRight = xOf(first) + labelWidth;
  const lastLeft = xOf(last) - labelWidth;

  for (const i of indices.slice(1, -1)) {
    const left = xOf(i) - half;
    const right = xOf(i) + half;
    if (left >= lastRight + gap && right + gap <= lastLeft) {
      kept.push(i);
      lastRight = right;
    }
  }
  kept.push(last);
  return kept;
}

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
