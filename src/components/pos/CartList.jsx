import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, X, ShoppingBag } from 'lucide-react';
import Money from '../ui/Money';
import { sumLineTotals, buildLineItem, minimumQuantity } from '../../utils/lineItems';
import { DEFAULT_UNIT, getUnit, unitStep, roundQuantity } from '../../industry/units';

// The mobile cart bar, pinned to the top of the Counter.
// Defaults to compressed view while adding products to maximize catalog
// screen space. Expands downwards on user interaction for itemized editing.
export default function CartList({
  cart, onUpdateQuantity, onUpdatePrice, onRemove, onClear, onCheckout,
  // Food only. Absent for every other profile, so the bar keeps exactly
  // the one button it has always had.
  onSaveOrder = null, saveOrderLabel = 'Save order', savingOrder = false,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!cart || cart.length === 0) return null;

  // The same builder the sale uses, so the bar the cashier reads and the
  // document Firestore stores can never disagree by a rounding step.
  const total = sumLineTotals(cart.map(buildLineItem));

  // Build a concise item summary preview (e.g. "2× Milk, 1× Bread") for compressed view
  const productPreview = cart
    .map((item) => {
      const qty = Number(item.quantity) || 1;
      return `${qty > 1 ? `${qty}× ` : ''}${item.productName}`;
    })
    .join(', ');

  return (
    <div className="rounded-panel border border-line bg-surface p-2.5 shadow-pop sm:p-3.5 transition-all">
      {/* Compressed Bar / Header toggle row */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left rounded-control p-1 -ml-1 hover:bg-ink-50/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 touch-manipulation min-h-[44px]"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse cart details' : 'Expand cart details'}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <ShoppingBag className="h-4 w-4" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-button font-semibold text-ink-900">
                Cart · {cart.length} product{cart.length !== 1 ? 's' : ''}
              </span>
            </div>
            {!expanded && (
              <p className="truncate text-caption text-ink-500 max-w-[170px] xs:max-w-[210px] sm:max-w-md">
                {productPreview}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center text-ink-500 hover:text-ink-900">
            {expanded
              ? <ChevronUp className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              : <ChevronDown className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />}
          </div>
        </button>

        {/* Quick action buttons right on the compressed bar */}
        {!expanded && (
          <div className="flex shrink-0 items-center gap-1.5 pl-1">
            {onSaveOrder && (
              <button
                type="button"
                className="btn-secondary !py-2 !px-2.5 text-button shrink-0 min-h-[44px] touch-manipulation"
                onClick={onSaveOrder}
                disabled={savingOrder}
              >
                {savingOrder ? 'Saving…' : saveOrderLabel}
              </button>
            )}
            <button
              type="button"
              className="btn-primary !py-2 !px-3 text-button font-semibold shrink-0 min-h-[44px] touch-manipulation shadow-sm"
              onClick={onCheckout}
            >
              Sell <Money value={total} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded item details view */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-divider space-y-3">
          <div className="max-h-[220px] divide-y divide-divider overflow-y-auto pr-1">
            {cart.map((item) => {
              const unit = item.unit || DEFAULT_UNIT;
              const step = unitStep(unit);
              const short = getUnit(unit).short;
              const isMeasured = unit !== DEFAULT_UNIT;
              const lineTotal = buildLineItem(item).lineTotal;
              // A cart row is addressed by its rowKey — the product id for
              // a plain product, product+version for one with versions.
              const key = item.rowKey || item.productId;
              return (
                <div key={key} className="space-y-2 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body font-medium leading-snug text-ink-900">{item.productName}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(key)}
                      className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-500 hover:bg-danger-50 hover:text-danger-700 touch-manipulation"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(key, roundQuantity((Number(item.quantity) || minimumQuantity(unit)) - 1, unit))}
                        className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink-700 hover:bg-ink-50 touch-manipulation"
                        aria-label={`Decrease quantity of ${item.productName}`}
                      >
                        <Minus className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      {/* A measured unit gets a wider field and its own
                          step, so 2.5 m can be typed rather than fought
                          with. A piece behaves exactly as it always did. */}
                      <input
                        type="number"
                        min={step}
                        step={step}
                        inputMode={isMeasured ? 'decimal' : 'numeric'}
                        className={`input num text-center h-11 ${isMeasured ? '!w-24' : '!w-16'}`}
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(key, e.target.value)}
                        aria-label={`Quantity of ${item.productName}${isMeasured ? ` in ${short}` : ''}`}
                      />
                      {isMeasured && <span className="text-label uppercase text-ink-400">{short}</span>}
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(key, roundQuantity((Number(item.quantity) || 0) + 1, unit))}
                        className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink-700 hover:bg-ink-50 touch-manipulation"
                        aria-label={`Increase quantity of ${item.productName}`}
                      >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-label uppercase text-ink-400">KES</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input num !w-24 text-right h-11"
                        value={item.unitPrice}
                        onChange={(e) => onUpdatePrice(key, e.target.value)}
                        aria-label={`Price per ${isMeasured ? short : 'item'} for ${item.productName}`}
                      />
                      {isMeasured && <span className="text-label uppercase text-ink-400">/{short}</span>}
                    </div>

                    <span className="ml-auto text-body font-semibold text-ink-900">
                      <Money value={lineTotal} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-divider">
            <button
              type="button"
              onClick={onClear}
              className="btn-ghost !px-2 text-ink-600 hover:text-danger-700 min-h-[44px] touch-manipulation"
            >
              Clear cart
            </button>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="btn-ghost !px-2 text-ink-600 hover:text-ink-900 flex items-center gap-1 min-h-[44px] touch-manipulation text-button font-medium"
            >
              <ChevronUp className="h-4 w-4" /> Collapse cart
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            {onSaveOrder && (
              <button
                type="button"
                className="btn-secondary shrink-0 min-h-[44px] touch-manipulation"
                onClick={onSaveOrder}
                disabled={savingOrder}
              >
                {savingOrder ? 'Saving…' : saveOrderLabel}
              </button>
            )}
            <button type="button" className="btn-primary flex-1 min-h-[44px] touch-manipulation" onClick={onCheckout}>
              Sell <Money value={total} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

