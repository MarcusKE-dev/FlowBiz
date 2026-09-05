// src/components/customize/Toggle.jsx
//
// The switch the Customize page uses, unchanged from the one Settings
// already shipped — same size, same colours, same ARIA. It moved into its
// own file only because two sections now need it.

export default function Toggle({ checked, onChange, disabled, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary-600' : 'bg-ink-300'
      }`}
    >
      <span
        className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
