// src/components/admin/AdminShell.jsx
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
} from 'lucide-react';

const ADMIN_NAV = [
  { to: '/admin', label: 'Platform Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/businesses', label: 'Business Directory', icon: Building2, end: false },
  { to: '/admin/audit-logs', label: 'Audit Trail', icon: ScrollText, end: false },
  { to: '/admin/admins', label: 'System Admins', icon: ShieldCheck, end: false, superAdminOnly: true },
  { to: '/admin/communications', label: 'Communications', icon: Mail, end: false },
];

export default function AdminShell({ children }) {
  const { logout } = useAuth();
  const { admin, isSuperAdmin } = useAdmin();
  const location = useLocation();

  const isSupportMode = location.pathname.includes('/support');

  return (
    <div className="flex min-h-screen bg-sand text-ink-900">
      {/* Admin Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        {/* Brand Header */}
        <div className="border-b border-ink-100 px-5 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-ink-900 text-white flex items-center justify-center font-black text-sm">
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

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Support Mode Notice Banner */}
        {isSupportMode && (
          <div className="bg-amber-500 text-ink-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> SUPPORT INSPECTION MODE &middot; Strictly Read-Only View as Business
            </span>
            <Link to="/admin/businesses" className="underline hover:text-white">
              Exit Support Mode
            </Link>
          </div>
        )}

        {/* Cleaned Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <span className="badge bg-ink-900 text-white text-[10px] font-bold uppercase tracking-wider">
              {admin.role}
            </span>
            <span className="text-xs text-ink-500">
              Operator: <strong className="text-ink-800">{admin.name}</strong> ({admin.email})
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

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}