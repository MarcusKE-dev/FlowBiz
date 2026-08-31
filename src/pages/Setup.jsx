import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, collection, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_CATEGORIES = ['Beverages', 'Hardware', 'Household', 'Personal Care', 'Stationery', 'Airtime/Float', 'Other'];
const FLOWBIZ_API_URL = import.meta.env.VITE_FLOWBIZ_API_URL || 'https://flowbiz-api.flowbiz.workers.dev';

export default function Setup() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (firebaseUser && profile?.businessId && !creatingRef.current) {
      navigate(profile.role === 'owner' ? '/dashboard' : '/counter', { replace: true });
    }
  }, [firebaseUser, profile, authLoading, navigate]);

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
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must include at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must include at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must include at least one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    creatingRef.current = true;

    let targetUser = null;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      targetUser = cred.user;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
          const existingProfileSnap = await getDoc(doc(db, 'users', signInCred.user.uid));
          if (existingProfileSnap.exists() && existingProfileSnap.data()?.businessId) {
            setError('An account with this email already exists. Please sign in instead.');
            creatingRef.current = false;
            setSubmitting(false);
            return;
          }
          targetUser = signInCred.user;
        } catch {
          setError('An account with this email already exists. Please sign in or use another email.');
          creatingRef.current = false;
          setSubmitting(false);
          return;
        }
      } else {
        const message =
          err.code === 'auth/invalid-email' ? 'Please enter a valid email address.' :
          err.code === 'auth/weak-password'  ? 'Password is too weak. Please choose a stronger password.' :
          'Could not create your account. Please try again.';
        setError(message);
        creatingRef.current = false;
        setSubmitting(false);
        return;
      }
    }

    if (!targetUser) {
      setError('Failed to authenticate. Please try again.');
      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    const businessId = doc(collection(db, 'businesses')).id;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'businesses', businessId), {
        name: businessName.trim(),
        ownerIds: [targetUser.uid],
        createdAt: serverTimestamp(),
        createdBy: targetUser.uid,
        subscription: { plan: 'free', status: 'active', expiresAt: null },
      });
      batch.set(doc(db, 'users', targetUser.uid), {
        uid: targetUser.uid,
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'owner',
        businessId,
        active: true,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'businessSettings', businessId), {
        businessId,
        shopName: businessName.trim(),
        cashierCanRecordExpenses: true,
        categories: DEFAULT_CATEGORIES,
      });
      await batch.commit();
    } catch (err) {
      console.error('[FlowBiz] Business setup write failed:', err.code || err.name, err.message);
      setError('Something went wrong setting up your business records. Please try again.');
      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await targetUser.getIdToken(true);
      const response = await fetch(`${FLOWBIZ_API_URL}/api/auth/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) throw new Error('worker-send-failed');
      toast.success(`Welcome to FlowBiz, ${displayName.trim()}! Please check your email to verify your account.`);
    } catch (err) {
      console.warn('[FlowBiz] Worker email send failed, attempting direct send:', err.message);
      try {
        await sendEmailVerification(targetUser);
        toast.success(`Welcome to FlowBiz, ${displayName.trim()}! Check your email to verify.`);
      } catch {
        toast.success(`Welcome to FlowBiz, ${displayName.trim()}!`);
      }
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (authLoading && !creatingRef.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <img src="/icons/icon-192.png" alt="FlowBiz" className="h-16 w-16 rounded-2xl shadow-lg" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Create your business</h1>
            <p className="text-sm text-ink-400">Set up FlowBiz in under a minute.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-lg border border-rust-200 bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</div>}
          <div>
            <label className="label">Business name</label>
            <input className="input" required value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Nairobi Smart Retail" disabled={submitting} />
          </div>
          <div>
            <label className="label">Your name</label>
            <input className="input" required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. John Doe" disabled={submitting} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@yourbusiness.co.ke" autoComplete="username" disabled={submitting} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 chars (upper, lower, number)" autoComplete="new-password" disabled={submitting} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" disabled={submitting} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Setting up…' : 'Create business'}
          </button>
        </form>
        <p className="text-center text-sm text-ink-400">
          Already have an account? <Link to="/login" className="font-semibold text-moss-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}