export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-16 text-ink-500"
      role="status"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary-600" />
      <span className="text-secondary">{label}</span>
    </div>
  );
}
