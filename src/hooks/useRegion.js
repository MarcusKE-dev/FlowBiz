// src/hooks/useRegion.js
//
// The open business's region, as React state. The region itself is set by
// SettingsContext when the businessSettings document arrives (see
// lib/region/region.js for why it is a module-level value); this is how a
// component re-renders when it changes.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getActiveRegion, subscribeActiveRegion } from '../lib/region/region.js';
import { businessDayKey, msUntilNextBusinessDay, startOfBusinessDay, endOfBusinessDay } from '../lib/region/time.js';

export function useRegion() {
  return useSyncExternalStore(subscribeActiveRegion, getActiveRegion, getActiveRegion);
}

/**
 * Today's business-day boundaries, which ROLL OVER at the business's own
 * midnight and follow a timezone change. A page left open overnight on the
 * counter used to keep showing yesterday's "today" until it was reloaded.
 */
export function useBusinessToday() {
  const region = useRegion();
  const [key, setKey] = useState(() => businessDayKey(new Date(), region.timezone));

  useEffect(() => {
    setKey(businessDayKey(new Date(), region.timezone));
    let timer;
    const arm = () => {
      // One second past the boundary, so the new key is unambiguous.
      timer = setTimeout(() => {
        setKey(businessDayKey(new Date(), region.timezone));
        arm();
      }, msUntilNextBusinessDay(new Date(), region.timezone) + 1000);
    };
    arm();
    return () => clearTimeout(timer);
  }, [region.timezone]);

  const [range, setRange] = useState(() => ({ key, start: startOfBusinessDay(new Date(), region.timezone), end: endOfBusinessDay(new Date(), region.timezone) }));
  useEffect(() => {
    setRange((prev) => (prev.key === key ? prev : { key, start: startOfBusinessDay(new Date(), region.timezone), end: endOfBusinessDay(new Date(), region.timezone) }));
  }, [key, region.timezone]);
  return range;
}
