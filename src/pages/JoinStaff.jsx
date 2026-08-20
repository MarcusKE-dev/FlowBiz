// src/pages/JoinStaff.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export function validatePassword(password) {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export default function JoinStaff() {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [invite, setInvite]     = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'staffInvites', inviteId));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          setChecking(false);
          return;
        }
        setInvite({ id: snap.id, ...snap.data() });
      } catch {
        setNotFound(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    let freshSnap;
    try {
      freshSnap = await getDoc(doc(db, 'staffInvites', inviteId));
      if (!freshSnap.exists()) throw new Error('This invite is no longer valid.');
      if (freshSnap.data().claimed) throw new Error('This invite has already been used.');
    } catch (validationErr) {
      setError(validationErr.message || 'This invite could not be validated. Please try again.');
      setSubmitting(false);
      return;
    }
    const { businessId, role, displayName } = freshSnap.data();

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (authErr) {
      const message =
        authErr.code === 'auth/email-already-in-use' ? "An account with this email already exists." :
        authErr.code === 'auth/invalid-email'        ? 'Please enter a valid email address.' :
        authErr.code === 'auth/weak-password'         ? 'Password should be at least 8 characters with upper, lower, and numbers.' :
        'Could not create your account. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        displayName,
        role,
        businessId,
        active: true,
        createdAt: new Date(),
        claimedFromInviteId: inviteId,
      });
      batch.update(doc(db, 'staffInvites', inviteId), {
        claimed: true,
        linkedUid: cred.user.uid,
        claimedAt: new Date(),
      });
      await batch.commit();
    } catch (dbErr) {
      console.error('[JoinStaff] Firestore write failed:', dbErr);
      try { await deleteUser(cred.user); } catch {}
      setError('Something went wrong completing your signup. Please contact your business owner.');
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await cred.user.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('send-verification-failed');
      toast.success(`Welcome, ${displayName}! Check your email to verify your account.`);
    } catch {
      toast.success(`Welcome, ${displayName}! Your account was created.`);
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4"><p className="text-sm text-ink-400">Checking invite…</p></div>;

  if (notFound || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">🔗</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Invite not found</h1>
          <p className="text-sm text-ink-500">This link may be invalid or was cancelled by the business owner.</p>
          <Link to="/login" className="btn-outline w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (invite.claimed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm card p-6 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <h1 className="font-display text-lg font-bold text-ink-900">Invite Already Claimed</h1>
          <p className="text-sm text-ink-500">Please sign in with your email and password.</p>
          <Link to="/login" className="btn-primary w-full">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const roleLabel = invite.role === 'owner' ? 'an owner' : 'a cashier';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Welcome, {invite.displayName}</h1>
            <p className="text-sm text-ink-400">You have been invited as {roleLabel}.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}

          <div>
            <label className="label">Your email</label>
            <input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
          </div>
          <div>
            <label className="label">Choose a password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 chars (upper, lower, number)" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up…' : 'Create my sign-in'}
          </button>
        </form>
      </div>
    </div>
  );
}