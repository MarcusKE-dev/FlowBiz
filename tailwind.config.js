/** @type {import('tailwindcss').Config} */

// Every colour, radius and type step below derives from src/theme/tokens.js.
// That file is the source of truth; this one only teaches Tailwind about it.
// If a value needs to change, change it there.
import {
  ink, primary, deep, danger, warning,
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

        // Data colours. `danger` is the cool red and `warning` the
        // amber — both are DATA colours: numbers, status pills, chart
        // series. Never a button, link, nav item or icon.
        //
        // The green ramp is deliberately NOT imported. Green is gone
        // from the app: profit, positive money and positive status are
        // blue now, and red is reserved for negatives, losses and
        // errors. The ramp still exists in tokens.js as a record of the
        // old palette, but Tailwind must not generate classes for it —
        // that way any survivor fails to render and is caught in review
        // rather than quietly staying green.
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
        // Tailwind's oversized xl/2xl/3xl used to be clamped to 8px here
        // while pages were still being swept off them. The sweep is done
        // — nothing in src/ uses them — so the clamp is gone and a stray
        // `rounded-xl` now renders at its real 12px, visibly wrong,
        // rather than being quietly absorbed.
      },

      spacing: {
        // The 4/8/12/16/24/32 scale is Tailwind's 1/2/3/4/6/8 already.
        // These two are the control heights. In rem, not px, so they
        // grow with the root size the desktop breakpoints set — a 36px
        // button under 18px text reads as a cramped 36px button.
        control: '2.25rem', // 36px at a 16px root
        touch:   '2.75rem', // 44px at a 16px root
        // The mobile "All pages" tile. Tall enough for an icon over a
        // label without either crowding the tile's border.
        tile:    '5.5rem',  // 88px at a 16px root
      },
      minHeight: { touch: '2.75rem', control: '2.25rem' },
      minWidth:  { touch: '2.75rem' },

      fontSize: {
        // The type scale, as [size, {lineHeight, letterSpacing, weight}].
        //
        // rem, not px. The sizes below are identical to the old pixel
        // values at the 16px root mobile uses; index.css raises the root
        // at >=1280px and >=1680px, and because Tailwind's spacing scale
        // is rem too, padding, gaps and control heights grow with them.
        // A 27-inch monitor stops rendering phone-sized type.
        'page-title':    ['1.25rem',   { lineHeight: '1.5rem',   letterSpacing: '-0.02em', fontWeight: '600' }],
        'section-title': ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '600' }],
        'body':          ['0.875rem',  { lineHeight: '1.25rem',  fontWeight: '400' }],
        'secondary':     ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '400' }],
        'label':         ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '600' }],
        'cell':          ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '400' }],
        'button':        ['0.8125rem', { lineHeight: '1rem',     fontWeight: '600' }],
        'money':         ['1.25rem',   { lineHeight: '1.5rem',   fontWeight: '600' }],
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
