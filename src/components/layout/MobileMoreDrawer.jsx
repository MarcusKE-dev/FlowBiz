import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { X } from 'lucide-react';
import { NAV_ITEMS, NAV_GROUPS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} strokeWidth={1.75} />;
};

// Full page list for phones — the sidebar is desktop-only (lg:flex), and
// the bottom bar only fits a handful of shortcuts, so this covers
// everything else behind one button. Filed under the same four groups as
// the sidebar so the two read as one navigation model, and rendered as
// hairline list rows rather than a grid of bordered tiles.
export default function MobileMoreDrawer({ open, onClose }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const items = NAV_ITEMS
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  if (!open) return null;

  const ungrouped = items.filter((i) => !i.group);
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) }))
    .filter((g) => g.items.length > 0);

  const row = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 text-body font-medium transition-colors ${
      isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-700 active:bg-ink-50'
    }`;

  const renderItem = (item) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose} className={row}>
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All pages">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-panel bg-surface pb-8 shadow-overlay">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
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

        {ungrouped.length > 0 && <div className="py-1">{ungrouped.map(renderItem)}</div>}

        {groups.map((g) => (
          <div key={g.id} className="border-t border-divider py-1">
            <div className="px-4 pb-1 pt-2 text-label uppercase text-ink-400">{g.label}</div>
            {g.items.map(renderItem)}
          </div>
        ))}
      </div>
    </div>
  );
}
