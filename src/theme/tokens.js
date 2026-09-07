// src/theme/tokens.js
//
// "Ledger and Rail" — the single source of truth for every colour in
// FlowBiz. Tailwind reads this file (tailwind.config.js imports it), so
// does every non-Tailwind consumer: the charts, the jsPDF receipt/report
// exporters, the PWA manifest and the Cloudflare Worker's HTML + email
// templates. Nothing in the app should ever type a hex literal again.
//
// Three rules this palette exists to enforce:
//   1. Surfaces only where the data has a real boundary.
//   2. Numbers are the hero.
//   3. Filled blue is an ACTION. Blue text or a blue tint is DATA.
//      That distinction is what keeps buttons and numbers apart now
//      that positive money is also blue.
//
// The old FlowBiz green (#1a623c) and sand (#faf6ef) are gone, and so
// is the cool emerald that briefly replaced them. Green now survives in
// exactly one thing: the WhatsApp button, which wears WhatsApp's own
// brand colour and is not part of this palette at all.

// ── Core surfaces ───────────────────────────────────────────────────
export const CANVAS  = '#F4F6F9'; // the page itself
export const SURFACE = '#FFFFFF'; // panels, tables, modals
export const LINE    = '#E2E6EC'; // real boundaries
export const DIVIDER = '#EDF0F4'; // rules inside a boundary

// ── Ink ─────────────────────────────────────────────────────────────
export const INK   = '#0F1522'; // titles, money
export const INK_2 = '#4A5468'; // secondary text
export const INK_3 = '#7A8598'; // labels, muted, placeholders

// ── Action blue ─────────────────────────────────────────────────────
export const PRIMARY        = '#1D70F5';
export const PRIMARY_HOVER  = '#1659CC';
export const PRIMARY_ACTIVE = '#1247A6';
export const PRIMARY_TINT   = '#EEF4FE'; // selection, active nav fill

// Deep blue — auth and admin chrome, and the second data series.
export const DEEP = '#1B2CC1';

// ── Data / status ───────────────────────────────────────────────────
// The green below is RETIRED. Nothing in the app renders it any more —
// positive money, positive status and positive chart series are all blue
// — and tailwind.config.js no longer imports the ramp, so Tailwind
// generates no classes for it and any survivor fails loudly in review.
// It stays here only as a record of what the palette used to be.
export const POSITIVE = '#0F9D74';
export const NEGATIVE = '#D3402F';
export const CAUTION  = '#C77A0B';

// ── Ramps ───────────────────────────────────────────────────────────
// Tailwind needs 50-900 steps. Each ramp is anchored on the exact
// values above (marked ←) and interpolated around them; the anchors are
// the only values that carry meaning, the rest exist so tints and
// hovers stay inside one hue.

export const ink = {
  50:  CANVAS,     // ←
  100: DIVIDER,    // ←
  200: LINE,       // ←
  300: '#C6CCD6',
  400: '#9AA3B2',
  500: INK_3,      // ←
  600: '#5F6A7E',
  700: INK_2,      // ←
  800: '#2B3446',
  900: INK,        // ←
  950: '#070A11',
};

export const primary = {
  50:  PRIMARY_TINT,   // ←
  100: '#D9E7FD',
  200: '#B4CFFB',
  300: '#85B0F9',
  400: '#5090F7',
  500: '#2F7DF6',
  600: PRIMARY,        // ←
  700: PRIMARY_HOVER,  // ←
  800: PRIMARY_ACTIVE, // ←
  900: '#103A83',
};

export const deep = {
  50:  '#EDEFFC',
  100: '#DBDFFA',
  200: '#B9C0F4',
  300: '#8E99EC',
  400: '#5F6DE0',
  500: '#3A48D0',
  600: DEEP,       // ←
  700: '#17249B',
  800: '#141E7C',
  900: '#121A63',
};

export const success = {
  50:  '#ECFAF4',
  100: '#D2F3E6',
  200: '#A6E7CE',
  300: '#6DD5B0',
  400: '#34BC91',
  500: '#14A87E',
  600: POSITIVE,   // ←
  700: '#0C7E5D',
  800: '#0A6349',
  900: '#08503C',
};

export const danger = {
  50:  '#FDF2F1',
  100: '#FBE0DD',
  200: '#F6C2BC',
  300: '#EE9A90',
  400: '#E36C5E',
  500: '#DA4E3D',
  600: NEGATIVE,   // ←
  700: '#B02F21',
  800: '#8E271C',
  900: '#75231A',
};

export const warning = {
  50:  '#FDF7EC',
  100: '#FAECD1',
  200: '#F4D79E',
  300: '#EBBB63',
  400: '#E0A032',
  500: '#D48A16',
  600: CAUTION,    // ←
  700: '#A05F0A',
  800: '#814B0D',
  900: '#6A3E0E',
};

// ── Charts ──────────────────────────────────────────────────────────
// Fixed series order. Blue leads because the primary series is the one
// the reader is meant to follow. Green is gone entirely: a sixth series
// takes a light blue rather than POSITIVE, so no chart can ever read as
// good-vs-bad by hue alone.
export const CHART_SERIES = [PRIMARY, DEEP, INK_3, CAUTION, NEGATIVE, primary[300]];

// ── jsPDF ───────────────────────────────────────────────────────────
// jsPDF wants [r, g, b]. Kept here so the printed receipt, the emailed
// report and the screen can never drift apart.
export function rgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export const PDF = {
  ink:      rgb(INK),
  ink2:     rgb(INK_2),
  ink3:     rgb(INK_3),
  line:     rgb(LINE),
  divider:  rgb(DIVIDER),
  canvas:   rgb(CANVAS),
  surface:  rgb(SURFACE),
  primary:  rgb(PRIMARY),
  deep:     rgb(DEEP),
  negative: rgb(NEGATIVE),
  caution:  rgb(CAUTION),
  primaryTint:  rgb(primary[50]),
  negativeTint: rgb(danger[50]),
};

export default {
  CANVAS, SURFACE, LINE, DIVIDER,
  INK, INK_2, INK_3,
  PRIMARY, PRIMARY_HOVER, PRIMARY_ACTIVE, PRIMARY_TINT, DEEP,
  POSITIVE, NEGATIVE, CAUTION,
  ink, primary, deep, success, danger, warning,
  CHART_SERIES, PDF, rgb,
};
