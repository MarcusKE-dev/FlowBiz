// src/lib/appUrl.js
//
// WHERE THE APP ACTUALLY LIVES, and why hard-coding "/" was a bug rather
// than a shortcut.
//
// FlowBiz is served from two places. The product sits at the root of the
// origin; the demo is built with `base: '/demo/'` and mounted under
// `basename="/demo"` (see vite.config.js and main.jsx), so the SAME
// component renders at /counter in one and /demo/counter in the other.
//
// React Router knows this — `<Link to="/x">` and `<Navigate to="/x">`
// both prepend the basename. Nothing else does. A plain `<a href="/x">`
// and `window.location.href = '/x'` are handed straight to the browser,
// which resolves them against the ORIGIN and drops the basename on the
// floor.
//
// What that cost, and it is the reason this file exists: "Open customer
// display" in the demo is an <a href="/customer-display"> opening in a
// new tab, so a visitor on flowbiz.co.ke/demo/settings was thrown to
// flowbiz.co.ke/customer-display — out of the demo, into the real app,
// signed in as nobody, at a business with no orders capability. The
// screen then told them, correctly and uselessly, that "this business
// does not keep orders". The display was never broken. The link was.
//
// So: any URL that leaves React Router's hands goes through here.
//
//   appPath('/customer-display')  → '/customer-display'
//                                 → '/demo/customer-display' in the demo
//
//   appUrl('/customer-display')   the same, absolute, for a link someone
//                                 copies onto another screen.
//
// `import.meta.env.BASE_URL` is Vite's own answer for the build being
// run, so this cannot drift from the `base` in vite.config.js the way a
// second copy of the string would.

/**
 * The pure half, and the only half worth testing: a base and a path in,
 * one path out. `import.meta` is per-module, so a test cannot stand in
 * front of the one below — splitting the join out is what makes the rule
 * checkable at both bases instead of only the one the test runner has.
 */
export function pathUnder(base, path = '/') {
  const root = base || '/';
  const prefix = root.endsWith('/') ? root.slice(0, -1) : root;
  return `${prefix}/${String(path).replace(/^\/+/, '')}`;
}

// Vite's own answer for the build being run, so this cannot drift from
// the `base` in vite.config.js the way a second copy of the string
// would. Optional, not because Vite ever omits it, but so this module
// can be imported under plain `node --test`, where there is no
// `import.meta.env` at all.
function currentBase() {
  return import.meta.env?.BASE_URL || '/';
}

/** An absolute PATH within this build, basename included. */
export function appPath(path = '/') {
  return pathUnder(currentBase(), path);
}

/**
 * The same thing as a full URL. For anything a person copies, opens on
 * another device, or pastes into a message — a display address, an
 * invite link — where a path alone is not enough.
 */
export function appUrl(path = '/') {
  const p = appPath(path);
  return typeof window === 'undefined' ? p : `${window.location.origin}${p}`;
}
