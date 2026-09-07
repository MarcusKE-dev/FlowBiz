// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  ],
}));