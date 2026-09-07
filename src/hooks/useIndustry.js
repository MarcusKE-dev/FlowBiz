// src/hooks/useIndustry.js
//
// The one hook the rest of the application uses to ask what this business
// supports. It reads the already-resolved configuration off SettingsContext
// — it does NOT fetch, subscribe or resolve anything of its own, so calling
// it from fifty components costs the same as calling it from one.
//
//     const industry = useIndustry();
//     if (industry.can('units')) { ... }
//
// Never branch on `industry.profileId` in a feature. Branch on a capability.
// The profile is a set of defaults; the capability is the behaviour, and
// only the capability survives an owner turning something off.
import { useSettings } from '../contexts/SettingsContext';

export function useIndustry() {
  return useSettings().industry;
}
