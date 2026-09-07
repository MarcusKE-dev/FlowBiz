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
//
// `placeholder={false}` renders NOTHING at all when there is no photo,
// rather than the icon in its box. That is what the POS grid passes for
// a business with no photo entitlement: a Starter shop's products can
// never have a photo, so a column of empty grey squares down the counter
// is not a placeholder for anything — it is wasted space where the name
// and price should be. A photo the business already owns still shows,
// and so does the box while one is being fetched, so nothing that has an
// image ever shifts the layout as it loads.

import { useState } from 'react';
import { Package } from 'lucide-react';
import useProductImage from '../../hooks/useProductImage';

export default function ProductThumb({
  product,
  size = 'h-9 w-9',
  rounded = 'rounded-control',
  bordered = true,
  iconSize = 'h-4 w-4',
  placeholder = true,
}) {
  const { src, loading } = useProductImage(product);
  const [failedSrc, setFailedSrc] = useState(null);

  const show = src && failedSrc !== src;

  if (!show && !loading && !placeholder) return null;

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
