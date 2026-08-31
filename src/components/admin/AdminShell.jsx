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
  Mail,
  ArrowLeft,
  LogOut,
  ExternalLink,
  Shield,
  Menu,
  X,
  MoreHorizontal,
} from 'lucide-react';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/businesses', label: 'Directory', icon: Building2, end: false },
  { to: '/admin/communications', label: 'Comms', icon: Mail, end: false },
  { to: '/admin/audit-logs', label: 'Audit Trail', icon: ScrollText, end: false },
  { to: '/admin/admins', label: 'System Admins', icon: ShieldCheck, end: false, superAdminOnly: true },
];

export default function AdminShell({ children }) {
  const { logout } = useAuth();
  const { admin, isSuperAdmin } = useAdmin();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isSupportMode = location.pathname.includes('/support');

  return (
    <div className="flex min-h-screen bg-sand text-ink-900">
      {/* Desktop Sidebar (lg:flex) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        {/* Brand Header */}
        <div className="border-b border-ink-100 px-5 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-ink-900 text-white flex items-center justify-center font-black text-sm shadow-xs">
              FB
            </div>
            <div>
              <span className="font-display font-bold text-sm text-ink-900 block leading-tight">FlowBiz Admin</span>
              <span className="text-[10px] font-semibold text-moss-700 tracking-wider uppercase block">Control Center</span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-3">
          {ADMIN_NAV.map((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-ink-900 text-white shadow-xs'
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
        <div className="border-t border-ink-100 p-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-800"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Merchant App
            </span>
            <ExternalLink className="h-3 w-3 text-ink-300" />
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rust-600 hover:bg-rust-50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out Admin
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Support Mode Warning Banner */}
        {isSupportMode && (
          <div className="bg-amber-500 text-ink-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0" /> SUPPORT INSPECTION MODE &middot; Read-Only View
            </span>
            <Link to="/admin/businesses" className="underline hover:text-white shrink-0 ml-2">
              Exit
            </Link>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-ink-600 hover:bg-ink-100"
              aria-label="Open Admin Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="badge bg-ink-900 text-white text-[10px] font-bold uppercase tracking-wider">
              {admin.role}
            </span>
            <span className="text-xs text-ink-500 truncate max-w-[150px] sm:max-w-none">
              {admin.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
              className="btn-outline !min-h-0 !py-1 !px-2.5 text-xs font-semibold"
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
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-xs" onClick={() => setMobileDrawerOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-5 shadow-2xl flex flex-col justify-between animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-ink-900 text-white flex items-center justify-center font-bold text-xs">
                    FB
                  </div>
                  <span className="font-bold text-sm text-ink-900">Control Center</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-ink-400 hover:bg-ink-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="space-y-1">
                {ADMIN_NAV.map((item) => {
                  if (item.superAdminOnly && !isSuperAdmin) return null;
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                          isActive
                            ? 'bg-ink-900 text-white'
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

            <div className="border-t border-ink-100 pt-3 space-y-1 text-xs">
              <Link
                to="/dashboard"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-ink-600 hover:bg-ink-50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ArrowLeft className="h-4 w-4" /> Merchant App
                </span>
              </Link>
              <button
                type="button"
                onClick={() => { setMobileDrawerOpen(false); logout(); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-semibold text-rust-600 hover:bg-rust-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (1-Tap Page Switching) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-200 bg-white/95 backdrop-blur-md lg:hidden">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
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
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <Building2 className="h-4 w-4" />
          <span>Directory</span>
        </NavLink>

        <NavLink
          to="/admin/communications"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <Mail className="h-4 w-4" />
          <span>Comms</span>
        </NavLink>

        <NavLink
          to="/admin/audit-logs"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
              isActive ? 'text-ink-900' : 'text-ink-400'
            }`
          }
        >
          <ScrollText className="h-4 w-4" />
          <span>Audit</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-ink-400"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}