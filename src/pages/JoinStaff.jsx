import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

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
        if (!snap.exists()) { setNotFound(true); setChecking(false); return; }
        setInvite({ id: snap.id, ...snap.data() });
      } catch (err) {
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

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);

    let freshSnap;
    try {
      freshSnap = await getDoc(doc(db, 'staffInvites', inviteId));
      if (!freshSnap.exists()) throw new Error('This invite is no longer valid.');
      if (freshSnap.data().claimed) throw new Error('This invite has already been used.');
    } catch (err) {
      setError(err.message || 'This invite could not be validated. Please try again.');
      setSubmitting(false);
      return;
    }
    const { businessId, role, displayName } = freshSnap.data();

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const message =
        err.code === 'auth/email-already-in-use' ? "An account with this email already exists." :
        err.code === 'auth/invalid-email'        ? 'Please enter a valid email address.' :
        err.code === 'auth/weak-password'         ? 'Password is too weak.' :
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
        createdAt: serverTimestamp(),
        claimedFromInviteId: inviteId,
      });
      batch.update(doc(db, 'staffInvites', inviteId), {
        claimed: true,
        linkedUid: cred.user.uid,
        claimedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.error('[JoinStaff] Firestore registration failed after Auth account creation — rolling back:', err.code || err.name, err.message);
      try {
        await deleteUser(cred.user);
      } catch (rollbackErr) {
        console.error('[JoinStaff] Rollback failed — an orphaned Auth account may remain:', rollbackErr);
        setError('Something went wrong finishing your signup, and we could not fully undo it. Please contact your business owner before trying again with this email.');
        setSubmitting(false);
        return;
      }
      setError('Something went wrong finishing your signup. Please try again.');
      setSubmitting(false);
      return;
    }

    // FIX: handleCodeInApp: true routes the verification link through
    // FlowBiz's own /auth/action page instead of Firebase's generic
    // hosted page.
    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      toast.success(`Welcome, ${displayName}! Check your email to verify your account.`);
    } catch (err) {
      console.error('[JoinStaff] sendEmailVerification failed after successful signup:', err.code || err.name, err.message);
      toast.success(
        err.code === 'auth/too-many-requests'
          ? `Welcome, ${displayName}! Your account was created, but too many verification emails have been requested. Use "Resend verification email" in a bit.`
          : `Welcome, ${displayName}! Your account was created, but we couldn't send the verification email. You can request a new one once you're signed in.`,
        { duration: 6000 }
      );
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
          <p className="text-sm text-ink-500">This link may be wrong, or the invite was cancelled. Ask whoever invited you for a fresh link.</p>
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
          <h1 className="font-display text-lg font-bold text-ink-900">This invite has already been used</h1>
          <p className="text-sm text-ink-500">If this is you, sign in with the email and password you already set.</p>
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
            <p className="text-sm text-ink-400">You've been invited as {roleLabel}. Set up your sign-in below.</p>
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
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
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