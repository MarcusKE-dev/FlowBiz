import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { NAV_ITEMS, NAV_GROUPS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const C = Lucide[name] || Lucide.Circle;
  return <C className={className} strokeWidth={1.75} />;
};

// The rail. Brand block on top, then the pages filed under four quiet
// group headings separated by hairlines. Active state is the only place
// blue appears here: a primary-50 fill, a 2px blue bar down the left
// edge, and primary-700 text.
//
// `collapsed` and `onToggleCollapse` are optional — any existing caller
// that renders <Sidebar /> with no props keeps behaving exactly as
// before (always expanded, no toggle button rendered). Role filtering is
// unchanged from navConfig.
export default function Sidebar({ collapsed = false, onToggleCollapse }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();

  const items = NAV_ITEMS
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => item.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);

  const ungrouped = items.filter((i) => !i.group);
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) }))
    .filter((g) => g.items.length > 0);

  const link = ({ isActive }) =>
    `relative flex items-center gap-3 rounded-control py-2 text-body font-medium transition-colors ${
      collapsed ? 'justify-center px-0' : 'px-3'
    } ${
      isActive
        ? 'bg-primary-50 text-primary-700 before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-600 before:content-[""]'
        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
    }`;

  const renderItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={link}
    >
      <Icon name={item.icon} />
      {!collapsed && item.label}
    </NavLink>
  );

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {/* Brand. A wordmark, not the icon asset — the raster icons are
          still the old green and would fight the palette. */}
      <div className={`flex h-14 shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        {collapsed ? (
          <span className="font-display text-page-title text-ink-900" aria-hidden="true">F</span>
        ) : (
          <span className="font-display text-page-title text-ink-900">FlowBiz</span>
        )}
        <span className="sr-only">FlowBiz</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main">
        {ungrouped.length > 0 && (
          <div className="space-y-0.5 pb-3">{ungrouped.map(renderItem)}</div>
        )}

        {groups.map((g, i) => (
          <div
            key={g.id}
            className={`space-y-0.5 ${i > 0 || ungrouped.length > 0 ? 'border-t border-divider pt-3' : ''} ${
              i < groups.length - 1 ? 'pb-3' : ''
            }`}
          >
            {collapsed ? (
              <span className="sr-only">{g.label}</span>
            ) : (
              <div className="px-3 pb-1 text-label uppercase text-ink-400">{g.label}</div>
            )}
            {g.items.map(renderItem)}
          </div>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center gap-2 rounded-control py-2 text-button text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
