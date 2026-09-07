import { MailCheck } from 'lucide-react';
import AuthShell from '../components/common/AuthShell';
import ErrorBanner from '../components/common/ErrorBanner';
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
    <AuthShell
      title={sent ? 'Check your email' : 'Reset your password'}
      description={sent ? null : "Enter your account email and we'll send you a reset link."}
      footer={<>Remembered it? <Link to="/login" className="font-medium text-white underline underline-offset-2">Sign in</Link></>}
    >
      {sent ? (
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto h-5 w-5 text-ink-500" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-body text-ink-600">
            If an account exists for <span className="font-semibold text-ink-900">{email.trim()}</span>,
            a reset link is on its way. Check your inbox, and your spam folder.
          </p>
          <Link to="/login" className="btn-primary w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorBanner message={error} />
          <div>
            <label className="label" htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" required className="input" placeholder="owner@yourbusiness.co.ke" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}