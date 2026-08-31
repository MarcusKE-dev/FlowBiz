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

      toast.success('Administrator authenticated.');
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
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-ink-900 border border-ink-700 text-white flex items-center justify-center shadow-xl">
            {isLockedOut ? (
              <ShieldAlert className="h-8 w-8 text-rust-400 animate-pulse" strokeWidth={2} />
            ) : (
              <ShieldCheck className="h-8 w-8 text-moss-400" strokeWidth={2} />
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">FlowBiz Control Center</h1>
            <p className="text-sm text-ink-400">Platform Administrator Sign-In</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6 bg-white border border-ink-800 shadow-2xl">
          {/* Active Security Lockout Banner */}
          {isLockedOut && (
            <div className="rounded-xl border border-rust-200 bg-rust-50 p-4 text-xs font-semibold text-rust-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rust-900">
                <Clock className="h-4 w-4 text-rust-600 animate-spin" />
                <span>Security Lockout Active</span>
              </div>
              <p>
                Too many invalid password attempts. Login has been locked for your protection.
              </p>
              <p className="font-mono text-sm font-black text-rust-900 pt-1">
                Time remaining: {formatRemainingTime(remainingLockout)}
              </p>
            </div>
          )}

          {error && !isLockedOut && (
            <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-xs font-medium text-rust-700">
              {error}
            </div>
          )}

          <div>
            <label className="label">Admin Email</label>
            <input
              type="email"
              required
              disabled={isLockedOut || submitting}
              className="input disabled:bg-ink-50 disabled:text-ink-400"
              placeholder="admin@flowbiz.co.ke"
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
            className="btn-primary w-full !bg-ink-900 hover:!bg-ink-950 disabled:opacity-40"
            disabled={submitting || isLockedOut}
          >
            {isLockedOut
              ? `Locked (${formatRemainingTime(remainingLockout)})`
              : submitting
              ? 'Authenticating…'
              : 'Sign In as Administrator'}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Merchant Login
          </Link>
        </div>
      </div>
    </div>
  );
}