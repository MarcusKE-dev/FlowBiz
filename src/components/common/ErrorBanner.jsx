export default function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="rounded-lg border border-rust-200 bg-rust-50 px-4 py-3 text-sm font-medium text-rust-700">{message}</div>;
}
