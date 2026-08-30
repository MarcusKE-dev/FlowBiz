import { useAuth } from '../../contexts/AuthContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import { isDemoMode } from '../../demo/demoMode';
import { Link } from 'react-router-dom';

export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const demo = isDemoMode();

  // Demo Mode gets its own minimal header — just a "Demo" label, a way
  // out (Exit Demo), and a way to become a real customer (Sign Up).
  // Both links use a plain <a>, not react-router's <Link>: the demo is a
  // separately-built app living at the /demo/ sub-path, so these need to
  // leave that bundle entirely and load the real site fresh, rather than
  // try to client-side-route to a page this bundle doesn't have.
  if (demo) {
    return (
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">
        <span className="badge bg-amber-100 text-amber-800">Demo</span>
        <div className="flex items-center gap-2">
          <a href="/" className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">Exit Demo</a>
          <a href="/setup" className="btn-primary !px-3 !py-1.5 text-xs !min-h-0">Sign Up</a>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">

      <div className="flex min-w-0 items-center gap-3">
{isAdmin && (
  <Link
    to="/pro"
    className={`inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
      isPro
        ? 'bg-amber-100 text-amber-800'
        : 'bg-moss-600 text-white hover:bg-moss-700 active:bg-moss-800'
    }`}
  >
    {isPro ? 'Pro Activated' : 'FlowBiz Pro'}
  </Link>
)}
        <div className="hidden truncate text-sm text-ink-500 lg:block">
          Welcome, <span className="font-semibold text-ink-800">{profile?.displayName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ConnectivityIndicator />
        <span className={`badge hidden sm:inline-flex ${profile?.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>
          {profile?.role === 'owner' ? 'Owner' : 'Cashier'}
        </span>
        <button onClick={logout} className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">Sign out</button>
      </div>
    </header>
  );
}