import { useState } from 'react';
import { Link } from 'react-router-dom';
const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

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
    const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!response.ok) throw new Error('request-failed');
    setSent(true);
  } catch (err) {
    console.error('[FlowBiz] send-password-reset failed:', err.message);
    setError("Couldn't send the reset email. Please try again in a moment.");
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