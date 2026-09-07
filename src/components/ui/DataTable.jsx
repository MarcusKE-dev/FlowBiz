// src/components/ui/DataTable.jsx
//
// The workhorse. A table has a real boundary, so it gets one: 8px
// panel, hairline rows, sticky header, hover tint, numeric columns
// right-aligned with tabular figures.
//
// On mobile it does NOT become a grid of mini-cards. It becomes what a
// table actually is on a narrow screen: each record as a stack of
// label -> value rows, separated by hairlines, inside the same single
// panel. Same data, same order, same alignment — just folded.
//
// Columns:
//   key        unique id, and the row property read when no render()
//   header     column heading
//   render     (row, index) => node
//   numeric    right-aligns, applies tabular figures
//   align      'left' | 'right' | 'center' (numeric implies right)
//   width      any Tailwind width class for the desktop column
//   primary    on mobile, this column becomes the record's heading row
//              instead of a label -> value pair
//   hideOnMobile  omit from the mobile view entirely
//   mobileTrailing  in mobileLayout="row", render right-aligned on the
//              collapsed line. At most two, in column order.
//   srHeader   accessible name when `header` is intentionally blank
//
// mobileLayout:
//   'stack' (default)  every non-hidden column as a label -> value row.
//                      Honest, but a product costs 5 lines and a sale 6,
//                      so a 40-item catalogue becomes an enormous scroll.
//   'row'              one 48px line per record: optional leading thumb,
//                      the primary column truncating into the space left,
//                      then up to two `mobileTrailing` values. A chevron
//                      expands the rest inline, one row at a time.
//
// `leading` is (row) => node and only applies to mobileLayout="row".
//
// A note on stickyHeader: `position: sticky` only sticks against a
// scrolling ancestor, and this panel clips itself (overflow-hidden) to
// get its 8px corners. So a sticky header is only meaningful when the
// table scrolls inside its own box — pass `maxHeight` to make that
// happen. Without maxHeight the header is not sticky and the class is
// not applied, rather than applied and silently doing nothing.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

function cellAlign(col) {
  if (col.numeric || col.align === 'right') return 'text-right';
  if (col.align === 'center') return 'text-center';
  return 'text-left';
}

export default function DataTable({
  columns,
  rows,
  rowKey = (r, i) => r.id ?? i,
  onRowClick,
  rowActions,
  empty,
  caption,
  className = '',
  maxHeight,
  mobileLayout = 'stack',
  leading,
}) {
  // Only one record is expanded at a time — a phone screen cannot hold
  // two open records and still show the list around them.
  const [expandedKey, setExpandedKey] = useState(null);

  if (!rows?.length && empty) return empty;

  const clickable = typeof onRowClick === 'function';
  const rowLayout = mobileLayout === 'row';

  return (
    <div className={`overflow-hidden rounded-panel border border-line bg-surface ${className}`}>
      {/* ── Desktop ── */}
      <div
        className={`hidden overflow-x-auto sm:block ${maxHeight ? 'overflow-y-auto' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="w-full border-collapse text-cell">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className={`bg-surface ${maxHeight ? 'sticky top-0 z-10' : ''}`}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`border-b border-line px-3 py-2.5 text-label uppercase
                              text-ink-500 ${cellAlign(col)} ${col.width || ''}`}
                >
                  {col.header || <span className="sr-only">{col.srHeader || col.key}</span>}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="w-px border-b border-line px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={clickable ? () => onRowClick(row) : undefined}
                className={`border-b border-divider last:border-0 transition-colors
                            hover:bg-ink-50 ${clickable ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-3 align-middle text-ink-800 ${cellAlign(col)}
                                ${col.numeric ? 'num whitespace-nowrap' : ''}`}
                  >
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">{rowActions(row, i)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: the same table, folded ──
          maxHeight has to bind here too. Without it a capped desktop
          table still stacked every row on a phone, which turned a
          100-row sales log into a 23,000px page. */}
      <div
        className={`divide-y divide-line sm:hidden ${maxHeight ? 'overflow-y-auto' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {rowLayout && rows.map((row, i) => {
          const key = rowKey(row, i);
          const primary = columns.find((c) => c.primary);
          const trailing = columns.filter((c) => c.mobileTrailing && !c.hideOnMobile).slice(0, 2);
          const rest = columns.filter(
            (c) => !c.primary && !c.hideOnMobile && !c.mobileTrailing
          );
          const hasDetail = rest.length > 0 || !!rowActions;
          const isOpen = hasDetail && expandedKey === key;
          const toggle = () => setExpandedKey(isOpen ? null : key);

          return (
            <div key={key}>
              <div className="flex items-center gap-1 px-3">
                {/* When the row navigates, tapping it navigates and only
                    the chevron expands. Otherwise the whole line is the
                    toggle's tap target. */}
                <div
                  onClick={clickable ? () => onRowClick(row) : (hasDetail ? toggle : undefined)}
                  className={`flex min-h-12 min-w-0 flex-1 items-center gap-2.5 py-2
                              ${clickable || hasDetail ? 'cursor-pointer' : ''}`}
                >
                  {leading && <span className="shrink-0">{leading(row)}</span>}
                  {primary && (
                    <div className="min-w-0 flex-1 truncate text-body font-medium text-ink-900">
                      {primary.render ? primary.render(row, i) : row[primary.key]}
                    </div>
                  )}
                  {trailing.map((col) => (
                    <span
                      key={col.key}
                      className={`shrink-0 text-cell text-ink-800 ${col.numeric ? 'num' : ''}`}
                    >
                      {col.render ? col.render(row, i) : row[col.key]}
                    </span>
                  ))}
                </div>
                {hasDetail && (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Hide details' : 'Show details'}
                    className="-mr-2 flex min-h-touch min-w-touch shrink-0 items-center
                               justify-center text-ink-400 hover:text-ink-700"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      strokeWidth={1.75}
                    />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-divider bg-ink-50/40">
                  <dl className="divide-y divide-divider px-3">
                    {rest.map((col) => (
                      <div key={col.key} className="flex items-baseline justify-between gap-3 py-1.5">
                        <dt className="shrink-0 text-label uppercase text-ink-500">
                          {col.header || col.srHeader || col.key}
                        </dt>
                        <dd
                          className={`min-w-0 text-right text-cell text-ink-800
                                      ${col.numeric ? 'num' : ''}`}
                        >
                          {col.render ? col.render(row, i) : row[col.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {rowActions && (
                    <div className="flex items-center justify-end gap-1 px-3 py-2">
                      {rowActions(row, i)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!rowLayout && rows.map((row, i) => {
          const primary = columns.find((c) => c.primary);
          const rest = columns.filter((c) => !c.primary && !c.hideOnMobile);
          return (
            <div
              key={rowKey(row, i)}
              onClick={clickable ? () => onRowClick(row) : undefined}
              className={clickable ? 'cursor-pointer active:bg-ink-50' : ''}
            >
              {primary && (
                <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-3">
                  <div className="min-w-0 text-body font-semibold text-ink-900">
                    {primary.render ? primary.render(row, i) : row[primary.key]}
                  </div>
                  {rowActions && (
                    <div className="flex shrink-0 items-center gap-1">{rowActions(row, i)}</div>
                  )}
                </div>
              )}
              <dl className="divide-y divide-divider px-3 pb-2">
                {rest.map((col) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3 py-1.5">
                    <dt className="shrink-0 text-label uppercase text-ink-500">
                      {col.header || col.srHeader || col.key}
                    </dt>
                    <dd
                      className={`min-w-0 text-right text-cell text-ink-800
                                  ${col.numeric ? 'num' : ''}`}
                    >
                      {col.render ? col.render(row, i) : row[col.key]}
                    </dd>
                  </div>
                ))}
              </dl>
              {!primary && rowActions && (
                <div className="flex items-center justify-end gap-1 px-3 pb-3">
                  {rowActions(row, i)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
