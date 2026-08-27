// src/pages/DemoLanding.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterDemoMode } from '../demo/demoMode';
import { seedDemoDataIfNeeded } from '../demo/seedData';
import { useAuth } from '../contexts/AuthContext';

export default function DemoLanding() {
  const navigate = useNavigate();
  const { reloadProfile } = useAuth();

  useEffect(() => {
    enterDemoMode();
    seedDemoDataIfNeeded();
    reloadProfile?.();

    const timer = setTimeout(() => {
      navigate('/counter', { replace: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [navigate, reloadProfile]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6">
      <div className="flex flex-col items-center justify-center gap-3 text-ink-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-moss-600" />
        <span className="text-sm font-semibold text-ink-800">Opening Demo Counter…</span>
      </div>
    </div>
  );
}