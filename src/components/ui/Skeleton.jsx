// src/components/ui/Skeleton.jsx
//
// Loading placeholder. Matches the shape of what is about to arrive so
// the page doesn't jump when real content replaces it.

export default function Skeleton({ className = 'h-4 w-full' }) {
  return (
    <div
      className={`animate-pulse rounded-control bg-ink-100 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
