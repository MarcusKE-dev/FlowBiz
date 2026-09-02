// src/App.jsx
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary';
import PwaInstallBanner from './components/common/PwaInstallBanner';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { fontSize: '14px', borderRadius: '10px', maxWidth: '90vw' },
              success: { iconTheme: { primary: '#1a623c', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#c4441d', secondary: '#fff' } },
              duration: 3000,
            }}
          />
          <AppRouter />
          {/* Shows the install popup automatically for visitors on phone or desktop */}
          <PwaInstallBanner />
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;