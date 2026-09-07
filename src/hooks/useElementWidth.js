// src/hooks/useElementWidth.js
//
// Presentational only. Reports the live pixel width of an element so a
// chart can size its SVG in real pixels instead of scaling a viewBox.
//
// An <svg> with no height attribute resolves to height:100%; inside an
// auto-height parent that is indeterminate, so the browser falls back to
// the CSS default object size of 300x150. With `w-full` on top you get a
// containerWidth x 150 box, and the default preserveAspectRatio then
// scales the viewBox to FIT that box and centres it — letterboxing. The
// only real fix is to know the width.

import { useEffect, useRef, useState } from 'react';

export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export default useElementWidth;
