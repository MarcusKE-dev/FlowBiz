import { Pencil, Package } from 'lucide-react';
import { amountOnly, CURRENCY } from '../ui/format';

// `cartQuantities` is an optional map of productId -> quantity currently
// in the Counter page's cart. When a product is in the cart, its tile
// gets a primary-blue border and a quantity badge — persistent visual
// confirmation that a tap or scan actually registered, instead of
// relying on a toast that disappears. Pages that don't pass this prop
// (Products.jsx) render exactly as before.
//
// Tile content is intentionally minimal — image, name, price, nothing
// else: this is a fast scan-and-tap surface, not a product detail view.
// Every tile is the same height and the price always sits on the same
// baseline, so the eye can run across a row without re-finding it.
// `p.imageUrl` is read defensively so a thumbnail appears the moment
// product images exist; until then the tile shows a neutral placeholder.
export default function ProductGrid({ products, onSelect, isAdmin = false, onEdit, cartQuantities = {} }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {products.map((p) => {
        const out = p.stock <= 0;
        const inCartQty = cartQuantities[p.id] || 0;
        const inCart = inCartQty > 0;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col overflow-hidden rounded-control border bg-surface transition-colors ${
              out ? 'border-line opacity-60'
              : inCart ? 'border-primary-600'
              : 'border-line hover:border-ink-300'
            }`}
          >
            {inCart && (
              <span className="num absolute right-1 top-1 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary-600 px-1 text-[11px] font-semibold text-white">
                {inCartQty}
              </span>
            )}
            <button
              disabled={out}
              onClick={() => onSelect(p)}
              className="flex w-full flex-1 flex-col items-stretch text-left disabled:pointer-events-none"
            >
              <span className="flex h-16 w-full items-center justify-center overflow-hidden bg-ink-50 text-ink-400">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                )}
              </span>
              <span className="flex flex-1 flex-col justify-between gap-1 px-2 py-1.5">
                {/* Two lines reserved either way, so the price below it
                    lands on the same baseline across the whole row. */}
                <span className="line-clamp-2 min-h-[32px] text-secondary font-medium leading-4 text-ink-800">
                  {p.name}
                </span>
                {out ? (
                  <span className="text-secondary font-semibold text-danger-700">Out of stock</span>
                ) : (
                  <span className="num text-cell font-semibold text-ink-900">
                    <span className="text-[11px] font-medium text-ink-400">{CURRENCY}</span>{' '}
                    {amountOnly(p.sellingPrice)}
                  </span>
                )}
              </span>
            </button>
            {isAdmin && onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                className="absolute left-1 top-1 rounded-control bg-surface/90 p-1 text-ink-500 hover:text-ink-900"
                aria-label={`Edit ${p.name}`}
              >
                <Pencil className="h-3 w-3" strokeWidth={1.75} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
