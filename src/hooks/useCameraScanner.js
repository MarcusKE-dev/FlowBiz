// src/hooks/useCameraScanner.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Dev-only diagnostics — never runs in production, never changes `status`.
const DEV = import.meta.env.DEV;
const devLog = (...args) => { if (DEV) console.log('[Scanner]', ...args); };
const devError = (...args) => { if (DEV) console.error('[Scanner]', ...args); };
const [retryToken, setRetryToken] = useState(0);
const retry = useCallback(() => setRetryToken((t) => t + 1), []);

function getInsecureContextReason() {
  if (typeof window === 'undefined') return null;
  if (window.isSecureContext) return null;
  return { protocol: window.location.protocol, hostname: window.location.hostname };
}

// Fallback cascade instead of a single fixed constraint set — covers
// exact vs ideal facingMode and an environment→user→any-camera fallback,
// so one rejected constraint doesn't fail the whole scan attempt outright.
function buildConstraintAttempts() {
  return [
    { label: 'exact environment', constraints: { video: { facingMode: { exact: 'environment' } } } },
    { label: 'ideal environment', constraints: { video: { facingMode: 'environment' } } },
    { label: 'user-facing', constraints: { video: { facingMode: 'user' } } },
    { label: 'any camera', constraints: { video: true } },
  ];
}

export function useCameraScanner({ onDetected, active }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  // decodeFromConstraints() resolves with an IScannerControls object —
  // THAT is what exposes .stop() for a continuous decode session in this
  // @zxing/browser version. Cleanup must go through it, not the reader.
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | scanning | denied | unavailable | insecure
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch (err) {
      devError('controls.stop() failed', err);
    }
    controlsRef.current = null;

    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      devError('manual track stop failed', err);
    }
    streamRef.current = null;

    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('starting');

    // Secure-context guard — checked BEFORE touching mediaDevices at all,
    // so the real cause is surfaced instead of a generic "unavailable".
    const insecure = getInsecureContextReason();
    if (insecure) {
      devError(
        'Insecure context — navigator.mediaDevices is unavailable.',
        'protocol:', insecure.protocol,
        'hostname:', insecure.hostname,
        'window.isSecureContext:', window.isSecureContext
      );
      setStatus('insecure');
      return () => { cancelled = true; stop(); };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      devError('navigator.mediaDevices.getUserMedia is not available in this browser.');
      setStatus('unavailable');
      return () => { cancelled = true; stop(); };
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    if (DEV) {
      devLog(
        'window.isSecureContext:', window.isSecureContext,
        'protocol:', window.location.protocol,
        'hostname:', window.location.hostname
      );
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const cams = devices.filter((d) => d.kind === 'videoinput');
          devLog(
            'videoinput devices (labels blank until permission is granted):',
            cams.length,
            cams.map((c) => ({ deviceId: c.deviceId, label: c.label || '(hidden)' }))
          );
        })
        .catch((err) => devError('enumerateDevices() failed', err));
    }

    (async () => {
      const attempts = buildConstraintAttempts();
      let lastError = null;

      for (const attempt of attempts) {
        if (cancelled) return;
        devLog(`trying constraints [${attempt.label}]:`, attempt.constraints);
        try {
          // eslint-disable-next-line no-await-in-loop
          const controls = await reader.decodeFromConstraints(
            attempt.constraints,
            videoRef.current,
            (result, err) => {
              if (cancelled) return;
              if (result) {
                onDetected(result.getText());
                return;
              }
              // NotFoundException fires continuously between frames while
              // scanning with nothing in view — that's expected, not an error.
              if (DEV && err && err.name !== 'NotFoundException') {
                devError('decode callback error:', err.name, err.message);
              }
            }
          );

          if (cancelled) {
            try { controls.stop(); } catch (err) { devError('post-cancel controls.stop() failed', err); }
            return;
          }

          controlsRef.current = controls;
          setStatus('scanning');
          streamRef.current = videoRef.current?.srcObject || null;
          const track = streamRef.current?.getVideoTracks?.()[0];
          const capabilities = track?.getCapabilities?.();
          setTorchSupported(!!capabilities?.torch);
          devLog(`camera started using [${attempt.label}] — track:`, track?.label, 'capabilities:', capabilities);
          return; // success — stop trying further constraint attempts
        } catch (err) {
          lastError = err;
          devError(`constraints [${attempt.label}] failed:`, err?.name, err?.message);
          // A denial should stop the cascade immediately — retrying with
          // looser constraints won't change the user's answer.
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') {
            break;
          }
          // Otherwise (OverconstrainedError, NotFoundError, NotReadableError,
          // AbortError, ...) fall through and try the next, looser constraint set.
        }
      }

      if (cancelled) return;
      devError('all camera constraint attempts failed. Last error:', lastError?.name, lastError?.message, lastError);
      const name = lastError?.name;
      setStatus(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
          ? 'denied'
          : 'unavailable'
      );
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, onDetected, stop, retryToken]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      // Some devices report torch as supported but reject the constraint
      // anyway — fail silently rather than surface a confusing error for
      // what's meant to be a nice-to-have.
      devError('toggleTorch failed', err);
    }
  }, [torchOn, torchSupported]);

return { videoRef, status, torchOn, torchSupported, toggleTorch, retry };}