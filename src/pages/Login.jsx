import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { isDemoMode } from '../demo/demoMode';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../demo/localAuth';
import AuthShell from '../components/common/AuthShell';
import ErrorBanner from '../components/common/ErrorBanner';
export default function Login() {
  const { login, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // SIGNING OUT OF THE DEMO MUST NOT BE A TRAPDOOR. There is no account
  // behind the demo, so any credentials get you back in — but a visitor
  // has no way of knowing that, and an empty form is a dead end. The
  // boxes are filled in and the reason is stated above them.
  const demo = isDemoMode();
  const [email, setEmail]     = useState(demo ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(demo ? DEMO_PASSWORD : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);
const LOCKOUT_SCHEDULE = [60, 300, 900, 1800, 3600]; // 1m → 5m → 15m → 30m → 1h, then stays at 1h
const LOCKOUT_KEY = 'flowbiz_login_lockout';

function readLockout() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || 'null'); } catch { return null; }
}
function writeLockout(state) {
  try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state)); } catch { /* private mode or a full quota: the lockout is a courtesy, not a control */ }
}
  useEffect(() => {
    if (firebaseUser) navigate(location.state?.from?.pathname || '/', { replace: true });
  }, [firebaseUser, navigate, location]);

const [lockoutSeconds, setLockoutSeconds] = useState(0);

useEffect(() => {
  const saved = readLockout();
  if (saved?.until) {
    const remaining = Math.ceil((saved.until - Date.now()) / 1000);
    if (remaining > 0) setLockoutSeconds(remaining);
  }
}, []);

useEffect(() => {
  if (lockoutSeconds <= 0) return;
  const t = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
  return () => clearTimeout(t);
}, [lockoutSeconds]);

  const handle = async e => {
    e.preventDefault(); setError(null); setSubmitting(true);
try {
  await login(email.trim(), password);
  toast.success('Welcome back.');
}
catch (err) {
  if (
    err.code === 'auth/invalid-credential' ||
    err.code === 'auth/wrong-password' ||
     err.code === 'auth/user-not-found' ||
   err.code === 'auth/invalid-email'
  ) {
    setError('Incorrect email or password.');
 } else if (err.code === 'auth/too-many-requests') {
  const saved = readLockout();
  const level = Math.min((saved?.level ?? -1) + 1, LOCKOUT_SCHEDULE.length - 1);
  const seconds = LOCKOUT_SCHEDULE[level];
  writeLockout({ level, until: Date.now() + seconds * 1000 });
  setLockoutSeconds(seconds);
  setError('Too many attempts. Please wait before trying again.');
} else if (err.code === 'auth/user-disabled') {
   setError('This account has been disabled. Please contact your business owner.');
   
  } else {
    setError('Something went wrong signing in. Please try again.');
  }
}
finally {
  setSubmitting(false);
}
  };

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back to your counter."
      footer={<>New to FlowBiz? <Link to="/setup" className="font-medium text-white underline underline-offset-2">Create a business</Link></>}
    >
        <form onSubmit={handle} className="space-y-4">
          <ErrorBanner message={error} />
          {demo && (
            <p className="rounded-panel border border-line bg-canvas p-3 text-secondary text-ink-600">
              This is the FlowBiz demo. The sign-in below is already filled in — press
              Sign in to go back to the demo business.
            </p>
          )}
          <div><label className="label">Email</label><input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" /></div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Password</label>
              <Link to="/forgot-password" className="mb-1 text-secondary font-medium text-primary-700 hover:underline">Forgot password?</Link>
            </div>
            <input type="password" required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
          </div>

<button type="submit" className="btn-primary w-full" disabled={submitting || lockoutSeconds > 0}>
  {lockoutSeconds > 0 ? `Try again in ${lockoutSeconds}s` : submitting ? 'Signing in…' : 'Sign in'}
</button>
        </form>
    </AuthShell>
  );
}