import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';

export default function Setup() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName]       = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const message =
        err.code === 'auth/email-already-in-use' ? "An account with this email already exists in Firebase Authentication. If it was used for a business before, sign in with that account instead — the current system can't reuse the exact same email for a brand-new business." :
        err.code === 'auth/invalid-email'         ? 'Please enter a valid email address.' :
        err.code === 'auth/weak-password'          ? 'Password is too weak.' :
        'Could not create your account. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    const businessRef = doc(collection(db, 'businesses'));
    const userRef      = doc(db, 'users', cred.user.uid);
    try {
      await runTransaction(db, async (tx) => {
        tx.set(businessRef, {
          name: businessName.trim(),
          ownerIds: [cred.user.uid],
          createdAt: serverTimestamp(),
          createdBy: cred.user.uid,
          subscription: { plan: 'free', status: 'active', expiry: null },
        });
        tx.set(userRef, {
          uid: cred.user.uid,
          email: email.trim(),
          displayName: ownerName.trim(),
          role: 'owner',
          businessId: businessRef.id,
          active: true,
          createdAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.error('[Setup] Business/profile creation failed after Auth account creation — rolling back:', err.code || err.name, err.message);
      try {
        await deleteUser(cred.user);
      } catch (rollbackErr) {
        console.error('[Setup] Rollback failed — an orphaned Auth account may remain:', rollbackErr);
        setError('Something went wrong finishing setup, and we could not fully undo it. Please contact support before trying again with this email.');
        setSubmitting(false);
        return;
      }
      setError('Something went wrong finishing setup. Please try again.');
      setSubmitting(false);
      return;
    }

    // FIX: handleCodeInApp: true routes the verification link through
    // FlowBiz's own /auth/action page instead of Firebase's generic
    // hosted page — see src/pages/AuthAction.jsx.
    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      });
      toast.success(`Welcome, ${ownerName.trim()}! Check your email to verify your account.`);
    } catch (err) {
      console.error('[Setup] sendEmailVerification failed after successful setup:', err.code || err.name, err.message);
      toast.success(
        err.code === 'auth/too-many-requests'
          ? `Welcome, ${ownerName.trim()}! Your business was created, but too many verification emails have been requested. Use "Resend verification email" in a bit.`
          : `Welcome, ${ownerName.trim()}! Your business was created, but we couldn't send the verification email. You can request a new one once you're signed in.`,
        { duration: 6000 }
      );
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Create your business</h1>
            <p className="text-sm text-ink-400">Set up a new FlowBiz account for your shop</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Business name</label><input className="input" required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Mama Njeri General Store" autoComplete="organization" /></div>
          <div><label className="label">Your name</label><input className="input" required value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="e.g. Jane Njeri" autoComplete="name" /></div>
          <div><label className="label">Email</label><input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@yourbusiness.co.ke" autoComplete="username" /></div>
          <div><label className="label">Password</label><input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" /></div>
          <div><label className="label">Confirm password</label><input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Setting up…' : 'Create business account'}</button>
        </form>
        <p className="text-center text-sm text-ink-400">Already have a business? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}