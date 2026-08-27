// src/demo/demoMode.js
const FLAG_KEY = 'flowbiz_demo_mode';

export function isDemoMode() {
  try {
    return localStorage.getItem(FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function enterDemoMode() {
  try {
    localStorage.setItem(FLAG_KEY, 'true');
  } catch { /* storage unavailable */ }
}

export function exitDemoMode() {
  try {
    localStorage.removeItem(FLAG_KEY);
  } catch { /* storage unavailable */ }
}