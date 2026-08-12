import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router/AppRouter';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
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
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
