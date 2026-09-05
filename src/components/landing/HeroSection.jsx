import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

const HERO_PHOTO_URL = '/hero-photo.webp';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      
      {/* Full-Bleed Hero Background Banner */}
      <div className="relative flex min-h-[580px] items-center bg-deep-900 lg:min-h-[680px]">
        
        {/* 1. Base Background Photo */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={HERO_PHOTO_URL}
            alt="Retail shop owner managing inventory and POS"
            className="w-full h-full object-cover object-center lg:object-right"
            onError={(e) => {
              e.currentTarget.style.opacity = '0.25';
            }}
          />
        </div>

        {/* 2. Left-to-Right Blur & Gradient Overlay */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none"
          style={{
            // Deep blue (#121A63) laid over the photo, fading out to the right
            // so the shop stays visible behind the headline.
            background: 'linear-gradient(to right, rgba(18, 26, 99, 0.94) 0%, rgba(18, 26, 99, 0.86) 42%, rgba(18, 26, 99, 0.34) 70%, rgba(18, 26, 99, 0.02) 100%)',
          }}
        />

        {/* 3. Soft blur mask on left for enhanced text clarity */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none hidden md:block"
          style={{
            maskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            WebkitMaskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        {/* 4. Foreground Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
          <div className="max-w-3xl space-y-6 text-white">

            <h1 className="font-hero text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Run your business with ease
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-white/70 font-normal leading-relaxed max-w-2xl">
              Sell <strong className="text-white font-semibold">faster</strong>, know what you have in{' '}
              <strong className="text-white font-semibold">stock</strong>, and keep your business running
              even while <strong className="text-white font-semibold">offline</strong>, then see how it’s doing when you’re <strong className="text-white font-semibold">online.</strong>
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                to="/setup"
                className="bg-primary-600 text-white px-8 py-4 rounded-panel text-base font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 border border-primary-600"
              >
                <span>Get started free</span>
              </Link>
              <Link
                to="/login"
                className="border border-white text-white px-7 py-4 rounded-panel text-base font-bold transition-colors hover:bg-white hover:text-ink-900 flex items-center justify-center"
              >
                Sign in
              </Link>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-secondary sm:text-body font-semibold text-primary-100">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary-100 shrink-0" />
                Works 100% Offline
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary-100 shrink-0" />
                M-Pesa Till Reconciled
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-100 shrink-0" />
                Customer Reminders
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary-100 shrink-0" />
                No POS Hardware Required
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* Demo section — replaces the old embedded "Live Point of Sale
          Simulator", whose component has now been deleted.

          The button below is a plain <a>, not a react-router <Link>, on
          purpose: /demo/ is a SEPARATE build (see vite.config.js + 
          package.json + public/_redirects) with its own local, offline
          data store (src/demo/) instead of real Firebase. A <Link> would
          do a client-side navigation and never actually leave this
          bundle, which is exactly what caused real account data to leak
          into "the demo" before — a plain <a> forces a full page load,
          which is what lets Cloudflare correctly hand the request to the
          separately-built demo app. */}

      <div id="demo" className="py-16 md:py-24 border-t border-line scroll-mt-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          {/* Heading and Paragraph with increased spacing */}
          <div className="space-y-4 sm:space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink-900 tracking-tight">
              See FlowBiz in action
            </h2>
            <p className="text-body sm:text-base text-ink-600 leading-relaxed">
              A working account, preloaded with sample products, sales and customers. Try the
              counter, the dashboard, credit sales and M-Pesa reconciliation.
              <br className="hidden sm:inline" /> Nothing you do here touches a real business.
            </p>
          </div>

          <div className="pt-2 flex flex-col items-center gap-2.5">
            <a
              href="/demo/"
              className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-panel font-bold text-body hover:bg-primary-700 transition-all"
            >
              <span>Try the Free Demo</span>
            </a>
            <span className="text-secondary text-ink-500">
              No sign-in needed &middot; Free demo trial &middot; Nothing is saved to a real account
            </span>
          </div>

        </div>
      </div>

    </section>
  );
}