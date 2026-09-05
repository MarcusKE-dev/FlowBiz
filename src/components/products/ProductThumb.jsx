// src/components/products/ProductThumb.jsx
//
// The square product thumbnail. Used by the Products table rows and the
// POS tiles, so both surfaces resolve a photo the same way and neither
// has to know whether it came from the public folder or Firestore.
//
// `onError` matters for the seeded demo products: they point at
// /product-photos/*.webp, and any file that hasn't been dropped in yet
// falls back to the icon instead of showing a broken-image glyph. The
// failure is remembered against the URL that failed, so a later, working
// photo on the same row still renders.

import { useState } from 'react';
import { Package } from 'lucide-react';
import useProductImage from '../../hooks/useProductImage';

export default function ProductThumb({
  product,
  size = 'h-9 w-9',
  rounded = 'rounded-control',
  bordered = true,
  iconSize = 'h-4 w-4',
}) {
  const { src } = useProductImage(product);
  const [failedSrc, setFailedSrc] = useState(null);

  const show = src && failedSrc !== src;

  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden ${rounded} ${bordered ? 'border border-line' : ''} bg-ink-50 text-ink-400`}
    >
      {show ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Package className={iconSize} strokeWidth={1.75} aria-hidden="true" />
      )}
    </span>
  );
}
