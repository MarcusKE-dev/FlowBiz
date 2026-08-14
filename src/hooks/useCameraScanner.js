// src/hooks/useCameraScanner.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

const DEV = import.meta.env.DEV;
const devLog = (...args) => { if (DEV) console.log('[Scanner]', ...args); };
const devError = (...args) => { if (DEV) console.error('[Scanner]', ...args); };

function getInsecureContextReason() {
  if (typeof window === 'undefined') return null;
  if (window.isSecureContext) return null;
  return { protocol: window.location.protocol, hostname: window.location.hostname };
}

// Retail barcode formats we actually need, plus our own product QR
// codes. Kept narrow on purpose — fewer formats to check per frame
// means both the native detector and the ZXing fallback decide
// "nothing here yet" faster on every frame that isn't a hit.
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

// High enough resolution to read a barcode clearly, low enough to keep
// every frame cheap to process — and continuous autofocus so the
// camera keeps re-focusing on whatever's held up to it (most phone
// cameras default to a slower focus mode for plain video capture).
// `advanced` constraints are silently ignored by devices/browsers that
// don't support them, so this is safe everywhere.
function buildConstraintAttempts() {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: 'continuous' }] };
  return [
    { label: 'exact environment', constraints: { video: { ...base, facingMode: { exact: 'environment' } } } },
    { label: 'ideal environment', constraints: { video: { ...base, facingMode: 'environment' } } },
    { label: 'user-facing', constraints: { video: { ...base, facingMode: 'user' } } },
    { label: 'any camera', constraints: { video: true } },
  ];
}

// Native, hardware-accelerated barcode decoding — the same engine behind
// the phone's own camera app / Google Lens. Where it's available and
// working well (mainly Chrome/Edge/Samsung Internet on Android) this is
// dramatically faster than software decoding. Not available at all on
// Safari/iOS, and quality can vary by Android device, which is why ZXing
// stays in place as the fallback below rather than being replaced.
let nativeFormatsPromise = null;
function getNativeSupportedFormats() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return Promise.resolve(null);
  if (!nativeFormatsPromise) {
    nativeFormatsPromise = window.BarcodeDetector.getSupportedFormats()
      .then((supported) => {
        const usable = BARCODE_FORMATS.filter((f) => supported.includes(f));
        return usable.length > 0 ? usable : null;
      })
      .catch(() => null);
  }
  return nativeFormatsPromise;
}

export function useCameraScanner({ onDetected, active }) {
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const detectorLoopRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopNativeLoop = useCallback(() => {
    const loop = detectorLoopRef.current;
    if (!loop) return;
    loop.cancelled = true;
    const video = videoRef.current;
    if (loop.frameHandle != null) {
      if (video?.cancelVideoFrameCallback) video.cancelVideoFrameCallback(loop.frameHandle);
      else cancelAnimationFrame(loop.frameHandle);
    }
    detectorLoopRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopNativeLoop();

    try { controlsRef.current?.stop(); } catch (err) { devError('controls.stop() failed', err); }
    controlsRef.current = null;

    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch (err) { devError('manual track stop failed', err); }
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;

    setTorchOn(false);
    setTorchSupported(false);
  }, [stopNativeLoop]);

  useEffect(() => {
    if (!active) { stop(); setStatus('idle'); return; }

    let cancelled = false;
    setStatus('starting');

    const insecure = getInsecureContextReason();
    if (insecure) {
      devError('Insecure context — navigator.mediaDevices is unavailable.', insecure);
      setStatus('insecure');
      return () => { cancelled = true; stop(); };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      devError('navigator.mediaDevices.getUserMedia is not available in this browser.');
      setStatus('unavailable');
      return () => { cancelled = true; stop(); };
    }

    (async () => {
      const nativeFormats = await getNativeSupportedFormats();
      if (cancelled) return;
      devLog(nativeFormats ? `Using native BarcodeDetector (${nativeFormats.join(', ')})` : 'Native BarcodeDetector unavailable — using ZXing fallback');

      if (nativeFormats) {
        // ── FAST PATH ──────────────────────────────────────────────
        const attempts = buildConstraintAttempts();
        let stream = null;
        let usedLabel = null;
        let lastError = null;

        for (const attempt of attempts) {
          if (cancelled) return;
          try {
            // eslint-disable-next-line no-await-in-loop
            stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
            usedLabel = attempt.label;
            break;
          } catch (err) {
            lastError = err;
            devError(`[native] constraints [${attempt.label}] failed:`, err?.name, err?.message);
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') break;
          }
        }

        if (cancelled) { stream?.getTracks().forEach((t) => t.stop()); return; }

        if (!stream) {
          devError('[native] all camera constraint attempts failed:', lastError?.name, lastError?.message);
          const name = lastError?.name;
          setStatus(name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
          return;
        }

        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        video.srcObject = stream;
        try { await video.play(); } catch { /* muted video autoplay quirk on some browsers — safe to ignore */ }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.();
        setTorchSupported(!!capabilities?.torch);
        devLog(`[native] camera started using [${usedLabel}] — track:`, track?.label, 'capabilities:', capabilities);

        const detector = new window.BarcodeDetector({ formats: nativeFormats });
        const loop = { cancelled: false, frameHandle: null };
        detectorLoopRef.current = loop;
        let busy = false;

        const scanFrame = async () => {
          if (loop.cancelled) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              const results = await detector.detect(video);
              if (results.length > 0 && !loop.cancelled) {
                onDetected(results[0].rawValue);
                busy = false;
                return; // caller flips `active` off once a code is found
              }
            } catch (err) {
              devError('[native] detect() failed', err);
            }
            busy = false;
          }
          if (loop.cancelled) return;
          loop.frameHandle = video.requestVideoFrameCallback
            ? video.requestVideoFrameCallback(scanFrame)
            : requestAnimationFrame(scanFrame);
        };

        loop.frameHandle = video.requestVideoFrameCallback
          ? video.requestVideoFrameCallback(scanFrame)
          : requestAnimationFrame(scanFrame);
        setStatus('scanning');
        return;
      }

      // ── FALLBACK PATH (same proven ZXing flow, just better camera constraints) ──
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const attempts = buildConstraintAttempts();
      let lastError = null;

      for (const attempt of attempts) {
        if (cancelled) return;
        devLog(`[zxing] trying constraints [${attempt.label}]:`, attempt.constraints);
        try {
          // eslint-disable-next-line no-await-in-loop
          const controls = await reader.decodeFromConstraints(
            attempt.constraints,
            videoRef.current,
            (result, err) => {
              if (cancelled) return;
              if (result) { onDetected(result.getText()); return; }
              if (DEV && err && err.name !== 'NotFoundException') devError('[zxing] decode callback error:', err.name, err.message);
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
          devLog(`[zxing] camera started using [${attempt.label}] — track:`, track?.label, 'capabilities:', capabilities);
          return;
        } catch (err) {
          lastError = err;
          devError(`[zxing] constraints [${attempt.label}] failed:`, err?.name, err?.message);
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError') break;
        }
      }

      if (cancelled) return;
      devError('[zxing] all camera constraint attempts failed. Last error:', lastError?.name, lastError?.message);
      const name = lastError?.name;
      setStatus(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
          ? 'denied'
          : 'unavailable'
      );
    })();

    return () => { cancelled = true; stop(); };
  }, [active, onDetected, stop, retryToken]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      devError('toggleTorch failed', err);
    }
  }, [torchOn, torchSupported]);

  return { videoRef, status, torchOn, torchSupported, toggleTorch, retry };
}