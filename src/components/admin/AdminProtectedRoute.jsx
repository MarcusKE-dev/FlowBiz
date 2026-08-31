import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { verifyAdminSession } from '../../utils/adminService';
import LoadingSpinner from '../common/LoadingSpinner';
import { ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';

const AdminContext = createContext(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProtectedRoute');
  return ctx;
}

export default function AdminProtectedRoute({ children }) {
  const { firebaseUser, loading: authLoading, logout } = useAuth();
  const [adminProfile, setAdminProfile] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);

  const checkAdmin = async () => {
    if (!firebaseUser) {
      setVerifying(false);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const admin = await verifyAdminSession();
      setAdminProfile(admin);
    } catch (err) {
      setError(err.message || 'Access denied: You do not have platform admin privileges.');
      setAdminProfile(null);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      checkAdmin();
    }
  }, [firebaseUser, authLoading]);

  if (authLoading || verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        <LoadingSpinner label="Verifying platform administrator authorization…" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/admin/login" replace />;
  }

  if (error || !adminProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="card max-w-md w-full p-6 text-center space-y-4 shadow-xl border-rust-200">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-rust-50 text-rust-600 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" strokeWidth={2} />
          </div>
          <h2 className="font-display text-lg font-bold text-ink-900">Access Restricted</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            {error || 'This area is reserved for authorized FlowBiz platform administrators. Your account does not have platform-level administrative rights.'}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={checkAdmin}>
              <RefreshCw className="h-4 w-4" /> Retry Verification
            </button>
            <Link to="/dashboard" className="btn-outline w-full flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Return to Merchant Dashboard
            </Link>
            <button type="button" className="text-xs text-ink-400 hover:underline pt-1" onClick={logout}>
              Sign out of this account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider
      value={{
        admin: adminProfile,
        isSuperAdmin: adminProfile.role === 'SUPER_ADMIN',
        role: adminProfile.role,
        refreshAdmin: checkAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}