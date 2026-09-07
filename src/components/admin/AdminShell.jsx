// src/components/admin/AdminShell.jsx
import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdmin } from './AdminProtectedRoute';
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Cloud,
  HeartPulse,
  ArrowLeft,
  LogOut,
  ExternalLink,
  Shield,
  Menu,
  X,
  MoreHorizontal,
} from 'lucide-react';

// `needs` names a capability from the Worker's PERMISSIONS table. It
// decides what to RENDER and nothing more — the Worker re-checks the same
// capability on every request, so a hidden link is a tidier menu, not a
// security boundary.
const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/businesses', label: 'Directory', icon: Building2, end: false },
  { to: '/admin/cloud-usage', label: 'Cloud usage', icon: Cloud, end: false, needs: 'ops.read' },
  { to: '/admin/system-health', label: 'System health', icon: HeartPulse, end: false, needs: 'ops.read' },
  { to: '/admin/communications', label: 'Comms', icon: Mail, end: false, needs: 'comms.send' },
  { to: '/admin/security', label: 'Security', icon: ShieldAlert, end: false, needs: 'security.read' },
  { to: '/admin/audit-logs', label: 'Audit Trail', icon: ScrollText, end: false, needs: 'audit.read' },
  { to: '/admin/admins', label: 'System Admins', icon: ShieldCheck, end: false, superAdminOnly: true },
];

export default function AdminShell({ children }) {
  const { logout } = useAuth();
  const { admin, isSuperAdmin } = useAdmin();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isSupportMode = location.pathname.includes('/support');

  // An older Worker deployment returns no permissions map. Treating that
  // as "show everything" keeps the console usable during a rollout; the
  // server still refuses anything this administrator may not do.
  const visibleNav = ADMIN_NAV.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.needs && admin.permissions && admin.permissions[item.needs] === false) return false;
    return true;
  });

  return (
    // Same shell rule as the merchant app: a definite viewport height is
    // what makes <main> the one scrolling region, so the rail and the
    // header hold still instead of riding the document up. See
    // `.app-viewport` in index.css and AppShell.jsx.
    <div className="app-viewport flex overflow-hidden bg-canvas text-ink-900">
      {/* Desktop Sidebar (lg:flex) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        {/* Brand Header */}
        <div className="border-b border-divider px-5 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-control bg-deep-600 text-body font-semibold text-white">
              FB
            </div>
            <div>
              <span className="font-display font-bold text-body text-ink-900 block leading-tight">FlowBiz Admin</span>
              <span className="block text-label uppercase text-deep-600">Control centre</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="scroll-quiet flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-panel px-3 py-2.5 text-secondary font-semibold transition-colors ${
                    isActive
                      ? 'bg-deep-50 text-deep-700'
                      : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-divider p-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center justify-between rounded-panel px-3 py-2 text-secondary font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-800"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Merchant App
            </span>
            <ExternalLink className="h-3 w-3 text-ink-300" />
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-button text-danger-700 hover:bg-danger-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out Admin
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Support Mode Warning Banner */}
        {isSupportMode && (
          <div className="bg-warning-500 text-ink-950 px-4 py-2 text-secondary font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0" /> SUPPORT INSPECTION MODE &middot; Read-Only View
            </span>
            <Link to="/admin/businesses" className="underline hover:text-white shrink-0 ml-2">
              Exit
            </Link>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded-panel text-ink-600 hover:bg-ink-100"
              aria-label="Open Admin Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="badge bg-deep-600 text-white">
              {admin.role}
            </span>
            <span className="text-secondary text-ink-500 truncate max-w-[150px] sm:max-w-none">
              {admin.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
 className="btn-outline !px-2.5 text-secondary font-semibold"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content Area (with safe bottom padding for mobile bottom bar) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-ink-950/50" onClick={() => setMobileDrawerOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-5 shadow-overlay flex flex-col justify-between animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-divider pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-control bg-deep-600 text-secondary font-semibold text-white">
                    FB
                  </div>
                  <span className="font-bold text-body text-ink-900">Control centre</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-panel text-ink-400 hover:bg-ink-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="space-y-1">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-panel px-3 py-2.5 text-secondary font-semibold ${
                          isActive
                            ? 'bg-deep-50 text-deep-700'
                            : 'text-ink-600 hover:bg-ink-50'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-divider pt-3 space-y-1 text-secondary">
              <Link
                to="/dashboard"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center justify-between rounded-panel px-3 py-2 text-ink-600 hover:bg-ink-50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ArrowLeft className="h-4 w-4" /> Merchant App
                </span>
              </Link>
              <button
                type="button"
                onClick={() => { setMobileDrawerOpen(false); logout(); }}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-button text-danger-700 hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (1-Tap Page Switching) */}
      <nav className="bottom-nav-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface shadow-sticky lg:hidden">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-label font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/admin/businesses"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-label font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <Building2 className="h-4 w-4" />
          <span>Directory</span>
        </NavLink>

        <NavLink
          to="/admin/cloud-usage"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-label font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <Cloud className="h-4 w-4" />
          <span>Usage</span>
        </NavLink>

        <NavLink
          to="/admin/system-health"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-label font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <HeartPulse className="h-4 w-4" />
          <span>Health</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-label font-bold text-ink-400"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}