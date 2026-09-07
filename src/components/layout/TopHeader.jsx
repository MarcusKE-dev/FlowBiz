import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import StatusPill from '../ui/StatusPill';
import { isDemoMode } from '../../demo/demoMode';


export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const { settings } = useSettings();
  const demo = isDemoMode();

 
  if (demo) {
    return (
      <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-6">
        <StatusPill tone="caution">Demo</StatusPill>
        <div className="flex items-center gap-2">
          <a href="/" className="btn-secondary">Exit demo</a>
          <a href="/setup" className="btn-primary">Sign up</a>
        </div>
      </header>
    );
  }

  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-body font-semibold text-ink-900">
          {settings.shopName}
        </span>
        <ConnectivityIndicator />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isAdmin && (
          <Link
            to="/pro"
            className={isPro ? 'btn-secondary hidden sm:inline-flex' : 'btn-primary hidden sm:inline-flex'}
          >
            {isPro ? 'Pro active' : 'FlowBiz Pro'}
          </Link>
        )}
        <button type="button" onClick={logout} className="btn-secondary">Sign out</button>
      </div>
    </header>
  );
}