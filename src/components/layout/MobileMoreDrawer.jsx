import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { X } from 'lucide-react';
import { visibleNavItems } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useIndustry } from '../../hooks/useIndustry';
import { usePermissions } from '../../hooks/usePermissions';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} strokeWidth={1.75} />;
};

// Everything the bottom bar cannot fit, behind one button — the sidebar
// is desktop-only (lg:flex).
//
// One uniform grid of bordered tiles, in NAV_ITEMS order, with no group
// headings. The previous version filed these under the sidebar's four
// groups, which cost about 90px of headings and — because two of the
// groups hold 2 and 3 items against a 3-or-4 column grid — left empty
// cells that read as missing content rather than as the end of a group.
// Twelve destinations is a list you scan, not a taxonomy you navigate:
// the headings were paying for structure nobody needed to find Settings.
//
// Three columns at every width, deliberately not responsive. Twelve items
// divide into exactly four full rows, so the grid never leaves a hole,
// and a fixed column count means the tiles are the same size on a 320px
// phone as on a 430px one.
//
// NAV_GROUPS still exists in navConfig for the desktop sidebar, which
// does want the taxonomy. It is simply no longer read here.
export default function MobileMoreDrawer({ open, onClose }) {
  const { isAdmin } = useAuth();
  const industry = useIndustry();
  const permissions = usePermissions();

  const items = visibleNavItems({ isAdmin, industry, permissions });

  if (!open) return null;

  // Active carries the border as well as the fill, so the current page
  // reads as the selected tile rather than as a tinted one.
  const tile = ({ isActive }) =>
    `flex h-tile flex-col items-center justify-center gap-2 rounded-panel border px-1
     text-center transition-colors ${
       isActive
         ? 'border-primary-600 bg-primary-50 text-primary-700'
         : 'border-line bg-surface text-ink-700 active:bg-ink-50'
     }`;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All pages">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-panel bg-surface pb-8 shadow-overlay">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="font-display text-section-title text-ink-900">All pages</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-control p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={tile}
            >
              <Icon name={item.icon} />
              <span className="w-full truncate text-body">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
