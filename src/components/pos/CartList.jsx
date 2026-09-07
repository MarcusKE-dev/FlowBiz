import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react';
import Money from '../ui/Money';
import { sumLineTotals, buildLineItem, minimumQuantity } from '../../utils/lineItems';
import { DEFAULT_UNIT, getUnit, unitStep, roundQuantity } from '../../industry/units';

// The mobile cart bar, pinned to the top of the Counter. This is the
// most touch-critical surface in the app, so every control here is a
// full 44px target — no control-height overrides, which is what had
// quietly dropped the quantity and price fields to 38px and the remove
// button to 36px. As of pass 3 no such override survives anywhere in
// src/, so this is now the rule rather than this file's exception.
export default function CartList({
  cart, onUpdateQuantity, onUpdatePrice, onRemove, onClear, onCheckout,
  // Food only. Absent for every other profile, so the bar keeps exactly
  // the one button it has always had.
  onSaveOrder = null, saveOrderLabel = 'Save order', savingOrder = false,
}) {
  const [expanded, setExpanded] = useState(true);
  if (!cart || cart.length === 0) return null;

  // The same builder the sale uses, so the bar the cashier reads and the
  // document Firestore stores can never disagree by a rounding step.
  const total = sumLineTotals(cart.map(buildLineItem));

  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-3 shadow-pop sm:p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-section-title text-ink-900">
            Cart · {cart.length} product{cart.length !== 1 ? 's' : ''}
          </span>
          <span className="shrink-0 text-body font-semibold text-ink-900">
            <Money value={total} />
          </span>
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.75} aria-hidden="true" />}
      </button>

      {expanded && (
        <div>
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
                <div key={key} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body font-medium leading-snug text-ink-900">{item.productName}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(key)}
                      className="-mr-1 flex shrink-0 items-center justify-center rounded-control p-2 text-ink-500 hover:bg-danger-50 hover:text-danger-700"
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
                        className="flex items-center justify-center rounded-control border border-line text-ink-700 hover:bg-ink-50"
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
                        className={`input num text-center ${isMeasured ? '!w-24' : '!w-16'}`}
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(key, e.target.value)}
                        aria-label={`Quantity of ${item.productName}${isMeasured ? ` in ${short}` : ''}`}
                      />
                      {isMeasured && <span className="text-label uppercase text-ink-400">{short}</span>}
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(key, roundQuantity((Number(item.quantity) || 0) + 1, unit))}
                        className="flex items-center justify-center rounded-control border border-line text-ink-700 hover:bg-ink-50"
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
                        className="input num !w-24 text-right"
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

          <div className="pt-2 text-right">
            <button
              type="button"
              onClick={onClear}
              className="btn-ghost !px-2 text-ink-600 hover:text-danger-700"
            >
              Clear cart
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {onSaveOrder && (
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={onSaveOrder}
            disabled={savingOrder}
          >
            {savingOrder ? 'Saving…' : saveOrderLabel}
          </button>
        )}
        <button type="button" className="btn-primary flex-1" onClick={onCheckout}>
          Sell <Money value={total} />
        </button>
      </div>
    </div>
  );
}
