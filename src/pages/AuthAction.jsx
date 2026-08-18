import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  reload,
  checkActionCode,
  sendEmailVerification,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '../firebase';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthAction() {
  const [searchParams] = useSearchParams();

  const urlMode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [resolvedMode, setResolvedMode] = useState(urlMode || null);
  const [checkingMode, setCheckingMode] = useState(
    !urlMode && !!oobCode
  );

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
        console.error(
          '[FlowBiz] Failed to determine auth action:',
          err.code,
          err.message
        );

        if (!cancelled) {
          setResolvedMode('unknown');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingMode(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [urlMode, oobCode]);

  if (checkingMode) {
    return (
      <Shell>
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
        <p className="text-sm text-ink-500">
          Checking your link…
        </p>
      </Shell>
    );
  }

  if (!oobCode) {
    return (
      <Shell>
        <AlertCircle
          className="h-12 w-12 mx-auto text-rust-500"
          strokeWidth={1.5}
        />

        <h1 className="font-display text-lg font-bold text-ink-900">
          Invalid link
        </h1>

        <p className="text-sm text-ink-500">
          This authentication link is missing required information.
          Please request a new link.
        </p>

        <Link to="/login" className="btn-outline w-full">
          Go to sign in
        </Link>
      </Shell>
    );
  }

  if (resolvedMode === 'resetPassword') {
    return <ResetPasswordPanel oobCode={oobCode} />;
  }

  if (resolvedMode === 'verifyEmail') {
    return (
      <VerifyEmailPanel
        mode="verifyEmail"
        oobCode={oobCode}
      />
    );
  }

  return (
    <Shell>
      <AlertCircle
        className="h-12 w-12 mx-auto text-rust-500"
        strokeWidth={1.5}
      />

      <h1 className="font-display text-lg font-bold text-ink-900">
        Invalid authentication link
      </h1>

      <p className="text-sm text-ink-500">
        We couldn't determine what this link is intended to do.
        Please request a new link.
      </p>

      <Link to="/login" className="btn-outline w-full">
        Go to sign in
      </Link>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm card p-6 text-center space-y-4">
        <img
          src="/icons/icon-192.png"
          alt="FlowBiz"
          className="mx-auto h-14 w-14 rounded-2xl shadow-lg"
        />

        {children}
      </div>
    </div>
  );
}

function VerifyEmailPanel({ mode, oobCode }) {
  const [status, setStatus] = useState('working');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();

  const handleRequestNewEmail = async () => {
    if (!auth.currentUser) {
      navigate('/login', { replace: true });
      return;
    }

    setResending(true);

    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: false,
      });

      toast.success(
        'A new verification email has been sent — check your inbox and spam/junk folder.'
      );
    } catch (err) {
      console.error(
        '[FlowBiz] AuthAction resend failed:',
        err.code || err.name,
        err.message
      );

      toast.error(
        "Couldn't send a new verification email right now. Please try again shortly."
      );
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (oobCode && mode === 'verifyEmail') {
        try {
          await applyActionCode(auth, oobCode);

          if (auth.currentUser) {
            try {
              await reload(auth.currentUser);
            } catch {
              // Non-fatal
            }
          }

          if (!cancelled) {
            setStatus('success');
            setMessage('Your email has been verified.');
          }
        } catch (err) {
          if (cancelled) return;

          const code = err.code || '';

          if (
            code === 'auth/invalid-action-code' &&
            auth.currentUser
          ) {
            try {
              await reload(auth.currentUser);

              if (auth.currentUser.emailVerified) {
                setStatus('success');
                setMessage('Your email has been verified.');
                return;
              }
            } catch {
              // Fall through to error below
            }
          }

          setStatus('error');

          setMessage(
            code === 'auth/expired-action-code'
              ? 'This verification link has expired. Please request a new one from the app.'
              : code === 'auth/invalid-action-code'
                ? "This verification link has already been used or has expired. If you're already verified, just sign in."
                : "We couldn't verify your email. Please request a new verification link."
          );
        }

        return;
      }

      if (auth.currentUser) {
        try {
          await reload(auth.currentUser);

          if (
            !cancelled &&
            auth.currentUser.emailVerified
          ) {
            setStatus('success');
            setMessage('Your email has been verified.');
            return;
          }
        } catch {
          // Fall through to error below
        }
      }

      if (!cancelled) {
        setStatus('error');

        setMessage(
          "This verification link isn't complete or may have been altered. Please request a new one below."
        );
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  return (
    <Shell>
      {status === 'working' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />

          <p className="text-sm text-ink-500">
            Confirming…
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2
            className="h-12 w-12 text-moss-600"
            strokeWidth={1.5}
          />

          <h1 className="font-display text-lg font-bold text-ink-900">
            Email verified
          </h1>

          <p className="text-sm text-ink-500">
            {message} You can continue to FlowBiz now.
          </p>

          <Link to="/" className="btn-primary w-full">
            Continue to FlowBiz
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="font-display text-lg font-bold text-ink-900">
            This verification link isn't valid
          </h1>

          <p className="text-sm text-ink-500">
            {message}
          </p>

          <div className="flex flex-col gap-2">
            <button
              className="btn-primary w-full"
              onClick={handleRequestNewEmail}
              disabled={resending}
            >
              {resending
                ? 'Sending…'
                : 'Request a new verification email'}
            </button>

            <Link
              to="/login"
              className="btn-outline w-full"
            >
              Go to sign in
            </Link>
          </div>
        </>
      )}
    </Shell>
  );
}

function ResetPasswordPanel({ oobCode }) {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!oobCode) {
      setStatus('error');
      setMessage(
        'This link is missing required information. Please request a new password reset email.'
      );
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        if (cancelled) return;

        setEmail(verifiedEmail);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;

        const code = err.code || '';

        setStatus('error');

        setMessage(
          code === 'auth/expired-action-code'
            ? 'This reset link has expired. Please request a new one.'
            : code === 'auth/invalid-action-code'
              ? 'This reset link has already been used or is invalid. Please request a new one.'
              : 'This reset link is invalid. Please request a new one.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setMessage('');
    setSubmitting(true);

    try {
      await confirmPasswordReset(
        auth,
        oobCode,
        password
      );

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
      {status === 'checking' && (
        <>
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />

          <p className="text-sm text-ink-500">
            Checking your link…
          </p>
        </>
      )}

      {status === 'ready' && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 text-left"
        >
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-ink-900">
              Choose a new password
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              for{' '}
              <span className="font-semibold">
                {email}
              </span>
            </p>
          </div>

          {message && (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">
              {message}
            </div>
          )}

          <div>
            <label className="label">
              New password
            </label>

            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="At least 6 characters"
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div>
            <label className="label">
              Confirm new password
            </label>

            <input
              type="password"
              className="input"
              required
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting}
          >
            {submitting
              ? 'Saving…'
              : 'Save new password'}
          </button>
        </form>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2
            className="h-12 w-12 text-moss-600"
            strokeWidth={1.5}
          />

          <h1 className="font-display text-lg font-bold text-ink-900">
            Password updated
          </h1>

          <p className="text-sm text-ink-500">
            You can now sign in with your new password.
          </p>

          <Link
            to="/login"
            className="btn-primary w-full"
          >
            Go to sign in
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle
            className="h-12 w-12 text-rust-500"
            strokeWidth={1.5}
          />

          <h1 className="font-display text-lg font-bold text-ink-900">
            Something went wrong
          </h1>

          <p className="text-sm text-ink-500">
            {message}
          </p>

          <Link
            to="/login"
            className="btn-outline w-full"
          >
            Go to sign in
          </Link>
        </>
      )}
    </Shell>
  );
}