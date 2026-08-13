// src/components/scanner/ScannerModal.jsx
import { useCallback, useEffect, useState } from 'react';
import { X, Zap, ZapOff, AlertTriangle } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';

export default function ScannerModal({ open, onClose, onDetected }) {
  // Guards against multiple rapid detections firing in the brief window
  // between "we found something" and the parent page actually closing us.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (open) setPaused(false);
  }, [open]);

  const handleDetected = useCallback((text) => {
    if (paused) return;
    setPaused(true);
    onDetected(text);
  }, [paused, onDetected]);

const { videoRef, status, torchOn, torchSupported, toggleTorch, retry } = useCameraScanner({
    onDetected: handleDetected,
    active: open && !paused,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <span className="font-display text-sm font-bold text-white">Scan barcode</span>
        <button onClick={onClose} className="rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-64 rounded-xl2 border-2 border-moss-400/80" />
          </div>
        )}

        {status === 'denied' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera permission needed"
            body="Your browser is blocking camera access for FlowBiz. Tap the padlock or (i) icon next to the address bar → Permissions → Camera → Allow, then come back and try again. On some phones this is under Chrome menu (⋮) → Settings → Site settings → flowbiz.pages.dev."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}

        {status === 'insecure' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera needs a secure connection"
            body="This page was opened over a plain network address (not HTTPS or localhost), so the browser blocks camera access entirely on this device. Open the app via HTTPS, or via localhost on this device, to use the scanner. You can still find the product by searching its name or code."
          />
        )}

        {status === 'unavailable' && (
          <ScannerMessage
            icon={<AlertTriangle className="h-8 w-8 text-rust-400" strokeWidth={1.75} />}
            title="Camera unavailable"
            body="No usable camera was found on this device. You can still find the product by searching its name or code."
            action={<button type="button" onClick={retry} className="btn-primary mt-2">Try again</button>}
          />
        )}
      </div>

      {torchSupported && status === 'scanning' && (
        <div className="flex justify-center pb-8 pt-4 safe-bottom">
          <button
            onClick={toggleTorch}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${torchOn ? 'bg-amber-400 text-ink-900' : 'bg-white/10 text-white'}`}
          >
            {torchOn ? <Zap className="h-4 w-4" strokeWidth={1.75} /> : <ZapOff className="h-4 w-4" strokeWidth={1.75} />}
            Torch
          </button>
        </div>
      )}
    </div>
  );
}

function ScannerMessage({ icon, title, body, action }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      {icon}
      <p className="font-display text-base font-bold text-white">{title}</p>
      <p className="text-sm text-white/70">{body}</p>
      {action}
    </div>
  );
}