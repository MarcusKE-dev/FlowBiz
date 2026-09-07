// src/utils/catalogueSearch.js
//
// Finding a product at the counter, at any catalogue size.
//
// The counter used to filter with an inline
// `products.filter(p => p.name.toLowerCase().includes(...))` in the render
// body. For a duka with sixty products that is free. For a supermarket
// with four thousand it is three lowercase allocations per product per
// keystroke, and then four thousand tiles handed to React — which is the
// difference between a counter that keeps up with a queue and one that
// does not.
//
// So: one pass, one lowercase per product per keystroke, exact-code
// matches promoted to the front, and a hard cap on how many results are
// ever rendered. The cap is the important part. Nobody scans a wall of
// 4,000 tiles; they either scan a barcode or they type. Showing the first
// 120 and saying so is both faster AND more usable than showing all of
// them.
//
// Deliberately NOT a search index. An index would have to be built,
// invalidated and kept in sync with a live onSnapshot, and it would save
// nothing at these sizes — a linear scan of 4,000 short strings is well
// under a millisecond. The win here is allocation and render count, not
// algorithmic complexity.

export const DEFAULT_RESULT_LIMIT = 120;

function norm(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Rank a product against a normalised query. Higher is better; 0 means no
 * match. The ordering is the one a cashier expects: the thing they typed
 * the code of, then the thing whose name starts with what they typed,
 * then anything containing it.
 */
function scoreProduct(product, query) {
  const name = norm(product.name);
  if (!query) return 1;

  const barcode = norm(product.barcode);
  const internalCode = norm(product.internalCode);

  if (barcode && barcode === query) return 100;
  if (internalCode && internalCode === query) return 90;
  if (name === query) return 80;
  if (name.startsWith(query)) return 60;
  if (barcode && barcode.includes(query)) return 45;
  if (internalCode && internalCode.includes(query)) return 44;
  if (name.includes(query)) return 40;
  if (norm(product.category).includes(query)) return 20;
  return 0;
}

/**
 * Filter and rank a catalogue for the counter.
 *
 * Returns `{ results, total, truncated }` — `results` is what to render,
 * `total` is how many actually matched, and `truncated` says the two
 * differ, so the UI can tell the user to keep typing rather than silently
 * hiding stock from them.
 */
export function searchCatalogue(products, {
  query = '',
  category = null,
  limit = DEFAULT_RESULT_LIMIT,
  includeOutOfStock = true,
} = {}) {
  const q = norm(query);
  const cat = category ? norm(category) : null;
  const list = Array.isArray(products) ? products : [];

  const matched = [];
  for (const product of list) {
    if (!product) continue;
    if (cat && norm(product.category) !== cat) continue;
    if (!includeOutOfStock && !(Number(product.stock) > 0)) continue;
    const score = scoreProduct(product, q);
    if (score === 0) continue;
    matched.push({ product, score });
  }

  // With no query the catalogue keeps whatever order the query returned
  // it in — which is alphabetical, and is what the grid has always shown.
  // Sorting only happens when there is something to rank by.
  if (q) {
    matched.sort((a, b) => (b.score - a.score) || norm(a.product.name).localeCompare(norm(b.product.name)));
  }

  const total = matched.length;
  const capped = limit > 0 && total > limit;
  return {
    results: (capped ? matched.slice(0, limit) : matched).map((m) => m.product),
    total,
    truncated: capped,
  };
}

/**
 * The categories actually present in a catalogue, in the order the
 * business listed them, with anything unlisted appended. Only categories
 * that have at least one product are offered — an empty filter chip is a
 * dead control.
 */
export function activeCategories(products, configuredCategories = []) {
  const counts = new Map();
  for (const product of products || []) {
    const category = String(product?.category ?? '').trim();
    if (!category) continue;
    counts.set(category, (counts.get(category) || 0) + 1);
  }

  const ordered = [];
  const seen = new Set();
  for (const category of configuredCategories || []) {
    const key = String(category).trim();
    if (counts.has(key) && !seen.has(key)) {
      ordered.push({ name: key, count: counts.get(key) });
      seen.add(key);
    }
  }
  for (const [name, count] of counts) {
    if (!seen.has(name)) ordered.push({ name, count });
  }
  return ordered;
}
