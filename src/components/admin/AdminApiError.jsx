// src/components/admin/AdminApiError.jsx
//
// What an admin screen shows when its API call failed.
//
// It distinguishes the one failure that has a specific, actionable cause —
// the browser is running ahead of the deployed Cloudflare Worker — from
// every other error. That case used to surface as a bare "Not found.",
// which is true and useless: it names the HTTP status rather than the
// thing the operator has to do about it.

import { AlertCircle, PackageOpen, RotateCw } from 'lucide-react';

export default function AdminApiError({ error, onRetry }) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const outdated = typeof error === 'object' && error?.apiOutdated === true;

  if (!outdated) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-panel border border-danger-200 bg-danger-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-700" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-cell text-danger-700">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-1.5 text-cell text-danger-700 underline">
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-panel border border-line bg-surface p-5">
      <div className="flex items-start gap-2.5">
        <PackageOpen className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-section-title text-ink-900">The API worker needs deploying</h2>
          <p className="mt-1.5 max-w-prose text-cell text-ink-600">
            This screen is part of the admin console update, but the Cloudflare Worker that serves
            its data is still running the previous version, so the endpoint it calls does not exist
            yet. The merchant app is unaffected.
          </p>
          <p className="mt-3 text-label uppercase text-ink-500">Run this once, from the project root</p>
          <pre className="mt-1.5 overflow-x-auto rounded-control border border-line bg-canvas px-3 py-2 text-cell text-ink-800"><code>npm --prefix cloudflare-worker run deploy</code></pre>
          <p className="mt-2 text-label text-ink-400">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-outline mt-3 flex items-center gap-1.5 !px-3 text-button">
              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Check again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
