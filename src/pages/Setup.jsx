// src/pages/Setup.jsx — replace the entire file
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, collection, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = ['Groceries', 'Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];

export default function Setup() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // Firestore rules can only see a doc created earlier IN THE SAME batch
  // via getAfter() — a plain get()/exists() check (which is what
  // businessSettings' write rule uses via isOwner()) only sees the
  // pre-batch state. So the user profile must be written and committed
  // FIRST, as its own step, before businessSettings is written.
  const creatingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    // Bounce an already-signed-in visitor away — but never while THIS
    // component's own signup flow is what just signed them in, or this
    // fires the instant the Auth account is created and cuts the flow
    // short before Firestore writes / the verification email are sent.
    if (firebaseUser && !creatingRef.current) {
      navigate('/', { replace: true });
    }
  }, [firebaseUser, authLoading, navigate]);

  const [businessName, setBusinessName] = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) { setError('Enter your business name.'); return; }
    if (!displayName.trim()) { setError('Enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    creatingRef.current = true;

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      creatingRef.current = false;
      const message =
        err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' :
        err.code === 'auth/invalid-email'        ? 'Please enter a valid email address.' :
        err.code === 'auth/weak-password'         ? 'Password is too weak.' :
        'Could not create your account. Please try again.';
      setError(message);
      setSubmitting(false);
      return;
    }

    const businessId = doc(collection(db, 'businesses')).id;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'businesses', businessId), {
        name: businessName.trim(),
        ownerIds: [cred.user.uid],
        createdAt: serverTimestamp(),
        createdBy: cred.user.uid,
        subscription: { plan: 'free', status: 'active', expiresAt: null },
      });
      batch.set(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'owner',
        businessId,
        active: true,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      console.error('[FlowBiz] Business setup failed — rolling back Auth account:', err.code || err.name, err.message);
      try {
        await deleteUser(cred.user);
      } catch (rollbackErr) {
        console.error('[FlowBiz] Rollback failed — an orphaned Auth account may remain:', rollbackErr);
        setError('Something went wrong finishing setup, and we could not fully undo it. Please contact support before retrying with this email.');
        creatingRef.current = false;
        setSubmitting(false);
        return;
      }
      setError('Something went wrong setting up your business. Please try again.');
      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    // Non-critical, so it doesn't roll back the whole account if it's
    // ever slow or briefly fails — useSettings.js and ProductFormModal.jsx
    // both already default gracefully when this doc doesn't exist yet.
    try {
      await setDoc(doc(db, 'businessSettings', businessId), {
        shopName: businessName.trim(),
        cashierCanRecordExpenses: true,
        categories: DEFAULT_CATEGORIES,
      });
    } catch (err) {
      console.error('[FlowBiz] businessSettings write failed (non-fatal):', err.code || err.name, err.message);
    }

    try {
      await sendEmailVerification(cred.user, { url: `${window.location.origin}/auth/action`, handleCodeInApp: true });
      toast.success(`Welcome to FlowBiz, ${displayName.trim()}! Check your email to verify your account.`);
    } catch (err) {
      console.error('[FlowBiz] sendEmailVerification failed after setup:', err.code || err.name, err.message);
      toast.success(`Welcome to FlowBiz, ${displayName.trim()}!`);
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Create your business</h1>
            <p className="text-sm text-ink-400">Set up FlowBiz in a couple of minutes.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div><label className="label">Business name</label><input className="input" required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="" disabled={submitting} /></div>
          <div><label className="label">Your name</label><input className="input" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Full name" disabled={submitting} /></div>
          <div><label className="label">Email</label><input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@yourbusiness.co.ke" autoComplete="username" disabled={submitting} /></div>
          <div><label className="label">Password</label><input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="" autoComplete="new-password" disabled={submitting} /></div>
          <div><label className="label">Confirm password</label><input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={submitting} /></div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Setting up…' : 'Create business'}</button>
        </form>
        <p className="text-center text-sm text-ink-400">Already have an account? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}