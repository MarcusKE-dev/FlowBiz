// src/hooks/useProductImage.js
//
// Resolves a product's thumbnail to something an <img src> can take,
// from whichever of the three sources applies (see utils/productImages).
//
// The fetch is deferred to an idle callback so that mounting a 60-tile
// POS grid does not fire 60 Firestore reads inside the same frame as the
// render — the tiles paint with their placeholder first and fill in.
// Cached photos come back in the same tick anyway, so in practice there
// is no visible flash after the first load.

import { useEffect, useState } from 'react';
import { loadProductImage, staticImageUrl, needsSidecarFetch } from '../utils/productImages';

const idle = (fn) =>
  (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(fn, { timeout: 400 })
    : setTimeout(fn, 0));
const cancelIdle = (handle) =>
  (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(handle) : clearTimeout(handle));

/**
 * @param {object|null} product
 * @returns {{src: string|null, loading: boolean}}
 */
export default function useProductImage(product) {
  const direct = staticImageUrl(product);

  // One key identifies "which photo, which version". Held alongside the
  // result rather than reset in an effect, so a result that arrives after
  // the row has been recycled onto a different product is simply ignored
  // instead of flashing the wrong picture.
  const key = needsSidecarFetch(product)
    ? `${product.businessId || ''}__${product.id}@${product.imageUpdatedAt || 0}`
    : null;

  const [fetched, setFetched] = useState(null); // { key, url } | null

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const handle = idle(() => {
      loadProductImage(product).then((url) => {
        if (alive) setFetched({ key, url });
      });
    });
    return () => { alive = false; cancelIdle(handle); };
    // `product` is a fresh object on every snapshot; `key` is everything
    // the load actually depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sidecar = fetched && fetched.key === key ? fetched.url : null;
  const src = direct || sidecar;

  return { src, loading: !src && Boolean(key) };
}
