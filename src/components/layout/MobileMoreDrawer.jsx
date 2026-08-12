import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X } from 'lucide-react';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} strokeWidth={1.75} />;
};

// Full page list for phones — the sidebar is desktop-only (lg:flex), and the
// bottom bar only fits a handful of shortcuts, so this covers everything else
// (Products, Purchases, Suppliers, Stock Take, Users, etc.) behind one button.
export default function MobileMoreDrawer({ open, onClose }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).filter(
    (item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl2 bg-white p-4 pb-8 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink-900">All pages</h2>
          <button onClick={onClose} className="p-1.5 rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center text-[11px] font-semibold ${
                 isActive
                    ? 'border-moss-200 bg-moss-50 text-moss-800'
                    : 'border-ink-100 text-ink-500 hover:bg-ink-50'
                }`
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
