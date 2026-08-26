import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoMode } from '../../demo/demoMode';
import LoadingSpinner from './LoadingSpinner';
import { Ban, AlertCircle, RefreshCw, Store } from 'lucide-react';

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
    }, 5000);

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

  if (!profile) {
    if (accountRemoved) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-sand p-6">
          <div className="card max-w-sm w-full p-6 text-center space-y-4">
            <Store className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
            <h2 className="font-display text-lg font-bold text-ink-900">Business Setup Required</h2>
            <p className="text-sm text-ink-500">
              You are signed in as <span className="font-semibold text-ink-700">{firebaseUser.email}</span>, but your business workspace is not configured yet.
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/setup" className="btn-primary w-full">Set Up Business Now</Link>
              <button className="btn-outline w-full" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Loading Account Profile</h2>
          <p className="text-sm text-ink-500">
            Connecting to your business workspace. If this takes more than a few moments, click below.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={reloadProfile}>
              <RefreshCw className="h-4 w-4" /> Reload Profile
            </button>
            <Link to="/setup" className="btn-outline w-full">Set Up / Reconfigure Business</Link>
            <button className="text-xs text-ink-400 hover:underline pt-1" onClick={async () => { await logout(); window.location.href = '/login'; }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm p-6 text-center space-y-3">
          <Ban className="h-10 w-10 mx-auto text-rust-500" strokeWidth={1.5} />
          <h2 className="font-display text-lg font-bold text-ink-900">Account deactivated</h2>
          <p className="text-sm text-ink-500">Contact your business owner to regain access.</p>
          <button className="btn-outline w-full" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  if (!demo && !emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-sm w-full p-6 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Verify your email</h2>
          <p className="text-sm text-ink-500">
            We sent a verification link to <span className="font-semibold text-ink-800">{firebaseUser.email}</span>. Please check your inbox (and spam/junk folder) and click the link to activate your account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              disabled={checkingVerification}
              onClick={async () => {
                setCheckingVerification(true);
                try {
                  const verified = await refreshEmailVerification();
                  if (!verified) toast.error("Not verified yet — check your inbox and click the link, then try again.");
                  else toast.success("Email verified! Welcome.");
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
                  toast.success('Verification email sent — check your inbox.');
                  setResendCooldown(60);
                } catch (err) {
                  console.error('[FlowBiz] resendVerificationEmail error:', err.message);
                  toast.error(
                    err.code === 'auth/too-many-requests'
                      ? 'Too many attempts. Please wait a minute before requesting another email.'
                      : "Couldn't send the verification email. Please try again shortly."
                  );
                  setResendCooldown(60);
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