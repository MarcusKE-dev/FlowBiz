// src/components/common/PwaInstallBanner.jsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { isDemoMode } from '../../demo/demoMode';

const DISMISSED_KEY = 'flowbiz_pwa_banner_dismissed';

export default function PwaInstallBanner() {
  const location = useLocation();
  const { isIOS, isStandalone, promptInstall } = usePwaInstall();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Ignore if localStorage unavailable
    }
  };

  const handleInstallClick = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      handleDismiss();
    }
  };

  // Only show on public landing and setup pages
  const allowedPaths = ['/', '/setup', '/signup'];
  const isAllowedPath = allowedPaths.includes(location.pathname);

  // Do not render in demo mode, standalone PWA mode, dismissed state, or internal routes
  if (isDemoMode() || isStandalone || dismissed || !isAllowedPath) return null;

  return (
    <aside
      aria-label="Install FlowBiz App"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in rounded-panel border border-line bg-surface p-4 shadow-overlay"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-96.png"
            alt="FlowBiz App Icon"
            className="h-10 w-10 shrink-0 rounded-control object-cover"
            onError={(e) => {
              e.currentTarget.src = '/favicon.svg';
            }}
          />
          <div>
            <h4 className="font-display text-section-title text-ink-900">
              Install FlowBiz App
            </h4>
            <p className="text-secondary text-ink-500">
              Run your counter faster and work 100% offline.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center justify-center rounded-control p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          aria-label="Close install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        {isIOS ? (
          <div className="rounded-control border border-line bg-canvas p-2.5 text-secondary text-ink-700">
            <p className="font-semibold flex items-center flex-wrap gap-1">
              Tap <Share className="h-3.5 w-3.5 inline text-ink-600" /> Share, then select{' '}
              <PlusSquare className="h-3.5 w-3.5 inline text-ink-600" /> &quot;Add to Home Screen&quot;
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary w-full"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} /> Install free app
          </button>
        )}
      </div>
    </aside>
  );
}