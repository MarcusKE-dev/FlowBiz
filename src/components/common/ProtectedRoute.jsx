import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoMode } from '../../demo/demoMode';
import LoadingSpinner from './LoadingSpinner';
import { Lock, Ban, AlertCircle, Mail } from 'lucide-react';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const {
    firebaseUser, profile, loading, authError, accountRemoved, sessionRevoked,
    isAdmin, isActive, emailVerified, logout, reloadProfile, resendVerificationEmail,
    refreshEmailVerification,
  } = useAuth();
  const demo = isDemoMode();

  useEffect(() => {
    if (authError) console.error('ProtectedRoute captured authError:', authError);
  }, [authError]);

  useEffect(() => {
    if (demo || !firebaseUser || emailVerified) return;

    const handleFocus = () => { refreshEmailVerification(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // FIX: was polling every 5s unconditionally. Each poll calls
    // Firebase's reload(), which internally notifies auth listeners and
    // causes Firestore to tear down and re-open its entire realtime
    // connection every time — even while the tab is in the background
    // and nothing changed. That churn shows up as repeated
    // ERR_BLOCKED_BY_CLIENT noise on connections some ad blockers/proxies
    // flag, and increases the odds of a listener briefly missing an
    // update. focus/visibilitychange above already cover the main case
    // (returning to the tab after clicking the email link); this
    // interval is only a slow fallback for browsers where those events
    // don't fire reliably, so it's slowed down and skipped while hidden.
    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollId);
    };
  }, [demo, firebaseUser, emailVerified, refreshEmailVerification]);

  if (loading) return <LoadingSpinner label="Checking your session…" />;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  if (sessionRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <Lock className="h-12 w-12 text-ink-400" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">This device was signed out</h2>
          <p className="text-sm text-ink-500">An owner revoked access for this device from Settings → Device Management.</p>
          <button className="btn-primary w-full" onClick={() => (window.location.href = '/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  if (accountRemoved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <Ban className="h-12 w-12 text-rust-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">This account has been removed</h2>
          <p className="text-sm text-ink-500">Please contact your business owner.</p>
          <button className="btn-primary w-full" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Profile unavailable</h2>
          <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-left">
            <p className="text-xs font-semibold text-rust-700 uppercase tracking-wide">Error details</p>
            <p className="mt-1 text-sm text-rust-700 break-words font-mono">{authError || 'No error captured — check DevTools console'}</p>
          </div>
          <p className="text-sm text-ink-500">If you just updated Firestore rules, your browser may be using a stale offline cache.</p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full" onClick={reloadProfile}>Retry profile load</button>
            <button className="btn-outline w-full" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out and return to login</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm p-6">
          <h2 className="font-display text-lg font-bold text-ink-900">Account deactivated</h2>
          <p className="mt-2 text-sm text-ink-500">Contact a business owner to regain access.</p>
        </div>
      </div>
    );
  }

  if (!demo && !emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <Mail className="h-12 w-12 text-moss-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Verify your email</h2>
          <p className="text-sm text-ink-500">We sent a verification link to your email address. Click it, then come back to this tab — FlowBiz will pick it up automatically.</p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              onClick={async () => {
                const verified = await refreshEmailVerification();
                if (!verified) toast.error("Not verified yet — check your email and click the link, then try again.");
              }}
            >
              I've verified — check now
            </button>
            <button
              className="btn-outline w-full"
              onClick={async () => {
                try {
                  await resendVerificationEmail();
                  toast.success('Verification email sent.');
                } catch (err) {
                  console.error('[FlowBiz] resendVerificationEmail failed:', err.code || err.name, err.message);
                  toast.error(
                    err.code === 'auth/too-many-requests'
                      ? 'Too many verification attempts. Please wait before requesting another email.'
                      : "Couldn't send the verification email. Please try again in a moment."
                  );
                }
              }}
            >
              Resend verification email
            </button>
            <button className="text-xs text-ink-400 hover:underline" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) return <Navigate to="/counter" replace />;
  return children;
}