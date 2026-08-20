// src/components/pos/CartList.jsx
//
// Renders the Counter page's current (client-side only, nothing written
// to Firestore until checkout) multi-product cart: one line per distinct
// product, with quantity +/- controls, an editable unit price (bargaining
// support — never changes the product's stored default price), a remove
// button per line, and the running total.
//
// FIX (cart visibility): this card is rendered pinned to the top of the
// page (see Counter.jsx) instead of below a potentially long product
// list, so it's never "far down" after adding something. The header row
// — product count, total, and the Sell button — is ALWAYS visible even
// when collapsed; only the per-line editor collapses, so the cart stays
// compact while browsing but a sale can still be completed with zero
// scrolling either way.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react';
import { formatKES, roundMoney } from '../../utils/currency';

export default function CartList({ cart, onUpdateQuantity, onUpdatePrice, onRemove, onClear, onCheckout }) {
  const [expanded, setExpanded] = useState(true);
  if (!cart || cart.length === 0) return null;

  const total = roundMoney(cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0));

  return (
    <div className="card border-moss-200 shadow-md p-3 sm:p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left min-h-[36px]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display text-sm font-bold text-ink-800 shrink-0">
            Cart · {cart.length} product{cart.length !== 1 ? 's' : ''}
          </h2>
          <span className="font-display text-sm font-bold text-moss-700 shrink-0">{formatKES(total)}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-400 shrink-0" strokeWidth={2} /> : <ChevronDown className="h-4 w-4 text-ink-400 shrink-0" strokeWidth={2} />}
      </button>

      {expanded && (
        <div className="divide-y divide-ink-100 -mt-1">
          {cart.map((item) => {
            const lineTotal = roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
            return (
              <div key={item.productId} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink-800 text-sm leading-snug">{item.productName}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.productId)}
                    className="shrink-0 rounded-lg p-1.5 text-ink-300 hover:bg-rust-50 hover:text-rust-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                    aria-label={`Remove ${item.productName}`}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, (Number(item.quantity) || 1) - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="input !w-16 !py-2 !min-h-0 text-center"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.productId, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, (Number(item.quantity) || 0) + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-400">@ KES</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input !w-24 !py-2 !min-h-0 text-right"
                      value={item.unitPrice}
                      onChange={(e) => onUpdatePrice(item.productId, e.target.value)}
                    />
                  </div>

                  <span className="ml-auto font-display text-sm font-bold text-ink-800">{formatKES(lineTotal)}</span>
                </div>
              </div>
            );
          })}
          <div className="pt-2 text-right">
            <button type="button" onClick={onClear} className="text-xs font-semibold text-rust-500 hover:underline">
              Clear cart
            </button>
          </div>
        </div>
      )}

      <button type="button" className="btn-primary w-full" onClick={onCheckout}>
        Sell — {formatKES(total)}
      </button>
    </div>
  );
}
