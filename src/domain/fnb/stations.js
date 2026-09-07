// src/domain/fnb/stations.js
//
// KITCHEN STATIONS AND ROUTING — which screen a fired line appears on.
//
// The research is unambiguous and every serious platform does the same
// thing: routing is PER ITEM, not per ticket. A table's steak goes to the
// grill, its salad to the cold section and its drinks to the bar, and
// each of those screens shows only what that section has to make. Sending
// the whole ticket to every screen is what a printer did in 1995, and it
// makes a cook read six lines to find the one that is theirs.
//
// FlowBiz's kitchen was one status on the whole order, which cannot
// express any of that. This is the smallest model that can:
//
//   a business has a short list of stations   (settings, like tables)
//   a product names the station it is made at (one optional field)
//   a line SNAPSHOTS the station when it is rung
//
// The snapshot is the part that is easy to get wrong. If a line looked up
// its station through its product at render time, then moving "Chips"
// from the fryer to the grill would move every chip order that is
// currently cooking to a different screen mid-service. A line records
// where it was sent, and stays there.
//
// A LINE WITH NO STATION IS NOT AN ERROR. It goes to the default screen —
// the one an expeditor watches — because the alternative is an item that
// silently reaches no kitchen at all. Every unrouted item is visible
// somewhere by construction.

export const MAX_STATIONS = 12;
export const MAX_STATION_NAME = 24;

/**
 * The station every unrouted line lands on. Not a stored station, and it
 * cannot be renamed or deleted: it is the floor under the routing table,
 * and something has to be there or items fall through it.
 */
export const DEFAULT_STATION = Object.freeze({ id: '', name: 'Kitchen' });

function slug(value, fallback) {
  const cleaned = String(value ?? '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned || fallback;
}

/**
 * Clean a stored station list. Same discipline as table names: bounded on
 * every axis, deduplicated, and anything unusable dropped rather than
 * stored, because this document is read and rendered by every device in
 * the business.
 */
export function normalizeStations(raw) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_STATIONS) break;
    const name = String(entry?.name ?? entry ?? '').trim().slice(0, MAX_STATION_NAME);
    if (!name) continue;
    let id = slug(entry?.id || name, `s${out.length + 1}`);
    while (seen.has(id)) id = `${id}-${out.length + 1}`;
    seen.add(id);
    out.push({ id, name });
  }
  return out;
}

/** The list a KDS or a routing picker offers: the real stations, plus the floor. */
export function stationOptions(stations) {
  return [...normalizeStations(stations), DEFAULT_STATION];
}

/**
 * Where a product is made. Absent, unknown or stale resolves to the
 * default station rather than to nothing, so a product pointing at a
 * station the owner has since deleted keeps reaching a screen.
 */
export function stationForProduct(product, stations) {
  const id = product?.station;
  if (!id) return DEFAULT_STATION.id;
  return normalizeStations(stations).some((s) => s.id === id) ? id : DEFAULT_STATION.id;
}

export function stationName(stationId, stations) {
  if (!stationId) return DEFAULT_STATION.name;
  return normalizeStations(stations).find((s) => s.id === stationId)?.name || DEFAULT_STATION.name;
}

/**
 * The lines one station is responsible for.
 *
 * `stationId` of `null` means the EXPEDITOR view: everything, from every
 * station, which is the pass. Passing the default station's id ('')
 * instead means only the unrouted lines, which is a different question
 * and a real one.
 */
export function linesForStation(lines, stationId) {
  // A line that does not go to a kitchen at all belongs on NO station
  // screen, the expeditor's pass included. It was ordered and it will be
  // served; it is simply not work. Filtering it here rather than at each
  // call site means one answer for every screen that asks.
  const kitchenWork = (lines || []).filter((line) => line?.routed !== false);
  if (stationId === null || stationId === undefined) return kitchenWork;
  return kitchenWork.filter((line) => (line?.station || DEFAULT_STATION.id) === stationId);
}

/**
 * A product that is not made in a kitchen at all should never reach a
 * kitchen screen. A bottle of beer taken from the fridge, a packet of
 * crisps, a service — firing them would fill a screen with items nobody
 * has to cook, and a screen full of noise is a screen the kitchen stops
 * reading.
 *
 * `routable: false` on the product is the owner's explicit "this does not
 * go to the kitchen". Absent means it does, which is the safe direction:
 * a new product reaches a screen until somebody says otherwise.
 */
export function isRoutable(product) {
  if (!product) return false;
  if (product.kind === 'service') return false;
  return product.routable !== false;
}

// ── Courses ──────────────────────────────────────────────────────────
//
// A course is the same SHAPE as a station — a short id and a short name —
// and deliberately not the same function. A station is WHERE something is
// made; a course is WHEN it is served. Sharing the normaliser would tie
// the two limits together for no reason and read as though they were one
// concept, so a course has its own, with its own ceiling, and the ceiling
// matches the one firestore.rules enforces.
//
// Eight is more courses than any business FlowBiz serves runs, and the
// bound exists because this list rides on the document every device reads.

export const MAX_COURSES = 8;

export function normalizeCourses(raw) {
  return normalizeStations(raw).slice(0, MAX_COURSES);
}
