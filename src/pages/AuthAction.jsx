import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function AuthAction() {
  const [searchParams] = useSearchParams();

  const urlMode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [resolvedMode, setResolvedMode] = useState(urlMode || null);
  const [checkingMode, setCheckingMode] = useState(!urlMode && !!oobCode);

  useEffect(() => {
    if (urlMode || !oobCode) return;

    let cancelled = false;

    checkActionCode(auth, oobCode)
      .then((info) => {
        if (cancelled) return;

        if (info.operation === 'PASSWORD_RESET') {
          setResolvedMode('resetPassword');
        } else if (info.operation === 'VERIFY_EMAIL') {
          setResolvedMode('verifyEmail');
        } else {
          setResolvedMode('unknown');
        }
      })
      .catch((err) => {
        console.error('[FlowBiz] Failed to determine auth action:', err.code, err.message);
        if (!cancelled) setResolvedMode('unknown');
      })
      .finally(() => {
        if (!cancelled) setCheckingMode(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlMode, oobCode]);

  if (checkingMode) {
    return (
      <Shell>
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
        <p className="text-sm text-ink-500">Checking your link…</p>
      </Shell>
    );
  }

  const flow = searchParams.get('flow');

  if (!oobCode) {
    if (flow === 'resetPassword' || flow === 'verifyEmail') {
      return (
        <Shell>
          <CheckCircle2 className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">
            {flow === 'resetPassword' ? 'Password updated' : 'Email verified'}
          </h1>
          <p className="text-sm text-ink-500">
            {flow === 'resetPassword'
              ? 'Your password was changed. You can now sign in with it.'
              : 'Your email address is verified. You can continue to FlowBiz now.'}
          </p>
          <Link to={flow === 'resetPassword' ? '/login' : '/dashboard'} className="btn-primary w-full">
            {flow === 'resetPassword' ? 'Go to sign in' : 'Continue to Dashboard'}
          </Link>
        </Shell>
      );
    }
    return (
      <Shell>
        <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
        <h1 className="font-display text-lg font-bold text-ink-900">Invalid link</h1>
        <p className="text-sm text-ink-500">This authentication link is missing required parameters. Please request a new link.</p>
        <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
      </Shell>
    );
  }

  if (resolvedMode === 'resetPassword') {
    return <ResetPasswordPanel oobCode={oobCode} />;
  }

  if (resolvedMode === 'verifyEmail') {
    return <VerifyEmailPanel mode={resolvedMode} oobCode={oobCode} />;
  }

  return (
    <Shell>
      <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
      <h1 className="font-display text-lg font-bold text-ink-900">Invalid authentication link</h1>
      <p className="text-sm text-ink-500">We couldn't determine what this link is intended to do. Please request a new link.</p>
      <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm card p-6 text-center space-y-4">
        <img src="/icons/icon-192.png" alt="FlowBiz" className="mx-auto h-14 w-14 rounded-2xl shadow-lg" />
        {children}
      </div>
    </div>
  );
}

// FIX (round 2): this used to apply the verification code AUTOMATICALLY
// the instant the page loaded, inside a useEffect. That is exactly what
// broke things: many email apps and mail providers automatically open
// links in an incoming email — to scan them for phishing, or to build a
// link preview — before the person ever taps anything themselves. Since
// a Firebase verification code can only be used once, that automatic
// visit was silently burning the code, so the person's own, real click
// then failed with "this link has already been used."
//
// The fix is to require an actual tap (a real click event) before
// calling applyActionCode at all. Automated scanners/prefetchers load
// pages, but they don't click buttons — so the code now stays valid
// until the person genuinely interacts with it.
//
// This also matches what was actually wanted: land on the page, see
// "Verify your email", tap it, land on the dashboard immediately — one
// clear step, not an invisible auto-action that could fail silently.
function VerifyEmailPanel({ mode, oobCode }) {
  const linkLooksValid = !!oobCode && mode === 'verifyEmail';

  // 'confirm'    -> waiting for the person to tap "Verify email"
  // 'working'    -> tap happened, applying the code now
  // 'manual'     -> verified, but there's no live session on this device
  //                 (the link was opened somewhere that isn't signed in)
  // 'error'      -> something is genuinely wrong with the link
  const [status, setStatus] = useState(linkLooksValid ? 'confirm' : 'error');
  const [message, setMessage] = useState(
    linkLooksValid ? '' : 'This verification link is incomplete or invalid. Please request a new link.'
  );
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  const { refreshEmailVerification, firebaseUser, loading: authLoading } = useAuth();

  const handleVerify = async () => {
    setStatus('working');
    try {
      await applyActionCode(auth, oobCode);

      if (auth.currentUser) {
        // Signed in on this device — verify in place and go straight to
        // the dashboard. FIX: this used to also call reloadProfile()
        // here "to be safe" before navigating — but reloadProfile()
        // doesn't actually wait for anything; it just restarts the
        // profile listener and returns right away. By the time we know
        // someone is signed in (AuthContext's own `loading` only clears
        // AFTER their account profile has already arrived), the profile
        // is already loaded — so that extra reload was pure risk: it
        // could make the dashboard open a beat before the (needlessly)
        // re-fetched profile was ready, which is exactly the "Loading
        // Account Profile" screen that got stuck. Removing it fixes
        // that.
        await refreshEmailVerification();
        toast.success('Email verified successfully! Welcome to FlowBiz.');
        navigate('/dashboard', { replace: true });
      } else {
        setStatus('manual');
      }
    } catch (err) {
      const code = err.code || '';

      // The code can come back "already used" for reasons that have
      // nothing to do with anything going wrong — see the note above
      // about automatic link-scanning. If that happened, the account is
      // actually already verified. So if this device has a live
      // session, check the REAL status before showing an error for
      // something that isn't actually a problem.
      if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
        if (auth.currentUser) {
          const verified = await refreshEmailVerification();
          if (verified) {
            toast.success('Your email is verified!');
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      }

      setStatus('error');
      setMessage(
        code === 'auth/expired-action-code'
          ? 'This verification link has expired. Please request a new one below.'
          : code === 'auth/invalid-action-code'
            ? "This verification link has already been used or has expired. If you've already verified, you can enter your dashboard below."
            : "We couldn't verify your email with this link. Please request a new link below."
      );
    }
  };

  const handleRequestNewEmail = async () => {
    if (!auth.currentUser) {
      navigate('/login', { replace: true });
      return;
    }
    setResending(true);
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('request-failed');
      toast.success('A new verification email has been sent — check your inbox.');
    } catch (err) {
      console.error('[FlowBiz] AuthAction resend failed:', err.message);
      toast.error("Couldn't send a new verification email right now. Please try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Shell>
      {status === 'confirm' && (
        <>
          <h1 className="font-display text-lg font-bold text-ink-900">Verify your email</h1>
          <p className="text-sm text-ink-500">Tap below to confirm your email address and open your dashboard.</p>
          <button className="btn-primary w-full" onClick={handleVerify} disabled={authLoading}>
            {authLoading ? 'Preparing…' : 'Verify email'}
          </button>
        </>
      )}

      {status === 'working' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <h1 className="font-display text-lg font-bold text-ink-900">Verifying your email…</h1>
          <p className="text-sm text-ink-500">Taking you to your dashboard.</p>
        </>
      )}

      {status === 'manual' && (
        <>
          <CheckCircle2 className="h-12 w-12 mx-auto text-moss-600" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Email verified!</h1>
          <p className="text-sm text-ink-500">Your account is fully activated. You can now sign in to your dashboard.</p>
          <Link
            to="/login"
            className="btn-primary w-full"
          >
            Sign in to Dashboard
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-12 w-12 mx-auto text-rust-500" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Verification Link Notice</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <div className="flex flex-col gap-2 pt-2">
            <Link to={firebaseUser ? '/dashboard' : '/login'} className="btn-primary w-full">
              {firebaseUser ? 'Go to Dashboard' : 'Sign In'}
            </Link>
            {auth.currentUser && (
              <button className="btn-outline w-full" onClick={handleRequestNewEmail} disabled={resending}>
                {resending ? 'Sending…' : 'Request new verification email'}
              </button>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

function ResetPasswordPanel({ oobCode }) {
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!oobCode) {
      setStatus('error');
      setMessage('This link is missing required information. Please request a new password reset email.');
      return;
    }

    setStatus('checking');

    try {
      const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
      setEmail(verifiedEmail);
      setStatus('form');
    } catch (err) {
      const code = err.code || '';
      setStatus('error');
      setMessage(
        code === 'auth/expired-action-code'
          ? 'This reset link has expired. Please request a new one.'
          : code === 'auth/invalid-action-code'
            ? 'This reset link has already been used or is invalid. Please request a new one.'
            : 'This reset link is invalid. Please request a new one.'
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setMessage('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setMessage('Password must contain at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setMessage('Password must contain at least one number.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setMessage('');
    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch (err) {
      const code = err.code || '';
      setMessage(
        code === 'auth/expired-action-code'
          ? 'This reset link has expired. Please request a new one.'
          : code === 'auth/weak-password'
            ? 'Please choose a stronger password.'
            : "Couldn't reset your password. Please request a new link and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      {status === 'ready' && (
        <>
          <h1 className="font-display text-lg font-bold text-ink-900">Reset your password</h1>
          <p className="text-sm text-ink-500">Click below to enter your new password.</p>
          <button className="btn-primary w-full" onClick={handleContinue}>Continue</button>
        </>
      )}

      {status === 'checking' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
          <p className="text-sm text-ink-500">Verifying link…</p>
        </>
      )}

      {status === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-ink-900">Choose a new password</h1>
            {email && <p className="mt-1 text-sm text-ink-500">for <span className="font-semibold">{email}</span></p>}
          </div>

          {message && (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">
              {message}
            </div>
          )}

          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars (upper, lower, number)"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="h-12 w-12 text-moss-600 mx-auto" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Password updated</h1>
          <p className="text-sm text-ink-500">You can now sign in with your new password.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-12 w-12 text-rust-500 mx-auto" strokeWidth={1.5} />
          <h1 className="font-display text-lg font-bold text-ink-900">Password Reset Issue</h1>
          <p className="text-sm text-ink-500">{message}</p>
          <Link to="/forgot-password" className="btn-primary w-full">Request new reset link</Link>
        </>
      )}
    </Shell>
  );
}