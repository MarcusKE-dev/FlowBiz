import { formatKES } from '../../utils/currency';
import { Pencil, ShoppingCart } from 'lucide-react';

// FIX (cart visibility): `cartQuantities` is an optional map of
// productId -> quantity currently in the Counter page's cart. When a
// product is in the cart, its card gets a moss highlight and a small
// "N in cart" badge — persistent visual confirmation that a tap/scan
// actually registered, instead of relying on a toast that disappears.
// Pages that don't pass this prop (Products.jsx) render exactly as
// before.
export default function ProductGrid({ products, onSelect, isAdmin=false, onEdit, cartQuantities = {} }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map(p => {
        const out = p.stock <= 0;
        const low = !out && p.stock <= (p.lowStockThreshold ?? 5);
        const inCartQty = cartQuantities[p.id] || 0;
        const inCart = inCartQty > 0;
        return (
          <div
            key={p.id}
            className={`relative flex flex-col rounded-xl border bg-white p-3 transition-shadow ${
              out ? 'opacity-50 border-ink-100'
              : inCart ? 'border-moss-400 ring-1 ring-moss-300 shadow-sm'
              : low ? 'border-rust-200 shadow-sm'
              : 'border-ink-100 shadow-sm hover:shadow-md'
            }`}
          >
            {inCart && (
              <span className="absolute -top-2 -right-2 z-10 flex items-center gap-1 rounded-full bg-moss-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                <ShoppingCart className="h-3 w-3" strokeWidth={2} />{inCartQty}
              </span>
            )}
            <button disabled={out} onClick={()=>onSelect(p)} className="flex-1 flex flex-col items-start gap-1 text-left w-full disabled:pointer-events-none">
              <span className="badge bg-ink-100 text-ink-400 text-[10px] mb-0.5">{p.category}</span>
              <span className="font-semibold text-[13px] leading-tight text-ink-800 line-clamp-2">{p.name}</span>
              <span className="font-display text-sm font-bold text-moss-700">{formatKES(p.sellingPrice)}</span>
              <span className={`text-[11px] font-medium ${out ? 'text-rust-600' : low ? 'text-rust-500' : 'text-ink-400'}`}>
                {out ? 'Out of stock' : `${p.stock} left${low ? ' ⚠️' : ''}`}
              </span>
            </button>
            {isAdmin && onEdit && (
              <button onClick={e=>{e.stopPropagation();onEdit(p);}} className="absolute top-1 right-1 p-1 rounded text-ink-300 hover:bg-ink-50 hover:text-ink-600">
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
