// src/components/common/AuthShell.jsx
//
// The frame every signed-out screen sits in: sign in, create a business,
// reset a password, accept a staff invite, handle an email action link.
// They used to each roll their own near-black page; this is one deep
// blue field with a single white panel on it.
//
// The brand is set as a wordmark rather than /icons/icon-192.png on
// purpose — those raster icons are still the old green and would fight
// the field they now sit on.

export default function AuthShell({ title, description, children, footer, width = 'max-w-sm' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-deep-900 px-4 py-10">
      <div className={`w-full ${width} space-y-6`}>
        <div className="text-center">
          <p className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em] text-white">
            FlowBiz
          </p>
          <p className="mt-1 text-secondary text-white/60">Business manager</p>
        </div>

        <div className="rounded-panel bg-surface p-6">
          {(title || description) && (
            <div className="mb-5">
              {title && <h1 className="font-display text-page-title text-ink-900">{title}</h1>}
              {description && <p className="mt-1 text-body text-ink-600">{description}</p>}
            </div>
          )}
          {children}
        </div>

        {footer && <div className="text-center text-body text-white/70">{footer}</div>}
      </div>
    </div>
  );
}
