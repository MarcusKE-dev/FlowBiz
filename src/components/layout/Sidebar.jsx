import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const C = Lucide[name] || Lucide.Circle;
  return <C className={className} strokeWidth={1.75} />;
};

// `collapsed` and `onToggleCollapse` are optional — any existing caller
// that renders <Sidebar /> with no props keeps behaving exactly as
// before (always expanded, no toggle button rendered).
export default function Sidebar({ collapsed = false, onToggleCollapse }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const items = NAV_ITEMS
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-ink-100 bg-white transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-0' : 'px-3'
              } ${isActive ? 'bg-moss-50 text-moss-800' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`
            }
          >
            <Icon name={item.icon} />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-ink-100 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-semibold text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            )}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </aside>
  );
}