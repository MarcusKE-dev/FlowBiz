import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Generated output, not source. `dev-dist` is the PWA plugin's
  // development service worker and `dist` the production build; both are
  // Workbox's minified code, and linting them produced 41 of the 69
  // errors that made `npm run lint` unusable as a CI gate.
  globalIgnores(['dist', 'dev-dist', '**/*.min.js']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-refresh/only-export-components': 'warn',
      // Omitting fields by destructuring — `const { stock, ...rest } = data`
      // to build an update payload that must not carry `stock` — is the
      // idiom this codebase uses, and the discarded siblings are the
      // point of it, not an oversight.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The Cloudflare Worker and every test file run on Node or the
    // Workers runtime, not in a browser: `process`, `console`, `Buffer`
    // and the node:test globals are theirs. Linted with `globals.browser`
    // alone they read as a wall of no-undef.
    files: ['cloudflare-worker/**/*.js', '**/*.test.js', 'test/**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
