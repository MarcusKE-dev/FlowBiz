import { useEffect, useState } from 'react';
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

    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshEmailVerification();
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(pollId);
    };
  }, [demo, firebaseUser, emailVerified, refreshEmailVerification]);

      const [checkingVerification, setCheckingVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);
  
if (loading) return <LoadingSpinner label="Checking your session…" />;

  if (sessionRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          
          <h2 className="font-display text-lg font-bold text-ink-900">This device was signed out</h2>
          <p className="text-sm text-ink-500">An owner revoked access for this device from Settings → Device Management.</p>
          <button className="btn-primary w-full" onClick={() => (window.location.href = '/login')}>Go to sign in</button>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return <Navigate to="/login" replace />;

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
          
          <h2 className="font-display text-lg font-bold text-ink-900">Verify your email</h2>
          <p className="text-sm text-ink-500">We've sent a verification link to your email address. Please check your Inbox, and if you don't see it within a minute or two, check your Spam/Junk folder too.</p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              disabled={checkingVerification}
              onClick={async () => {
                setCheckingVerification(true);
                try {
                  const verified = await refreshEmailVerification();
                  if (!verified) toast.error("Not verified yet — check your inbox (and spam/junk folder) and click the link, then try again.");
                } finally {
                  setCheckingVerification(false);
                }
              }}
            >
              {checkingVerification ? 'Checking…' : "I've verified — check now"}
            </button>
            <button
              className="btn-outline w-full"
              disabled={resending || resendCooldown > 0}
              onClick={async () => {
                setResending(true);
                try {
                  await resendVerificationEmail();
                  toast.success('Verification email sent — check your inbox and spam/junk folder.');
                  setResendCooldown(60);
                } catch (err) {
                  console.error('[FlowBiz] resendVerificationEmail failed:', err.code || err.name, err.message);
                  toast.error(
                    err.code === 'auth/too-many-requests'
                      ? 'Too many verification attempts. Please wait before requesting another email.'
                      : "Couldn't send the verification email. Please try again in a moment."
                  );
                  if (err.code === 'auth/too-many-requests') setResendCooldown(60);
                } finally {
                  setResending(false);
                }
              }}
            >
              {resending ? 'Sending…' : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend verification email'}
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