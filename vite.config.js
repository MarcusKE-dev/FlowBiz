// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { staticRoutePaths, shellFilesFor } from './src/router/staticRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `--mode emulator` runs the real Firebase SDK against the local emulator
// suite, but the browser under test is pinned to a single origin, so the
// emulators are reached same-origin through these path prefixes rather than
// on :8080/:9099 directly. Dev-server only — never part of a build.
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';

const emulatorProxy = {
  '/v1': { target: FIRESTORE_EMULATOR, changeOrigin: true },
  '/google.firestore.v1.Firestore': {
    target: FIRESTORE_EMULATOR,
    changeOrigin: true,
    ws: true,
  },
  '/identitytoolkit.googleapis.com': { target: AUTH_EMULATOR, changeOrigin: true },
  '/securetoken.googleapis.com': { target: AUTH_EMULATOR, changeOrigin: true },
  '/www.googleapis.com': { target: AUTH_EMULATOR, changeOrigin: true },
  '/emulator': { target: AUTH_EMULATOR, changeOrigin: true },
};

/**
 * THE DEMO IS A SPA IN A SUBDIRECTORY, AND THAT IS THE WHOLE PROBLEM.
 *
 * A static host answers /demo/floor by looking for a file. There isn't
 * one — the router was going to handle that path — so the host falls
 * back, and Cloudflare Pages' fallback is the ROOT index.html. The
 * product's app then boots with no basename, matches nothing, and shows
 * the landing page. Every demo deep link, on every reload, new tab and
 * bookmark. public/_redirects has carried a /demo/* rewrite for this
 * since August and it demonstrably does not fire on the deployment.
 *
 * So the demo build stops relying on a rule being interpreted the way we
 * hoped and writes the file instead: index.html, copied to every path
 * the router declares. A static asset is served before any redirect
 * logic is consulted, by every host, which makes this the one version of
 * the fix that cannot be undone by a hosting setting.
 *
 * Both `<route>.html` and `<route>/index.html` are written. Pages
 * documents the first and it is the better one — the directory form
 * costs a 308 to /demo/floor/ first — but which file a host reaches for
 * is exactly the assumption that produced this bug, and this is a fix
 * that can only be proven by deploying it.
 *
 * It also drops a copy at the deployment root as demo-shell.html, which
 * is what _redirects now points /demo/* at. The old rule named
 * /demo/index.html — a destination that matches its own source pattern,
 * which is the most likely reason it was dropped. Belt and braces: if
 * the rule works, it catches demo URLs no route declares; if it does
 * not, the files above have already answered.
 */
function demoRouteShells({ outDir, rootOutDir, routerFile }) {
  return {
    name: 'flowbiz-demo-route-shells',
    apply: 'build',
    // The shells are written after the bundle and excluded from the
    // service worker's precache by name (see workbox.globIgnores below).
    // Listing ninety byte-identical copies of index.html in a manifest
    // for a service worker the demo never registers — main.jsx calls
    // registerSW only outside demo mode — would be pure weight.
    closeBundle() {
      const dir = path.resolve(__dirname, outDir);
      const shell = path.join(dir, 'index.html');
      if (!fs.existsSync(shell)) return;

      const html = fs.readFileSync(shell);
      const routes = staticRoutePaths(fs.readFileSync(path.resolve(__dirname, routerFile), 'utf8'));

      let written = 0;
      for (const route of routes) {
        for (const name of shellFilesFor(route)) {
          const file = path.join(dir, name);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, html);
          written += 1;
        }
      }

      const root = path.resolve(__dirname, rootOutDir);
      if (fs.existsSync(root)) fs.writeFileSync(path.join(root, 'demo-shell.html'), html);

      this.info(`demo route shells: ${written} files for ${routes.length} routes in ${outDir}`);
    },
  };
}

// Computed once, and used twice: the plugin writes these files and
// workbox is told to leave them out of the precache manifest.
const DEMO_SHELL_FILES = staticRoutePaths(
  fs.readFileSync(path.resolve(__dirname, 'src/router/AppRouter.jsx'), 'utf8'),
).flatMap(shellFilesFor);

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? '/demo/' : '/',

  build: {
    outDir: mode === 'demo' ? 'dist/demo' : mode === 'emulator' ? 'dist/emulator' : 'dist',
  },

  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    ...(mode === 'emulator' ? { proxy: emulatorProxy } : {}),
  },

  // `vite preview` serves the BUILT app with its service worker, which is
  // the only way to exercise the offline behaviour honestly — the dev
  // server fetches route chunks on demand, so going offline there fails the
  // dynamic import rather than testing the product.
  preview: {
    ...(mode === 'emulator' ? { proxy: emulatorProxy } : {}),
  },

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
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'favicon-16.png',
        'icons/*.png',
        'hero-photo.webp',
        'robots.txt',
      ],
      manifest: {
        id: '/',
        name: 'FlowBiz — Business Manager',
        short_name: 'FlowBiz',
        description: 'POS, inventory and finance management for Kenyan SMBs',
        theme_color: '#F4F6F9',
        background_color: '#F4F6F9',
        display: 'standalone',
        orientation: 'natural',
        start_url: '/',
        scope: '/',
        lang: 'en-KE',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [],
      },
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        ...(mode === 'demo' ? { globIgnores: DEMO_SHELL_FILES } : {}),
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/demo($|\/)/, /^\/r\//, /^\/api\//],
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

    ...(mode === 'demo'
      ? [demoRouteShells({
          outDir: 'dist/demo',
          rootOutDir: 'dist',
          routerFile: 'src/router/AppRouter.jsx',
        })]
      : []),
  ],
}));