import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopHeader from './TopHeader';
export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen bg-sand">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
