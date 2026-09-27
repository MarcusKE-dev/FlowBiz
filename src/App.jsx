// src/App.jsx
import { Toaster } from 'react-hot-toast';
import { PRIMARY, NEGATIVE, INK, SURFACE, LINE } from './theme/tokens';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { CheckoutProvider } from './contexts/CheckoutContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';
import NativeShell from './platform/NativeShell';
import { isNativeApp } from './platform/platform';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                fontSize: '14px',
                lineHeight: '20px',
                borderRadius: '8px',
                border: `1px solid ${LINE}`,
                background: SURFACE,
                color: INK,
                maxWidth: '90vw',
              },
              success: { iconTheme: { primary: PRIMARY, secondary: SURFACE } },
              error:   { iconTheme: { primary: NEGATIVE, secondary: SURFACE } },
              duration: 3000,
            }}
          />
          <CheckoutProvider>
            <NativeShell />
            <AppRouter />
          </CheckoutProvider>
          {/* Shows the install popup automatically for visitors on phone or
              desktop. Never inside the Android app, which is already installed. */}
          {!isNativeApp() && <PwaInstallBanner />}
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;