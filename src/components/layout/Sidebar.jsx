import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { NAV_GROUPS, visibleNavItems } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useIndustry } from '../../hooks/useIndustry';
import { usePermissions } from '../../hooks/usePermissions';

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
//
// `overlay` is the hover-expanded state: the rail keeps its 68px slot in
// AppShell's flex layout and this panel floats above the content on top
// of it. Reflowing the whole app on mouse-over is disorienting; floating
// over it is the pattern people already know. `pinned` is the manual
// toggle, which grows the slot itself so nothing is covered.
//
// `onNavigate` fires on every nav item's click so AppShell can collapse a
// hover-expanded rail the moment a page is chosen. Optional: a caller that
// omits it gets the old behaviour.
export default function Sidebar({ collapsed = false, onToggleCollapse, overlay = false, pinned = false, onNavigate }) {
  const { isAdmin } = useAuth();
  const industry = useIndustry();
  const permissions = usePermissions();

  const items = visibleNavItems({ isAdmin, industry, permissions });

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
      onClick={onNavigate}
      className={link}
    >
      <Icon name={item.icon} />
      {!collapsed && item.label}
    </NavLink>
  );

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-line bg-surface lg:flex ${
        overlay
          ? 'absolute inset-y-0 left-0 z-40 w-60 shadow-overlay'
          : `h-full w-full ${collapsed ? '' : 'w-60'}`
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

      {/* Scrollable only when it genuinely has to be. `auto` shows nothing
          at all while the items fit — which they do at any ordinary
          desktop height — and `scroll-quiet` keeps the gutter out of the
          design on the short viewports where they do not. */}
      <nav className="scroll-quiet flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main">
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
            title={pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
            aria-label={pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
            aria-pressed={pinned}
          >
            {pinned ? (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            )}
            {!collapsed && (pinned ? 'Unpin' : 'Keep open')}
          </button>
        </div>
      )}
    </aside>
  );
}
