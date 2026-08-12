import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      setSent(true);
    } catch (err) {
      const message =
        err.code === 'auth/invalid-email'      ? 'Please enter a valid email address.' :
        err.code === 'auth/too-many-requests'  ? 'Too many requests. Please wait a bit before trying again.' :
        null;
      if (message) {
        setError(message);
      } else {
        // auth/user-not-found and anything else: show the same success
        // state as a real send, so this page can't be used to probe
        // which emails have accounts.
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Reset your password</h1>
            <p className="text-sm text-ink-400">Enter your account email and we'll send you a reset link.</p>
          </div>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-3">
            <div className="text-3xl">📧</div>
            <p className="text-sm text-ink-600">If an account exists for <span className="font-semibold">{email.trim()}</span>, a password reset link is on its way. Check your inbox (and spam folder).</p>
            <Link to="/login" className="btn-primary w-full">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-400">
          Remembered it? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}