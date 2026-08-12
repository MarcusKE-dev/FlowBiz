// src/demo/demoMode.js
// The single source of truth for "are we in Demo Mode right now?". Every
// other demo-aware piece of code (src/firebase.js, AuthContext, businessReset)
// checks this instead of threading a prop/flag through the component tree.
const FLAG_KEY = 'flowbiz_demo_mode';

export function isDemoMode() {
  try {
    return localStorage.getItem(FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enterDemoMode() {
  try { localStorage.setItem(FLAG_KEY, 'true'); } catch { /* storage unavailable — ignore */ }
}

export function exitDemoMode() {
  try { localStorage.removeItem(FLAG_KEY); } catch { /* storage unavailable — ignore */ }
}