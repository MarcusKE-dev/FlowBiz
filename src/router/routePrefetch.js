const idle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (fn) => setTimeout(fn, 200);

export function prefetchRoutes(loaders) {
  if (!navigator.onLine) return;
  // Respect Data Saver — never spend someone's mobile data on
  // speculative background fetches if they've asked sites not to.
  if (navigator.connection?.saveData) return;

  loaders.forEach((load, i) => {
    idle(() => { load().catch(() => {}); }, { timeout: 2000 + i * 500 });
  });
}