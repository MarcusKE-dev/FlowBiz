import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
export default function Login() {
  const { login, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (firebaseUser) navigate(location.state?.from?.pathname || '/', { replace: true });
  }, [firebaseUser, navigate, location]);

  const [lockoutSeconds, setLockoutSeconds] = useState(0);

useEffect(() => {
  if (lockoutSeconds <= 0) return;
  const t = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
  return () => clearTimeout(t);
}, [lockoutSeconds]);

  const handle = async e => {
    e.preventDefault(); setError(null); setSubmitting(true);
try {
  await login(email.trim(), password);
  toast.success('Welcome back!');
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
  setLockoutSeconds(60); // Firebase's own backoff grows with repeated failures; 60s is a sane first step
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
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div><h1 className="font-display text-2xl font-bold text-white">FlowBiz</h1><p className="text-sm text-ink-400">Business Manager</p></div>
        </div>
        <form onSubmit={handle} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Email</label><input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" /></div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-moss-400 hover:underline mb-1.5">Forgot password?</Link>
            </div>
            <input type="password" required className="input" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
          </div>

<button type="submit" className="btn-primary w-full" disabled={submitting || lockoutSeconds > 0}>
  {lockoutSeconds > 0 ? `Try again in ${lockoutSeconds}s` : submitting ? 'Signing in…' : 'Sign in'}
</button>        </form>
        <p className="text-center text-sm text-ink-400">New to FlowBiz? <Link to="/setup" className="font-semibold text-moss-400 hover:underline">Create a business</Link></p>
      </div>
    </div>
  );
}