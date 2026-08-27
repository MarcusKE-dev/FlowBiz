// src/components/layout/TopHeader.jsx
import { useAuth } from '../../contexts/AuthContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import { isDemoMode } from '../../demo/demoMode';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const demo = isDemoMode();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 bg-sand/95 px-4 py-2 backdrop-blur sm:px-6 safe-top">
      <div className="flex min-w-0 items-center gap-3">
{demo ? (
  <div className="flex items-center gap-2">

    <a
      href="/setup"
      className="bg-moss-700 hover:bg-moss-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
    >
      <span>Create Free Account</span>
      <ArrowRight className="h-3 w-3" />
    </a>
  </div>
) : (
  
          isAdmin && (
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
          )
        )}

        <div className="hidden truncate text-sm text-ink-500 lg:block">
          Welcome, <span className="font-semibold text-ink-800">{profile?.displayName || (demo ? 'Demo Owner' : 'Manager')}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!demo && <ConnectivityIndicator />}

        <span className={`badge hidden sm:inline-flex ${profile?.role === 'owner' || demo ? 'bg-ink-900 text-white' : 'bg-moss-100 text-moss-700'}`}>
          {profile?.role === 'owner' || demo ? 'Owner' : 'Cashier'}
        </span>

        {demo ? (
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="btn-outline !px-3 !py-1.5 text-xs !min-h-0"
          >
            Exit Demo
          </button>
        ) : (
          <button onClick={logout} className="btn-outline !px-3 !py-1.5 text-xs !min-h-0">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}