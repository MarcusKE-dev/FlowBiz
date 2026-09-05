import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import ConnectivityIndicator from '../common/ConnectivityIndicator';
import StatusPill from '../ui/StatusPill';
import { isDemoMode } from '../../demo/demoMode';

// The control rail. Thinner than before, sits on the canvas rather than
// on its own surface, and leads with the two facts that stay true all
// day: which shop this is, and who is signed in.
//
// The day-state pill ("Day open" / "Day closed" / "Not opened") used to
// live here. It is gone, and so is this component's useDailySession
// subscription: Counter and Close Day both show that state where it is
// actually actionable, and repeating it on every page bought nothing.
// "Owner" / "Cashier" is deliberate wording — it matches the `role`
// field in the data model and the language in Team and the Help guide.
export default function TopHeader() {
  const { profile, logout, isAdmin, isPro } = useAuth();
  const { settings } = useSettings();
  const demo = isDemoMode();

  // Demo Mode gets its own minimal header — just a "Demo" label, a way
  // out (Exit Demo), and a way to become a real customer (Sign Up).
  // Both links use a plain <a>, not react-router's <Link>: the demo is a
  // separately-built app living at the /demo/ sub-path, so these need to
  // leave that bundle entirely and load the real site fresh, rather than
  // try to client-side-route to a page this bundle doesn't have.
  if (demo) {
    return (
      <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-6">
        <StatusPill tone="caution" solid>Demo</StatusPill>
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
        <StatusPill tone="neutral" className="hidden shrink-0 sm:inline-flex">
          {profile?.role === 'owner' ? 'Owner' : 'Cashier'}
        </StatusPill>
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
        <ConnectivityIndicator />
        <button type="button" onClick={logout} className="btn-secondary">Sign out</button>
      </div>
    </header>
  );
}
