/** @type {import('tailwindcss').Config} */

// Every colour, radius and type step below derives from src/theme/tokens.js.
// That file is the source of truth; this one only teaches Tailwind about it.
// If a value needs to change, change it there.
import {
  ink, primary, deep, success, danger, warning,
  CANVAS, SURFACE, LINE, DIVIDER,
} from './src/theme/tokens.js';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Inter carries the whole app. `font-display` used to mean Sora;
        // it now means "Inter, tracked tighter" (the tracking lives in
        // index.css) so every existing font-display class keeps working
        // and simply stops being a second typeface.
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        // Sora survives on exactly one element: the landing hero headline.
        hero:    ['"Sora"', 'system-ui', 'sans-serif'],
      },

      colors: {
        // Named surfaces, so a page never has to guess which ink step is
        // "the page background" or "a real boundary".
        canvas:  CANVAS,
        surface: SURFACE,
        line:    LINE,
        divider: DIVIDER,

        ink,
        primary,
        deep,

        // Data colours. `success` is the cool emerald and `danger` the
        // cool red — both are DATA colours: numbers, status pills, chart
        // series. Never a button, link, nav item or icon.
        success,
        danger,
        warning,
        // `info` is kept as a scale name (existing classes depend on it)
        // and points at the deep blue so the app only ever shows one blue
        // family.
        info: deep,
      },

      borderRadius: {
        control: '4px',  // buttons, inputs, tiles
        panel:   '8px',  // panels, tables, modals
        pill:    '999px',// status pills only
        // Clamp the oversized defaults to the panel radius so nothing
        // renders over-rounded while pages are still being swept.
        xl:  '8px',
        '2xl': '8px',
        '3xl': '8px',
      },

      spacing: {
        // The 4/8/12/16/24/32 scale is Tailwind's 1/2/3/4/6/8 already.
        // These two are the control heights.
        control: '36px',
        touch:   '44px',
      },
      minHeight: { touch: '44px', control: '36px' },
      minWidth:  { touch: '44px' },

      fontSize: {
        // The type scale, as [size, {lineHeight, letterSpacing, weight}].
        'page-title':    ['20px', { lineHeight: '24px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'section-title': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'body':          ['14px', { lineHeight: '20px' }],
        'secondary':     ['13px', { lineHeight: '18px' }],
        'label':         ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        'cell':          ['13px', { lineHeight: '18px' }],
        'button':        ['13px', { lineHeight: '16px', fontWeight: '600' }],
        'money':         ['20px', { lineHeight: '24px', fontWeight: '600' }],
      },

      boxShadow: {
        // Shadow is allowed on four things only: modals, dropdowns,
        // sticky bars and the mobile bottom nav. Nothing else.
        overlay: '0 12px 32px -8px rgba(15, 21, 34, 0.18), 0 2px 8px -2px rgba(15, 21, 34, 0.10)',
        pop:     '0 6px 20px -6px rgba(15, 21, 34, 0.16), 0 1px 4px -1px rgba(15, 21, 34, 0.08)',
        sticky:  '0 -1px 0 0 rgba(226, 230, 236, 1), 0 -6px 16px -8px rgba(15, 21, 34, 0.10)',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        // `animate-fade-in` was used in 7 places but never defined —
        // a silent no-op. Defined here so it actually does something.
        'fade-in': 'fade-in 150ms ease-out both',
      },
    },
  },
  plugins: [],
};
