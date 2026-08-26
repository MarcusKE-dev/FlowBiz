import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopHeader from './TopHeader';

export default function AppShell({ children }) {
  const location = useLocation();
  const isCounterRoute = location.pathname.startsWith('/counter');

  // The Counter page benefits from a wider working area (product grid +
  // checkout panel side by side), so on desktop the sidebar collapses to
  // a slim icon rail automatically the moment it's opened, and expands
  // again on every other page. This never touches mobile — Sidebar is
  // hidden below the lg breakpoint regardless of this state. A person
  // can still override it manually at any time via the toggle at the
  // bottom of the sidebar; navigating away and back to Counter resets it
  // to collapsed again.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isCounterRoute);

  useEffect(() => {
    setSidebarCollapsed(isCounterRoute);
  }, [isCounterRoute]);

  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}