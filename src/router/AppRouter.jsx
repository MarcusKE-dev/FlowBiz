import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AppShell from '../components/layout/AppShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

const Setup      = lazy(() => import('../pages/Setup'));
const Login      = lazy(() => import('../pages/Login'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const JoinStaff  = lazy(() => import('../pages/JoinStaff'));
const AuthAction = lazy(() => import('../pages/AuthAction'));
const Dashboard  = lazy(() => import('../pages/Dashboard'));
const Counter    = lazy(() => import('../pages/Counter'));
const Customers  = lazy(() => import('../pages/Customers'));
const CustomerDetail = lazy(() => import('../pages/CustomerDetail'));
const Expenses   = lazy(() => import('../pages/Expenses'));
const Purchases  = lazy(() => import('../pages/Purchases'));
const Products   = lazy(() => import('../pages/Products'));
const Suppliers  = lazy(() => import('../pages/Suppliers'));
const StockTake  = lazy(() => import('../pages/StockTake'));
const Reports    = lazy(() => import('../pages/Reports'));
const CloseDay   = lazy(() => import('../pages/CloseDay'));
const Users      = lazy(() => import('../pages/Users'));
const Settings   = lazy(() => import('../pages/Settings'));
const HelpGuide  = lazy(() => import('../pages/HelpGuide'));
const Pro        = lazy(() => import('../pages/Pro'));
const AdvancedAnalytics = lazy(() => import('../pages/AdvancedAnalytics'));
const InventoryIntelligence = lazy(() => import('../pages/InventoryIntelligence'));

function Page({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>
        <Suspense fallback={<LoadingSpinner />}>
          {children}
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  );
}

function PublicOnly({ children }) {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Starting FlowBiz…" />;
  if (firebaseUser) return <Navigate to="/" replace />;
  return children;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner label="Starting FlowBiz…" />}>
      <Routes>
        <Route path="/setup" element={<PublicOnly><Setup /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/join/:inviteId" element={<JoinStaff />} />
        {/* Not wrapped in ProtectedRoute or PublicOnly — must work
            whether the person is currently signed in or not, and covers
            both email verification and password reset links. */}
        <Route path="/auth/action" element={<AuthAction />} />

        <Route path="/"             element={<Page adminOnly><Dashboard /></Page>} />
        <Route path="/pro"          element={<Page adminOnly><Pro /></Page>} />
        <Route path="/advanced-analytics" element={<Page adminOnly><AdvancedAnalytics /></Page>} />
        <Route path="/inventory-intelligence" element={<Page adminOnly><InventoryIntelligence /></Page>} />

        <Route path="/counter"      element={<Page><Counter /></Page>} />
        <Route path="/customers"    element={<Page><Customers /></Page>} />
        <Route path="/customers/:customerId" element={<Page><CustomerDetail /></Page>} />
        <Route path="/expenses"     element={<Page><Expenses /></Page>} />
        <Route path="/purchases"    element={<Page adminOnly><Purchases /></Page>} />
        <Route path="/products"     element={<Page adminOnly><Products /></Page>} />
        <Route path="/suppliers"    element={<Page adminOnly><Suppliers /></Page>} />
        <Route path="/stock-take"   element={<Page adminOnly><StockTake /></Page>} />
        <Route path="/reports"      element={<Page adminOnly><Reports /></Page>} />
        <Route path="/close-day"    element={<Page adminOnly><CloseDay /></Page>} />
        <Route path="/users"        element={<Page adminOnly><Users /></Page>} />
        <Route path="/settings"     element={<Page adminOnly><Settings /></Page>} />
        <Route path="/help"         element={<Page><HelpGuide /></Page>} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}