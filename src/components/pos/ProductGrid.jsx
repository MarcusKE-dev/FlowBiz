import { formatKES } from '../../utils/currency';
import { Pencil } from 'lucide-react';
export default function ProductGrid({ products, onSelect, isAdmin=false, onEdit }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map(p => {
        const out = p.stock <= 0;
        const low = !out && p.stock <= (p.lowStockThreshold ?? 5);
        return (
          <div key={p.id} className={`relative flex flex-col rounded-xl border bg-white p-3 transition-shadow ${out ? 'opacity-50 border-ink-100' : low ? 'border-rust-200 shadow-sm' : 'border-ink-100 shadow-sm hover:shadow-md'}`}>
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
