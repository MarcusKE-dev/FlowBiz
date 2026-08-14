// src/hooks/useHardwareScanner.js
import { useEffect, useRef } from 'react';

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}


export function useHardwareScanner(onScan, { enabled = true, maxIntervalMs = 80, minLength = 4 } = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) {
        bufferRef.current = '';
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = bufferRef.current;
        bufferRef.current = '';
        if (code.length >= minLength) {
          onScan(code);
        }
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift, arrow keys, etc.

      if (elapsed > maxIntervalMs) {
        bufferRef.current = '';
      }
      bufferRef.current += e.key;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onScan, maxIntervalMs, minLength]);
}