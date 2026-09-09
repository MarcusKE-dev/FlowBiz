// src/domain/fnb/floor.js
//
// THE FLOOR PLAN — where the tables are, and what to call the parts of
// the room.
//
// WHY THIS IS NOT A TABLE COLLECTION, and not a status field anywhere.
//
// FlowBiz already knows which tables are taken, and it knows it without
// storing the answer: a table is occupied precisely while an open ticket
// carries its name (`readRoom` in ticket.js). That is derived, so it can
// never drift, and clearing a table is charging its ticket rather than
// remembering to press something afterwards. The failure mode of the
// alternative is a restaurant that cannot seat anybody on a Friday
// because six tables are stuck "occupied" from last Friday.
//
// So a floor plan holds ONLY what cannot be derived: the arrangement.
// A name, which zone of the room it is in, how many it seats, and where
// it sits on a grid. Everything a screen shows about the table's STATE
// still comes from the tickets.
//
// IT IS OPTIONAL, AND IT LAYERS OVER THE PLAIN TABLE LIST. `settings.tables`
// is a list of names and stays the source of truth for which tables
// exist — a business that never opens the floor plan editor keeps
// exactly the behaviour it has. The floor plan adds arrangement to the
// names it recognises, and `readFloor()` below reconciles the two so a
// table named but not placed still appears, and a placement whose table
// was deleted quietly disappears rather than rendering an orphan.
//
// WHY A GRID AND NOT FREE PIXELS. A drag-anywhere canvas needs a fixed
// aspect ratio to be meaningful, and the screens that render this are a
// waiter's phone held portrait, a tablet held landscape and a 55-inch
// television. A coarse grid re-flows on all three; absolute pixel
// coordinates look correct on exactly the device they were arranged on.

import { roundMoney } from '../../utils/currency.js';

/** The grid the room is arranged on. Coarse on purpose — see the header. */
export const FLOOR_COLUMNS = 12;
export const FLOOR_ROWS = 8;

/** Matches MAX_TABLES in utils/orders.js and the bound in firestore.rules. */
export const MAX_FLOOR_TABLES = 100;
export const MAX_ZONE_NAME = 24;
export const MAX_SEATS = 40;

/**
 * The zones a room is divided into. Free text, because "Terrace",
 * "Upstairs", "Garden" and "VIP" are all real and none of them is a
 * fixed list — but bounded and deduplicated, because this rides on the
 * settings document every device in the business reads.
 */
export const MAX_ZONES = 8;

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Clean a stored floor plan. Same discipline as `normalizeTableNames` and
 * `normalizeStations`: bounded on every axis, deduplicated by table name,
 * and anything unusable dropped rather than stored.
 *
 * An entry with no name is dropped — a placement that names no table
 * cannot be reconciled against the table list and would render as a box
 * with nothing in it.
 */
export function normalizeFloorPlan(raw) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (out.length >= MAX_FLOOR_TABLES) break;
    const name = cleanText(entry?.name, 40);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const table = {
      name,
      x: clampInt(entry?.x, 0, FLOOR_COLUMNS - 1, out.length % FLOOR_COLUMNS),
      y: clampInt(entry?.y, 0, FLOOR_ROWS - 1, Math.floor(out.length / FLOOR_COLUMNS) % FLOOR_ROWS),
    };
    const zone = cleanText(entry?.zone, MAX_ZONE_NAME);
    if (zone) table.zone = zone;
    // A seat count is optional, so "absent" and "zero" both have to mean
    // absent — clamping first would turn a table seating nobody into a
    // table seating one, which is a number the owner never typed.
    const rawSeats = Number(entry?.seats);
    if (Number.isFinite(rawSeats) && rawSeats >= 1) {
      table.seats = clampInt(rawSeats, 1, MAX_SEATS, 1);
    }
    // An optional picture of the table, as a plain URL. Deliberately not
    // an upload: product photos have a whole storage path, an entitlement
    // and a sidecar collection behind them, and a decorative image on a
    // customer display does not justify a second one. A business that
    // wants pictures points at ones it already hosts.
    const image = cleanText(entry?.image, 300);
    if (/^https:\/\//i.test(image)) table.image = image;
    out.push(table);
  }
  return out;
}

/** The zones actually in use, in the order they first appear. */
export function floorZones(plan) {
  const zones = [];
  for (const table of normalizeFloorPlan(plan)) {
    if (table.zone && !zones.includes(table.zone)) zones.push(table.zone);
    if (zones.length >= MAX_ZONES) break;
  }
  return zones;
}

/**
 * Lay out a default plan for a business that has table names and has
 * never arranged them. Row-major across the grid, which is the reading
 * order and therefore the order the names are already in.
 *
 * This is what makes the floor view work on the day it is switched on,
 * rather than presenting an empty room and asking the owner to place
 * twenty tables before they can see anything.
 */
export function defaultFloorPlan(tableNames) {
  return (tableNames || []).slice(0, MAX_FLOOR_TABLES).map((name, index) => ({
    name: String(name),
    x: index % FLOOR_COLUMNS,
    y: Math.floor(index / FLOOR_COLUMNS) % FLOOR_ROWS,
  }));
}

/**
 * THE ONE READ. The room's arrangement, reconciled against the table list
 * and against what the tickets say is happening on it.
 *
 * Three things are folded together here so that no screen has to do it
 * twice and get a different answer:
 *
 *   `tableNames`  which tables exist. The source of truth.
 *   `plan`        where they are. Optional, and only advisory.
 *   `room`        what is happening on them, from readRoom(). Derived.
 *
 * Reconciliation rules, and each one is a real case:
 *
 *   A table NAMED but not PLACED still appears — the owner added Table 21
 *   yesterday and has not opened the plan editor. It is given the next
 *   free grid cell rather than being invisible, because a table you
 *   cannot see is a table you cannot seat.
 *
 *   A table PLACED but no longer NAMED disappears — it was deleted from
 *   the table list, and leaving its box on the floor would offer a seat
 *   at a table that does not exist.
 */
export function readFloor({ tableNames = [], plan = null, room = null } = {}) {
  const names = (tableNames || []).map((n) => String(n)).filter(Boolean);
  const known = new Set(names.map((n) => n.toLowerCase()));
  const placed = new Map();
  for (const table of normalizeFloorPlan(plan)) {
    if (known.has(table.name.toLowerCase())) placed.set(table.name.toLowerCase(), table);
  }

  // Cells already spoken for, so an unplaced table lands somewhere empty
  // rather than on top of a placed one.
  const taken = new Set([...placed.values()].map((t) => `${t.x},${t.y}`));
  let cursor = 0;
  const nextFreeCell = () => {
    while (cursor < FLOOR_COLUMNS * FLOOR_ROWS) {
      const cell = { x: cursor % FLOOR_COLUMNS, y: Math.floor(cursor / FLOOR_COLUMNS) };
      cursor += 1;
      if (!taken.has(`${cell.x},${cell.y}`)) {
        taken.add(`${cell.x},${cell.y}`);
        return cell;
      }
    }
    return { x: 0, y: 0 };
  };

  const stateByName = new Map((room?.tables || []).map((t) => [t.name, t]));

  const tables = names.map((name) => {
    const arrangement = placed.get(name.toLowerCase()) || { name, ...nextFreeCell() };
    const state = stateByName.get(name) || null;
    return {
      name,
      x: arrangement.x,
      y: arrangement.y,
      zone: arrangement.zone || null,
      seats: arrangement.seats || null,
      image: arrangement.image || null,
      placed: placed.has(name.toLowerCase()),

      // Everything below is DERIVED FROM THE TICKETS and is never stored.
      occupied: state?.occupied === true,
      stage: state?.stage || null,
      total: roundMoney(state?.total || 0),
      needsRunning: state?.needsRunning === true,
      tickets: state?.tickets || [],
    };
  });

  return {
    tables,
    zones: floorZones(tables.filter((t) => t.zone)),
    occupied: tables.filter((t) => t.occupied).length,
    free: tables.filter((t) => !t.occupied).length,
    needsRunning: tables.filter((t) => t.needsRunning).length,
    untabled: room?.untabled || [],
  };
}

/**
 * The write for a floor plan. Absent-tolerant in both directions: an
 * empty plan clears the field rather than storing `[]`, so a business
 * that arranges a room and then changes its mind goes back to having no
 * floor plan at all rather than to having an empty one.
 */
export function floorPlanField(plan) {
  const clean = normalizeFloorPlan(plan);
  return { floorPlan: clean.length > 0 ? clean : null };
}
