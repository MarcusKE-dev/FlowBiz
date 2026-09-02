// src/components/products/ProductThumb.jsx
//
// The square product thumbnail used in the Products table rows. Reads
// `imageUrl` defensively, exactly as ProductGrid does, and falls back to
// a neutral package icon when a product has no image.

import { Package } from 'lucide-react';

export default function ProductThumb({ product, size = 'h-9 w-9' }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-ink-50 text-ink-400`}
    >
      {product?.imageUrl ? (
        <img src={product.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Package className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  );
}
