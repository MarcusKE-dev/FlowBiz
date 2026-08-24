// src/components/common/PwaInstallBanner.jsx
import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export default function PwaInstallBanner() {
  const { isInstallable, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  // If already installed or closed by user, don't show
  if (isStandalone || dismissed) return null;
  // If neither Android/Desktop installable nor iOS browser, don't show
  if (!isInstallable && !isIOS) return null;

  return (
    <aside
      aria-label="Install FlowBiz App"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-moss-200 bg-white p-4 shadow-2xl animate-fade-in"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/icons/icon-96.png"
            alt="FlowBiz App Icon"
            className="h-11 w-11 rounded-xl shadow-xs shrink-0 object-cover"
            onError={(e) => {
              e.currentTarget.src = '/favicon.svg';
            }}
          />
          <div>
            <h4 className="font-display text-sm font-bold text-ink-900">
              Install FlowBiz App
            </h4>
            <p className="text-xs text-ink-500">
              Run your counter faster and work 100% offline.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-ink-400 hover:text-ink-700 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg"
          aria-label="Close install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        {/* Android & Desktop Chrome 1-Click Install Button */}
        {isInstallable && (
          <button
            type="button"
            onClick={promptInstall}
            className="btn-primary w-full !py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Download className="h-4 w-4" /> Install Free App
          </button>
        )}

        {/* iOS Safari Instructions */}
        {isIOS && (
          <div className="rounded-lg bg-[#faf6ef] p-2.5 text-[11px] text-ink-700 border border-ink-100">
            <p className="font-semibold flex items-center flex-wrap gap-1">
              Tap <Share className="h-3.5 w-3.5 text-moss-700 inline" /> Share, then select{' '}
              <PlusSquare className="h-3.5 w-3.5 text-moss-700 inline" /> &quot;Add to Home Screen&quot;
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}