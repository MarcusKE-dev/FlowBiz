// src/pages/admin/AdminLogin.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, ShieldAlert, ArrowLeft, Clock } from 'lucide-react';

const ADMIN_LOCKOUT_KEY = 'flowbiz_admin_login_lockout';

// Tiered Progressive Lockout Schedule (in seconds)
// 3 fails -> 5m (300s) | 5 fails -> 30m (1800s) | 7 fails -> 2h (7200s) | 10+ fails -> 24h (86400s)
function getLockoutSeconds(failedCount) {
  if (failedCount >= 10) return 86400; // 24 hours (1 day)
  if (failedCount >= 7) return 7200;   // 2 hours
  if (failedCount >= 5) return 1800;   // 30 minutes
  if (failedCount >= 3) return 300;    // 5 minutes
  return 0;
}

function readLockoutState() {
  try {
    const raw = localStorage.getItem(ADMIN_LOCKOUT_KEY);
    return raw ? JSON.parse(raw) : { failedAttempts: 0, lockoutUntil: 0 };
  } catch {
    return { failedAttempts: 0, lockoutUntil: 0 };
  }
}

function writeLockoutState(state) {
  try {
    localStorage.setItem(ADMIN_LOCKOUT_KEY, JSON.stringify(state));
  } catch {
    // Ignore if storage restricted
  }
}

function formatRemainingTime(seconds) {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [remainingLockout, setRemainingLockout] = useState(0);

  // Initialize and check persistent lockout state
  useEffect(() => {
    const state = readLockoutState();
    setFailedAttempts(state.failedAttempts || 0);

    const now = Date.now();
    if (state.lockoutUntil && state.lockoutUntil > now) {
      setRemainingLockout(Math.ceil((state.lockoutUntil - now) / 1000));
    }
  }, []);

  // 1-second countdown timer when locked out
  useEffect(() => {
    if (remainingLockout <= 0) return;
    const timer = setInterval(() => {
      setRemainingLockout((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingLockout]);

  const isLockedOut = remainingLockout > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut) return;

    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);

      // Reset failed attempts on successful login
      localStorage.removeItem(ADMIN_LOCKOUT_KEY);
      setFailedAttempts(0);
      setRemainingLockout(0);

      toast.success('Signed in.');
      navigate('/admin', { replace: true });
    } catch (err) {
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);

      const lockoutSec = getLockoutSeconds(nextFailed);
      const lockoutUntil = lockoutSec > 0 ? Date.now() + lockoutSec * 1000 : 0;

      writeLockoutState({ failedAttempts: nextFailed, lockoutUntil });

      if (lockoutSec > 0) {
        setRemainingLockout(lockoutSec);
        setError(
          `Security Lockout: Too many failed login attempts (${nextFailed}). Access is suspended for ${formatRemainingTime(
            lockoutSec
          )}.`
        );
      } else {
        const attemptsLeft = 3 - nextFailed;
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          setError(
            `Invalid admin email or password. (${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) before temporary lockout` : 'Warning: further failures will trigger security lockout'})`
          );
        } else {
          setError('Authentication failed. Please check your connection and credentials.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-deep-900 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          {isLockedOut
            ? <ShieldAlert className="mx-auto h-6 w-6 text-white/80" strokeWidth={1.75} aria-hidden="true" />
            : <ShieldCheck className="mx-auto h-6 w-6 text-white/80" strokeWidth={1.75} aria-hidden="true" />}
          <p className="mt-3 font-display text-page-title font-semibold text-white">
            FlowBiz control centre
          </p>
          <p className="mt-1 text-secondary text-white/60">Platform administrator sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-panel bg-surface p-6">
          {/* Active Security Lockout Banner */}
          {isLockedOut && (
            <div className="rounded-panel border border-danger-200 bg-danger-50 p-4 text-secondary font-semibold text-danger-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-danger-900">
                <Clock className="h-4 w-4 text-danger-600 animate-spin" />
                <span>Signing in is locked</span>
              </div>
              <p>
                Too many invalid password attempts. Login has been locked for your protection.
              </p>
              <p className="font-mono text-body font-black text-danger-900 pt-1">
                Time remaining: {formatRemainingTime(remainingLockout)}
              </p>
            </div>
          )}

          {error && !isLockedOut && (
            <div className="rounded-panel border border-danger-200 bg-danger-50 px-3 py-2 text-secondary font-medium text-danger-700">
              {error}
            </div>
          )}

          <div>
            <label className="label">Admin email</label>
            <input
              type="email"
              required
              disabled={isLockedOut || submitting}
              className="input disabled:bg-ink-50 disabled:text-ink-400"
              placeholder=""
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus={!isLockedOut}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              disabled={isLockedOut || submitting}
              className="input disabled:bg-ink-50 disabled:text-ink-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || isLockedOut}
          >
            {isLockedOut
              ? `Locked (${formatRemainingTime(remainingLockout)})`
              : submitting
              ? 'Authenticating…'
              : 'Sign in as administrator'}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-body font-medium text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Back to merchant sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}