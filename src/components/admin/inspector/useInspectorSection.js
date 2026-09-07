// src/components/admin/inspector/useInspectorSection.js
//
// Loads one section of the Business Inspector, one page at a time.
//
// Three rules the hook exists to enforce, so no individual tab has to
// remember them:
//
//   1. NOTHING LOADS UNTIL THE TAB IS OPENED. `enabled` is the tab's
//      visibility. Opening a business must not fetch its sales, its
//      customers, its credit book and its stock history on the chance the
//      admin might click one of them.
//
//   2. A TAB LOADS ONCE. Switching away and back re-renders from state
//      rather than re-querying, so idly clicking along the tab bar costs
//      one page of reads per tab, not one per click.
//
//   3. PAGES ACCUMULATE FORWARD BY CURSOR. "Load more" appends the next
//      cursor page; it never re-reads what is already on screen and never
//      uses an offset (Firestore bills the documents an offset skips).
//
// There are no listeners here, in any tab, ever. The admin console reads;
// it does not subscribe. A console that subscribed to each business it
// touched would leave a trail of live listeners across the platform.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInspectorSection } from '../../../utils/adminService';

export default function useInspectorSection(businessId, section, {
  enabled = true,
  limit = 25,
  search = '',
  from = null,
  to = null,
} = {}) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Identifies "which query is this". When it changes the accumulated
  // pages are no longer answers to the question being asked.
  const queryKey = `${businessId}|${section}|${search}|${from || ''}|${to || ''}`;
  const loadedKey = useRef(null);

  const load = useCallback(async (cursor = null) => {
    const isFirstPage = !cursor;
    if (isFirstPage) { setLoading(true); setError(null); }
    else setLoadingMore(true);

    try {
      const data = await fetchInspectorSection(businessId, { section, limit, cursor, search, from, to });
      setRows((prev) => (isFirstPage ? data.rows : [...prev, ...data.rows]));
      setMeta(data);
    } catch (err) {
      // The object, not the message — AdminApiError branches on a flag it
      // carries when the deployed Worker is older than this client.
      setError(err);
      if (isFirstPage) setRows([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId, section, limit, search, from, to]);

  useEffect(() => {
    if (!enabled || !businessId || !section) return;
    if (loadedKey.current === queryKey) return;
    loadedKey.current = queryKey;
    setRows([]);
    setMeta(null);
    load(null);
  }, [enabled, businessId, section, queryKey, load]);

  const loadMore = useCallback(() => {
    if (meta?.nextCursor && !loadingMore) load(meta.nextCursor);
  }, [meta, loadingMore, load]);

  const reload = useCallback(() => {
    loadedKey.current = null;
    setRows([]);
    setMeta(null);
    load(null);
  }, [load]);

  return {
    rows,
    meta,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(meta?.hasMore && meta?.nextCursor),
    loadMore,
    reload,
  };
}
