// src/components/pos/OrderBar.jsx
//
// The strip that turns the retail counter into a food counter: which
// table, eat in or take away, and the open tickets waiting to be picked
// back up.
//
// It appears only when the `orders` capability is on, and each of its
// three parts appears only when ITS capability is on — so a fast-food
// counter with tables off sees a dining-mode switch and a ticket list and
// no table grid, and a general shop never sees any of it. That is the
// progressive disclosure the brief asks for, expressed as three
// independent conditions rather than one profile check.

import { Utensils, Clock } from 'lucide-react';
import Money from '../ui/Money';
import SegmentedControl from '../ui/SegmentedControl';
import StatusPill from '../ui/StatusPill';
import { DINING_MODES, KITCHEN_LABELS, tableStates, summarizeOpenOrders } from '../../utils/orders';
import { useIndustry } from '../../hooks/useIndustry';

const KITCHEN_TONE = { new: 'caution', preparing: 'info', ready: 'positive', served: 'neutral' };

export default function OrderBar({
  openOrders = [],
  tables = [],
  activeOrderId,
  tableName,
  diningMode,
  showTables = false,
  showDiningModes = false,
  showKitchen = false,
  onPickTable,
  onDiningModeChange,
  onOpenOrder,
  busy = false,
}) {
  // The word for an open ticket comes from the business's own vocabulary
  // — "order" everywhere, "tab" in a bar. It is only the word: the
  // document, the collection and the capability are identical.
  const terms = useIndustry().terms;
  const summary = summarizeOpenOrders(openOrders);
  const states = showTables ? tableStates(tables, openOrders) : [];
  // With tables on, a ticket that has a table already appears in the
  // table grid — listing it twice is noise, so the strip below shows only
  // the ones that do not.
  const looseTickets = openOrders.filter((order) => !showTables || !order.tableName);

  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-section-title text-ink-900">
          <Utensils className="h-4 w-4 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
          {summary.count === 0
            ? `No open ${terms.orderPlural}`
            : `${summary.count} open ${summary.count === 1 ? terms.order : terms.orderPlural}`}
          {summary.count > 0 && (
            <span className="text-body font-semibold text-ink-600"><Money value={summary.total} /></span>
          )}
        </span>

        {showDiningModes && (
          <SegmentedControl
            ariaLabel="Dining mode"
            value={diningMode}
            onChange={onDiningModeChange}
            options={DINING_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
          />
        )}
      </div>

      {showTables && states.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
          {states.map((table) => {
            const isActive = table.order?.id === activeOrderId && activeOrderId !== null;
            const isSelected = !table.occupied && tableName === table.name;
            return (
              <button
                key={table.name}
                type="button"
                disabled={busy}
                onClick={() => (table.occupied ? onOpenOrder(table.order) : onPickTable(table.name))}
                aria-pressed={isActive || isSelected}
                className={`flex flex-col items-start gap-0.5 rounded-control border px-2 py-1.5 text-left transition-colors ${
                  isActive
                    ? 'border-primary-600 bg-primary-50'
                    : table.occupied
                      ? 'border-warning-200 bg-warning-50'
                      : isSelected
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-line bg-surface hover:bg-ink-50'
                }`}
              >
                <span className="truncate text-secondary font-medium text-ink-900">{table.name}</span>
                <span className="num text-label text-ink-500">
                  {table.occupied ? <Money value={table.total} /> : 'Free'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {looseTickets.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {looseTickets.map((order) => (
            <button
              key={order.id}
              type="button"
              disabled={busy}
              onClick={() => onOpenOrder(order)}
              aria-pressed={order.id === activeOrderId}
              className={`flex shrink-0 items-center gap-2 rounded-pill border px-3 py-1.5 transition-colors ${
                order.id === activeOrderId
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-line bg-surface text-ink-700 hover:bg-ink-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-button">{order.name}</span>
              <span className="num text-secondary font-semibold"><Money value={order.totalAmount} /></span>
              {showKitchen && order.kitchenStatus && order.kitchenStatus !== 'new' && (
                <StatusPill tone={KITCHEN_TONE[order.kitchenStatus] || 'neutral'}>
                  {KITCHEN_LABELS[order.kitchenStatus]}
                </StatusPill>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
