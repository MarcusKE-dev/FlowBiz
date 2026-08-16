import { useAuth } from '../../contexts/AuthContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import { isDemoMode } from '../../demo/demoMode';
import { Link } from 'react-router-dom';

export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const demo = isDemoMode();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">

      <div className="flex min-w-0 items-center gap-3">
        {isAdmin && !demo && (
          <Link
            to="/pro"
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${isPro ? 'bg-amber-100 text-amber-800' : 'bg-moss-600 text-white hover:bg-moss-700 active:bg-moss-800'}`}
          >
            {isPro ? 'FlowBiz Pro ✓' : 'Explore FlowBiz Pro'}
          </Link>
        )}
        <div className="hidden truncate text-sm text-ink-500 lg:block">
          Welcome, <span className="font-semibold text-ink-800">{profile?.displayName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {demo && (
          <span className="badge bg-amber-100 text-amber-800" title="Sample data only — nothing here touches Firebase">
            Demo
          </span>
        )}
        <ConnectivityIndicator />
        {/* FIX: was checking profile?.role === 'admin', a role value that
            no longer exists anywhere in this app — every owner was
            showing as "Cashier" here. This app's actual roles are
            'owner' and 'cashier'. */}
        <span className={`badge hidden sm:inline-flex ${profile?.role === 'owner' ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>
          {profile?.role === 'owner' ? 'Owner' : 'Cashier'}
        </span>
        {!demo && (
          <button onClick={logout} className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">Sign out</button>
        )}
      </div>
    </header>
  );
}