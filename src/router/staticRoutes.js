// src/router/staticRoutes.js
//
// WHICH URLS THE BUILD HAS TO EXIST AT, as opposed to which ones the
// router can handle once it is running. On a static host those are two
// different lists, and the gap between them is what broke the demo.
//
// THE FAILURE. FlowBiz is a single-page app: the router owns every path,
// and the host only ever has to hand back the same index.html for all of
// them. The product gets that free — Cloudflare Pages falls back to the
// root index.html for any path it cannot find. The DEMO does not, because
// it lives one directory down at /demo/, and the fallback is root-only.
//
// public/_redirects has carried a `/demo/*  /demo/index.html  200` rule
// for exactly this since August, and on the live deployment it does
// nothing: /demo/ is served (a real file), and /demo/floor,
// /demo/kitchen, /demo/customer-display — every single deep link —
// falls through to the ROOT index.html instead. The root app then boots
// with no basename, matches /demo/… against nothing, and lands on the
// catch-all, which is the landing page. Hence: click "Open customer
// display", get the marketing site.
//
// It is not specific to the display. It is every demo URL that is
// reached by a reload, a new tab, a bookmark or a typed address — which
// is precisely how a second screen at the pass is opened.
//
// THE FIX IS TO STOP ASKING. A static file is served by every host that
// has ever existed, before any rule is consulted, so the demo build
// writes a copy of its own index.html at every route the router
// declares. `/demo/customer-display` is then a FILE, and no redirect
// rule has to be right for it to work.
//
// The list comes from AppRouter.jsx itself rather than a second copy
// kept in step by hand — a route added there and forgotten here would
// reintroduce exactly this bug for exactly one page, which is the
// hardest version of it to notice.

/**
 * Every fixed path declared in the router source.
 *
 * Parameterised routes (`/customers/:customerId`) and the catch-all are
 * deliberately excluded: there is no finite set of files that could
 * cover them. They stay dependent on the host fallback, which is
 * acceptable — none of them is a screen anybody opens on a second
 * device, and all of them are reachable by navigation within the app.
 */
export function staticRoutePaths(routerSource) {
  const seen = new Set();
  for (const match of routerSource.matchAll(/path="(\/[^"]*)"/g)) {
    const route = match[1];
    if (route === '/' || route.includes(':') || route.includes('*')) continue;
    seen.add(route);
  }
  return [...seen].sort();
}

/**
 * Where a route's shell files go, relative to the build's output
 * directory. BOTH forms, deliberately.
 *
 * A static host resolves an extensionless request by trying, in some
 * order of its own choosing, `floor`, `floor.html` and
 * `floor/index.html`. Cloudflare Pages documents `floor.html`, and that
 * form is also the better one — the directory form costs a 308 to
 * `/demo/floor/` first. But which file a host reaches for is precisely
 * the kind of assumption that produced this bug, and this is a fix that
 * can only be tested by deploying it. Writing both costs a few hundred
 * kilobytes of identical HTML and removes the question.
 */
export function shellFilesFor(route) {
  const bare = route.replace(/^\//, '');
  return [`${bare}.html`, `${bare}/index.html`];
}
