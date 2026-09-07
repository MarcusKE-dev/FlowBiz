
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import {
  doc,
  collection,
  writeBatch,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import AuthShell from '../components/common/AuthShell';
import ErrorBanner from '../components/common/ErrorBanner';
import { useAuth } from '../contexts/AuthContext';
import {
  signupProfilesByFamily,
  resolveSignupProfile,
  DEFAULT_PROFILE_ID,
} from '../industry/profiles';

const FLOWBIZ_API_URL =
  import.meta.env.VITE_FLOWBIZ_API_URL ||
  'https://flowbiz-api.flowbiz.workers.dev';

export default function Setup() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (
      firebaseUser &&
      profile?.businessId &&
      !creatingRef.current
    ) {
      navigate(
        profile.role === 'owner' ? '/dashboard' : '/counter',
        { replace: true }
      );
    }
  }, [firebaseUser, profile, authLoading, navigate]);

  const [businessName, setBusinessName] = useState('');
  const [industryProfile, setIndustryProfile] =
    useState(DEFAULT_PROFILE_ID);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Enter your business name.');
      return;
    }

    if (!displayName.trim()) {
      setError('Enter your name.');
      return;
    }

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

    let targetUser;

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      targetUser = cred.user;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password
          );

          const existingProfileSnap = await getDoc(
            doc(db, 'users', signInCred.user.uid)
          );

          if (
            existingProfileSnap.exists() &&
            existingProfileSnap.data()?.businessId
          ) {
            setError(
              'An account with this email already exists. Please sign in instead.'
            );

            creatingRef.current = false;
            setSubmitting(false);
            return;
          }

          targetUser = signInCred.user;
        } catch {
          setError(
            'An account with this email already exists. Please sign in or use another email.'
          );

          creatingRef.current = false;
          setSubmitting(false);
          return;
        }
      } else {
        const message =
          err.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : err.code === 'auth/weak-password'
              ? 'Password is too weak. Please choose a stronger password.'
              : 'Could not create your account. Please try again.';

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
        subscription: {
          plan: 'free',
          status: 'active',
          expiresAt: null,
        },
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
        industryProfile: resolveSignupProfile(industryProfile),
        capabilityOverrides: {},
      });

      await batch.commit();
    } catch (err) {
      console.error(
        '[FlowBiz] Business setup write failed:',
        err.code || err.name,
        err.message
      );

      setError(
        'Something went wrong setting up your business records. Please try again.'
      );

      creatingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await targetUser.getIdToken(true);

      const response = await fetch(
        `${FLOWBIZ_API_URL}/api/auth/send-verification-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('worker-send-failed');
      }

      toast.success(
        `Welcome to FlowBiz, ${displayName.trim()}! Please check your email to verify your account.`
      );
    } catch (err) {
      console.warn(
        '[FlowBiz] Worker email send failed, attempting direct send:',
        err.message
      );

      try {
        await sendEmailVerification(targetUser);

        toast.success(
          `Welcome to FlowBiz, ${displayName.trim()}! Check your email to verify.`
        );
      } catch {
        toast.success(
          `Welcome to FlowBiz, ${displayName.trim()}!`
        );
      }
    }

    setSubmitting(false);
    navigate('/', { replace: true });
  };

  if (authLoading && !creatingRef.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-deep-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <AuthShell
      title="Create your business"
      description="Setting up takes about a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-white underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorBanner message={error} />

        <div>
          <label className="label">Business name</label>
          <input
            className="input"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Nairobi Smart Retail"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Business type</label>
          <select
            className="input"
            value={industryProfile}
            onChange={(e) => setIndustryProfile(e.target.value)}
            disabled={submitting}
          >
            {signupProfilesByFamily().map((family) => (
              <optgroup key={family.id} label={family.label}>
                {family.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Your name</label>
          <input
            className="input"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Doe"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@yourbusiness.co.ke"
            autoComplete="username"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 chars (upper, lower, number)"
            autoComplete="new-password"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input
            type="password"
            className="input"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            disabled={submitting}
          />
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submitting}
        >
          {submitting ? 'Setting up…' : 'Create business'}
        </button>

        <p className="pt-2 text-center text-sm leading-relaxed !text-black">
          By creating a business, you agree to the{' '}
          <Link
            to="/terms"
            className="font-semibold !text-black underline underline-offset-2 hover:opacity-70"
          >
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link
            to="/privacy"
            className="font-semibold !text-black underline underline-offset-2 hover:opacity-70"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
