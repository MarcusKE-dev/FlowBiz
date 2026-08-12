import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { auth } from '../firebase';

// With handleCodeInApp: true (see Setup.jsx / JoinStaff.jsx
// actionCodeSettings), clicking the verification link lands HERE — on
// FlowBiz's own domain with FlowBiz's own styling — instead of on
// Firebase's generic hosted verification page. This does not change
// which address the email is sent FROM (that's a Console/SMTP setting),
// but it fully brands everything the person actually sees and clicks.
export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [status, setStatus] = useState('working'); // working | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!oobCode) {
      setStatus('error');
      setMessage('This link is missing required information. Please request a new verification email.');
      return;
    }

    if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => {
          setStatus('success');
          setMessage('Your email has been verified.');
        })
        .catch((err) => {
          setStatus('error');
          const code = err.code || '';
          setMessage(
            code === 'auth/expired-action-code' ? 'This verification link has expired. Please request a new one from the app.' :
            code === 'auth/invalid-action-code'  ? "This verification link has already been used or is invalid. If you're already verified, just sign in." :
            "We couldn't verify your email. Please request a new verification link."
          );
        });
      return;
    }

    // Other action types (password reset, email recovery, etc.) aren't
    // wired up in FlowBiz yet — show a clear message instead of a blank
    // screen if one of those links ever lands here.
    checkActionCode(auth, oobCode)
      .then(() => {
        setStatus('error');
        setMessage("This type of link isn't supported yet. Please contact support.");
      })
      .catch(() => {
        setStatus('error');
        setMessage('This link is invalid or has expired.');
      });
  }, [mode, oobCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm card p-6 text-center space-y-4">
        <img src="/icons/icon-192.png" alt="FlowBiz" className="mx-auto h-14 w-14 rounded-2xl shadow-lg" />
        {status === 'working' && (
          <>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
            <p className="text-sm text-ink-500">Confirming…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="font-display text-lg font-bold text-ink-900">Email verified</h1>
            <p className="text-sm text-ink-500">{message} You can now sign in to FlowBiz.</p>
            <Link to="/login" className="btn-primary w-full">Continue to sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">⚠️</div>
            <h1 className="font-display text-lg font-bold text-ink-900">Something went wrong</h1>
            <p className="text-sm text-ink-500">{message}</p>
            <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}