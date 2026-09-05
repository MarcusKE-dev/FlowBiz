// src/components/scanner/ScannerDock.jsx
//
// Continuous scanning for the phone camera on the Counter.
//
// ScannerModal takes over the whole screen, fires once and closes, so a
// cashier ringing up five items reopens the camera five times. This docks
// to the bottom instead: the cart stays visible and scrollable above it,
// the camera stays armed, and each accepted scan drops straight into the
// cart with a confirmation in the dock's own footer.
//
// Desktop is untouched — a USB scanner is already continuous through
// useHardwareScanner, so this only exists for the camera flow.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, ZapOff, AlertTriangle } from 'lucide-react';
import { useCameraScanner } from '../../hooks/useCameraScanner';
import Money from '../ui/Money';

// The camera decodes many frames a second and a barcode stays in shot for
// a beat after it reads, so without these a single item lands in the cart
// twenty times. Two separate guards, because they catch different things:
// MIN_GAP_MS paces every scan (so two different products can't both land
// from one sweep of the hand), and SAME_CODE_MS stops the barcode still
// sitting in front of the lens from re-firing.
const MIN_GAP_MS = 400;
const SAME_CODE_MS = 1500;

export default function ScannerDock({ open, onClose, onDetected, lastScanLabel, cartTotal }) {
  const lastScanAtRef = useRef(0);
  const lastCodeRef = useRef({ code: null, at: 0 });
  const [flash, setFlash] = useState(false);

  const handleDetected = useCallback((text) => {
    const now = Date.now();
    if (now - lastScanAtRef.current < MIN_GAP_MS) return;
    if (lastCodeRef.current.code === text && now - lastCodeRef.current.at < SAME_CODE_MS) return;
    lastScanAtRef.current = now;
    lastCodeRef.current = { code: text, at: now };
    setFlash(true);
    onDetected(text);
  }, [onDetected]);

  const { videoRef, status, torchOn, torchSupported, toggleTorch, retry } = useCameraScanner({
    onDetected: handleDetected,
    active: open,
    continuous: true,
  });

  // A fresh dock session starts with a clean debounce, so reopening to
  // scan the same product again works immediately.
  useEffect(() => {
    if (!open) return;
    lastScanAtRef.current = 0;
    lastCodeRef.current = { code: null, at: 0 };
  }, [open]);

  // The confirmation is a brief highlight on the footer strip rather than
  // a toast — toasts stack badly at five scans in ten seconds.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [flash, lastScanLabel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex h-[38vh] min-h-[15rem] flex-col
                 overflow-hidden rounded-t-panel bg-ink-950 shadow-overlay lg:hidden"
      role="dialog"
      aria-label="Continuous barcode scanner"
    >
      {/* Header strip */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <span className="flex items-center gap-2 text-label uppercase text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" />
          Scanning
        </span>
        <div className="flex items-center gap-1">
          {torchSupported && status === 'scanning' && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torchOn}
              aria-label="Torch"
              className={`flex min-h-touch min-w-touch items-center justify-center rounded-control
                          ${torchOn ? 'text-warning-300' : 'text-white/70 hover:bg-white/10'}`}
            >
              {torchOn
                ? <Zap className="h-5 w-5" strokeWidth={1.75} />
                : <ZapOff className="h-5 w-5" strokeWidth={1.75} />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-touch items-center gap-1.5 rounded-control px-3 text-button
                       text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Exit
          </button>
        </div>
      </div>

      {/* Live view */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {status === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-20 w-56 rounded-panel border-2 border-primary-500" />
          </div>
        )}

        {status === 'denied' && (
          <DockMessage
            title="Camera permission needed"
            body="Your browser is blocking camera access. Tap the padlock next to the address bar, allow Camera, then try again."
            action={<button type="button" onClick={retry} className="btn-primary mt-1">Try again</button>}
          />
        )}
        {status === 'insecure' && (
          <DockMessage
            title="Camera needs a secure connection"
            body="This page was opened without HTTPS, so the browser blocks the camera. You can still add items by searching."
          />
        )}
        {status === 'unavailable' && (
          <DockMessage
            title="Camera unavailable"
            body="No usable camera was found. You can still add items by searching."
            action={<button type="button" onClick={retry} className="btn-primary mt-1">Try again</button>}
          />
        )}
      </div>

      {/* Footer strip — confirmation without looking away from the counter */}
      <div
        className={`bottom-nav-safe flex shrink-0 items-center justify-between gap-3 border-t px-3 pt-2.5 transition-colors
                    ${flash ? 'border-primary-500 bg-primary-600' : 'border-white/10 bg-ink-950'}`}
      >
        <span className="min-w-0 flex-1 truncate text-secondary text-white/80" aria-live="polite">
          {lastScanLabel || 'Hold a barcode up to the camera'}
        </span>
        <span className="shrink-0 text-body font-semibold text-white">
          <Money value={cartTotal} />
        </span>
      </div>
    </div>
  );
}

function DockMessage({ title, body, action }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-950 px-6 text-center">
      <AlertTriangle className="h-6 w-6 text-danger-400" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-body font-semibold text-white">{title}</p>
      <p className="text-secondary text-white/70">{body}</p>
      {action}
    </div>
  );
}
