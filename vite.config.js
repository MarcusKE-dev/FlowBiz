import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `defineConfig` accepts a function so we can read the active Vite `mode`
// (set by the --mode flag on the CLI) and branch on it.
export default defineConfig(({ mode }) => ({
  // DEMO BUILD OUTPUT — `npm run build` now runs the normal build AND a
  // second pass with `--mode demo` (see package.json). The demo pass is
  // served from the `/demo/` sub-path of the SAME deployed site (see
  // public/_redirects), so every asset URL it emits (JS, CSS, etc.) must
  // be prefixed with `/demo/` — that's what `base` does below. The real
  // build keeps `base: '/'`, exactly as before, so nothing changes for it.
  base: mode === 'demo' ? '/demo/' : '/',

  build: {
    // Writes the demo build into a SUBFOLDER of the real build's own
    // output folder. One `dist/` directory ends up holding both apps —
    // dist/index.html (real) and dist/demo/index.html (demo) — ready to
    // deploy as a single Cloudflare Pages site with no extra config.
    outDir: mode === 'demo' ? 'dist/demo' : 'dist',
  },

  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },

  // DEMO MODE — this is what actually connects Demo Mode to the app.
  // `npm run dev:demo` runs `vite --mode demo`. When mode is 'demo', every
  // `import ... from 'firebase/firestore'` and `import ... from
  // 'firebase/auth'` ANYWHERE in the codebase — every page, every hook,
  // and src/firebase.js itself — is transparently redirected to our local,
  // localStorage-backed implementations (src/demo/localFirestore.js and
  // src/demo/localAuth.js) instead of the real Firebase SDK. No other file
  // needs to know Demo Mode exists; they all just import from
  // 'firebase/firestore' / 'firebase/auth' as normal and get whichever
  // implementation matches how the app was built. This is also what makes
  // the deployed demo airtight: the demo build's JavaScript never contains
  // the real Firebase SDK at all, so there is no code path in it that
  // could ever read or write real Firestore data or a real account's
  // cached data — the isolation happens at build time, not by trusting a
  // runtime flag.
  //
  // `npm run build` / `npm run dev` (no --mode) leaves `resolve.alias`
  // empty, so it is 100% unaffected and behaves exactly as before — real
  // Firebase, real Firestore, real Authentication.
  resolve: mode === 'demo' ? {
    alias: {
      'firebase/firestore': path.resolve(__dirname, 'src/demo/localFirestore.js'),
      'firebase/auth': path.resolve(__dirname, 'src/demo/localAuth.js'),
    },
  } : {},

  plugins: [
    react(),

    VitePWA({

      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'favicon-16.png', 'icons/*.png'],
      manifest: {
        name: 'FlowBiz — Business Manager',
        short_name: 'FlowBiz',
        description: 'POS, inventory and finance management for Kenyan SMBs',
        theme_color: '#1a623c',
        background_color: '#faf6ef',
        display: 'standalone',
        orientation: 'natural',
        start_url: '/',
        scope: '/',
        lang: 'en-KE',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: 'icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
          { src: 'icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // FIX: this service worker is registered at scope '/', which
        // covers the ENTIRE site — including /demo/, even though that's
        // a completely separate app served from its own build. Without
        // this line, the FIRST visit to /demo/ works fine (this service
        // worker hasn't installed yet), but once it's active it silently
        // intercepts every later navigation to /demo/* and answers with
        // its own cached copy of the REAL app instead of ever letting
        // the browser reach the demo build. The real app then finds no
        // /demo route and immediately redirects to '/' — which is
        // exactly "works once, then just reloads the landing page."
        // Excluding /demo/* here means those navigations are left alone
        // and go to the network as normal, where Cloudflare correctly
        // serves the separately-built demo app.
        navigateFallbackDenylist: [/^\/demo($|\/)/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
}));