// src/hooks/usePermissions.js
//
// The one hook the application uses to ask what the signed-in person may
// do. Like useIndustry(), it FETCHES NOTHING: the role comes from
// AuthContext's existing profile listener and the permission map rides on
// the businessSettings document SettingsContext already holds one shared
// listener on, so asking this question from fifty components costs
// exactly what asking it from one costs.
//
//     const may = usePermissions();
//     if (may.can('stock.receive')) { ... }
//
// IT IS NOT THE SECURITY BOUNDARY, and no component should treat it as
// one. Every permission whose entry says `enforcement: 'rules'` is
// refused server-side by firestore.rules whatever this returns; the ones
// that say `enforcement: 'route'` decide which screen is offered over
// data the person's own work already requires them to read. See
// industry/permissions.js.

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { resolvePermissions } from '../industry/permissions';

export function usePermissions() {
  const { isOwner } = useAuth();
  const { settings, industry } = useSettings();
  return useMemo(
    () => resolvePermissions({ isOwner, industry, settings }),
    [isOwner, industry, settings]
  );
}
