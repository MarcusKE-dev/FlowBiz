import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AppShell from '../components/layout/AppShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { prefetchRoutes } from './routePrefetch';

const routeLoaders = {
  setup: () => import('../pages/Setup'),
  login: () => import('../pages/Login'),
  forgotPassword: () => import('../pages/ForgotPassword'),
  joinStaff: () => import('../pages/JoinStaff'),
  authAction: () => import('../pages/AuthAction'),
  dashboard: () => import('../pages/Dashboard'),
  counter: () => import('../pages/Counter'),
  customers: () => import('../pages/Customers'),
  customerDetail: () => import('../pages/CustomerDetail'),
  expenses: () => import('../pages/Expenses'),
  purchases: () => import('../pages/Purchases'),
  products: () => import('../pages/Products'),
  suppliers: () => import('../pages/Suppliers'),
  stockTake: () => import('../pages/StockTake'),
  reports: () => import('../pages/Reports'),
  closeDay: () => import('../pages/CloseDay'),
  users: () => import('../pages/Users'),
  settings: () => import('../pages/Settings'),
  helpGuide: () => import('../pages/HelpGuide'),
  pro: () => import('../pages/Pro'),
  advancedAnalytics: () => import('../pages/AdvancedAnalytics'),
  inventoryIntelligence: () => import('../pages/InventoryIntelligence'),
  privacy: () => import('../pages/Privacy'),
  terms: () => import('../pages/Terms'),
};

const Setup      = lazy(routeLoaders.setup);
const Login      = lazy(routeLoaders.login);
const ForgotPassword = lazy(routeLoaders.forgotPassword);
const JoinStaff  = lazy(routeLoaders.joinStaff);
const AuthAction = lazy(routeLoaders.authAction);
const Dashboard  = lazy(routeLoaders.dashboard);
const Counter    = lazy(routeLoaders.counter);
const Customers  = lazy(routeLoaders.customers);
const CustomerDetail = lazy(routeLoaders.customerDetail);
const Expenses   = lazy(routeLoaders.expenses);
const Purchases  = lazy(routeLoaders.purchases);
const Products   = lazy(routeLoaders.products);
const Suppliers  = lazy(routeLoaders.suppliers);
const StockTake  = lazy(routeLoaders.stockTake);
const Reports    = lazy(routeLoaders.reports);
const CloseDay   = lazy(routeLoaders.closeDay);
const Users      = lazy(routeLoaders.users);
const Settings   = lazy(routeLoaders.settings);
const HelpGuide  = lazy(routeLoaders.helpGuide);
const Pro        = lazy(routeLoaders.pro);
const AdvancedAnalytics = lazy(routeLoaders.advancedAnalytics);
const InventoryIntelligence = lazy(routeLoaders.inventoryIntelligence);
const Privacy    = lazy(routeLoaders.privacy);
const Terms      = lazy(routeLoaders.terms);

function Page({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>
        <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
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

function RoutePrefetcher() {
  const { firebaseUser, isAdmin } = useAuth();
  useEffect(() => {
    if (!firebaseUser) return;
    const common = [routeLoaders.counter, routeLoaders.customers, routeLoaders.customerDetail, routeLoaders.expenses, routeLoaders.helpGuide];
    const adminOnly = [routeLoaders.dashboard, routeLoaders.products, routeLoaders.purchases, routeLoaders.suppliers, routeLoaders.stockTake, routeLoaders.reports, routeLoaders.closeDay, routeLoaders.users, routeLoaders.settings, routeLoaders.pro, routeLoaders.advancedAnalytics, routeLoaders.inventoryIntelligence];
    prefetchRoutes(isAdmin ? [...common, ...adminOnly] : common);
  }, [firebaseUser, isAdmin]);
  return null;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading..." />}>
      <RoutePrefetcher />
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/join/:inviteId" element={<JoinStaff />} />
        <Route path="/auth/action" element={<AuthAction />} />
        
        {/* Public Legal Pages */}
        <Route path="/privacy" element={<Suspense fallback={<LoadingSpinner />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<LoadingSpinner />}><Terms /></Suspense>} />

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