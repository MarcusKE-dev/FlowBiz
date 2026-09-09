// src/components/customize/FloorPlanEditor.jsx
//
// ARRANGING THE ROOM — where the tables are, which part of the room each
// one is in, and how many it seats.
//
// WHY TAP-TO-PLACE AND NOT DRAG-AND-DROP. The device this is used on is
// as likely to be a phone as a laptop, and HTML drag-and-drop does not
// work with touch without a library and a lot of care. Select a table,
// tap a square: two taps, works identically with a finger and a mouse,
// no dependency, and it is undoable by tapping somewhere else. A drag
// canvas would be nicer on a desktop and unusable on the device an owner
// actually has in their hand.
//
// THE PLAN IS ARRANGEMENT ONLY. It cannot say a table is occupied,
// reserved, or dirty, because none of those are stored anywhere — a
// table is taken precisely while an open ticket carries its name. See
// the header of domain/fnb/floor.js.
//
// THE TABLE LIST IS STILL THE SOURCE OF TRUTH. This editor arranges the
// names that already exist above it; it cannot add or remove a table.
// That keeps one answer to "which tables does this business have" and
// means an owner who never opens this editor loses nothing.

import { useMemo, useState } from 'react';
import { MapPin, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  FLOOR_COLUMNS, FLOOR_ROWS, MAX_SEATS, MAX_ZONE_NAME,
  normalizeFloorPlan, readFloor,
} from '../../domain/fnb/floor';

export default function FloorPlanEditor({ tableNames = [], plan, onChange, disabled = false }) {
  const [selected, setSelected] = useState(null);

  // The plan reconciled against the table list, so a table added since
  // the plan was last saved already has a cell and can be moved, rather
  // than being invisible until somebody re-saves.
  const floor = useMemo(
    () => readFloor({ tableNames, plan }),
    [tableNames, plan]
  );

  const byCell = useMemo(() => {
    const map = new Map();
    for (const table of floor.tables) map.set(`${table.x},${table.y}`, table);
    return map;
  }, [floor.tables]);

  const selectedTable = floor.tables.find((t) => t.name === selected) || null;

  /** Write the whole arrangement back, with one table changed. */
  const patch = (name, changes) => {
    if (disabled) return;
    const next = floor.tables.map((table) => {
      const base = {
        name: table.name,
        x: table.x,
        y: table.y,
        ...(table.zone ? { zone: table.zone } : {}),
        ...(table.seats ? { seats: table.seats } : {}),
        ...(table.image ? { image: table.image } : {}),
      };
      return table.name === name ? { ...base, ...changes } : base;
    });
    onChange(normalizeFloorPlan(next));
  };

  const place = (x, y) => {
    if (!selectedTable || disabled) return;
    const occupant = byCell.get(`${x},${y}`);
    // Tapping a square that already holds a table SWAPS the two rather
    // than refusing. Refusing means an owner rearranging a full room has
    // to move a table out to an empty square first, remember which, and
    // move it back — every time.
    if (occupant && occupant.name !== selectedTable.name) {
      const next = floor.tables.map((table) => {
        const base = { name: table.name, x: table.x, y: table.y,
          ...(table.zone ? { zone: table.zone } : {}),
          ...(table.seats ? { seats: table.seats } : {}),
          ...(table.image ? { image: table.image } : {}) };
        if (table.name === selectedTable.name) return { ...base, x, y };
        if (table.name === occupant.name) return { ...base, x: selectedTable.x, y: selectedTable.y };
        return base;
      });
      onChange(normalizeFloorPlan(next));
      return;
    }
    patch(selectedTable.name, { x, y });
  };

  if (tableNames.length === 0) {
    return (
      <p className="rounded-panel border border-line bg-canvas px-3 py-2.5 text-secondary text-ink-500">
        Name your tables above, then arrange them here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-secondary text-ink-500">
        Tap a table, then tap a square to move it. Tapping a square that already has a table
        swaps the two.
      </p>

      {/* ── The tables ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {floor.tables.map((table) => (
          <button
            key={table.name}
            type="button"
            onClick={() => setSelected(selected === table.name ? null : table.name)}
            disabled={disabled}
            className={`rounded-pill border px-2.5 py-1 text-label transition-colors ${
              selected === table.name
                ? 'border-primary-600 bg-primary-50 text-primary-800'
                : 'border-line bg-surface text-ink-700 hover:border-ink-300'
            }`}
          >
            {table.name}
            {table.zone ? ` · ${table.zone}` : ''}
          </button>
        ))}
      </div>

      {/* ── The room ───────────────────────────────────────────────── */}
      <div
        className="grid gap-1 overflow-x-auto rounded-panel border border-line bg-canvas p-2"
        style={{ gridTemplateColumns: `repeat(${FLOOR_COLUMNS}, minmax(2.25rem, 1fr))` }}
        role="grid"
        aria-label="Floor plan"
      >
        {Array.from({ length: FLOOR_ROWS * FLOOR_COLUMNS }, (_, index) => {
          const x = index % FLOOR_COLUMNS;
          const y = Math.floor(index / FLOOR_COLUMNS);
          const table = byCell.get(`${x},${y}`) || null;
          const isSelected = table && table.name === selected;
          return (
            <button
              key={index}
              type="button"
              onClick={() => (table && !selectedTable ? setSelected(table.name) : place(x, y))}
              disabled={disabled || (!table && !selectedTable)}
              aria-label={table ? `${table.name} at column ${x + 1}, row ${y + 1}` : `Empty square, column ${x + 1}, row ${y + 1}`}
              className={`flex aspect-square items-center justify-center overflow-hidden rounded-control border p-0.5 text-center text-label leading-tight transition-colors ${
                isSelected
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : table
                    ? 'border-line bg-surface text-ink-700 hover:border-ink-300'
                    : selectedTable
                      ? 'border-dashed border-ink-300 bg-transparent hover:border-primary-600 hover:bg-primary-50'
                      : 'border-dashed border-line bg-transparent'
              }`}
            >
              <span className="line-clamp-2 break-all">{table ? table.name : ''}</span>
            </button>
          );
        })}
      </div>

      {/* ── The selected table ─────────────────────────────────────── */}
      {selectedTable && (
        <div className="space-y-2.5 rounded-panel border border-line bg-surface p-3">
          <p className="flex items-center gap-1.5 text-section-title text-ink-900">
            <MapPin className="h-4 w-4 text-ink-500" strokeWidth={1.75} aria-hidden="true" />
            {selectedTable.name}
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="floor-zone">
                Part of the room <span className="text-ink-300 font-normal normal-case">(optional)</span>
              </label>
              <input
                id="floor-zone"
                className="input"
                value={selectedTable.zone || ''}
                maxLength={MAX_ZONE_NAME}
                placeholder="Terrace, Upstairs, Garden"
                disabled={disabled}
                onChange={(e) => patch(selectedTable.name, { zone: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="floor-seats">
                Seats <span className="text-ink-300 font-normal normal-case">(optional)</span>
              </label>
              <input
                id="floor-seats"
                type="number"
                min="1"
                max={MAX_SEATS}
                className="input num"
                value={selectedTable.seats || ''}
                disabled={disabled}
                onChange={(e) => patch(selectedTable.name, { seats: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="floor-image">
              Picture <span className="text-ink-300 font-normal normal-case">(optional)</span>
            </label>
            <input
              id="floor-image"
              className="input"
              value={selectedTable.image || ''}
              placeholder="https://…"
              disabled={disabled}
              onChange={(e) => patch(selectedTable.name, { image: e.target.value })}
            />
            <p className="mt-1 flex items-start gap-1.5 text-secondary text-ink-400">
              <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              A link to a photo of this table, shown faintly behind it on the customer display.
              It must start with <span className="num">https://</span>.
            </p>
          </div>

          <div className="flex justify-end border-t border-divider pt-2.5">
            <button
              type="button"
              className="btn-ghost !px-2 text-ink-600"
              disabled={disabled}
              onClick={() => {
                patch(selectedTable.name, { zone: '', seats: 0, image: '' });
                setSelected(null);
              }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Clear this table&rsquo;s details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
