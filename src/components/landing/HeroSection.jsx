import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

const HERO_PHOTO_URL = '/hero-photo.webp';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      
      {/* Full-Bleed Hero Background Banner */}
      <div className="relative flex min-h-[600px] items-center bg-[#0B1021] lg:min-h-[700px]">
        
        {/* 1. Base Background Photo */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={HERO_PHOTO_URL}
            alt="Retail shop owner managing inventory and POS"
            className="w-full h-full object-cover object-center lg:object-right md:translate-x-24 opacity-80 mix-blend-luminosity"
            onError={(e) => {
              e.currentTarget.style.opacity = '0.25';
            }}
          />
        </div>

        {/* 2. Cleaner Left-to-Right Gradient Overlay */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none bg-gradient-to-r from-[#111836] via-[#111836]/90 to-transparent"
        />

        {/* 3. Soft Ambient Color Glow */}
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full pointer-events-none bg-blue-600/10 blur-3xl"
          aria-hidden="true"
        />

        {/* 4. Foreground Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
          <div className="max-w-2xl space-y-7 text-white">

            {/* Main Headline */}
            <h1 className="font-sans text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
              Run your business{' '}
              <br className="hidden md:block" />
              <span className="text-white">
                with ease
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg lg:text-xl text-blue-100/70 font-normal leading-relaxed max-w-xl pr-4">
              Sell <strong className="text-white font-semibold">faster</strong>, know what you have in{' '}
              <strong className="text-white font-semibold">stock</strong>, and keep your business running
              even while <strong className="text-white font-semibold">offline</strong>, then see how it’s doing when you’re <strong className="text-white font-semibold">online.</strong>
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                to="/setup"
                className="group bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-lg text-base font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5"
              >
                <span>Get started free</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/login"
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-3.5 rounded-lg text-base font-bold transition-all duration-200 flex items-center justify-center hover:-translate-y-0.5"
              >
                Sign in
              </Link>
            </div>

            {/* Feature Checklist */}
            <div className="pt-8 mt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm sm:text-base font-medium text-blue-100/90 max-w-lg">
              <span className="flex items-center gap-3">
                <span className="flex items-center justify-center p-1 rounded-full bg-blue-500/20 text-blue-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                </span>
                Works 100% Offline
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center justify-center p-1 rounded-full bg-blue-500/20 text-blue-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                </span>
                M-Pesa Till Reconciled
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center justify-center p-1 rounded-full bg-blue-500/20 text-blue-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                </span>
                Customer Reminders
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center justify-center p-1 rounded-full bg-blue-500/20 text-blue-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                </span>
                No POS Hardware Required
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* Demo Section - Matched exact classes from HowItWorks section */}
      <div id="demo" className="py-16 md:py-24 border-t border-line scroll-mt-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          <div className="space-y-4 sm:space-y-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink-900 tracking-tight">
              See FlowBiz in action
            </h2>
            <p className="text-body sm:text-base text-ink-600 leading-relaxed max-w-2xl mx-auto">
              A working account, preloaded with sample products, sales, and customers. Try the
              counter, the dashboard, credit sales, and M-Pesa reconciliation.
              <br className="hidden sm:inline" /> Nothing you do here touches a real business.
            </p>
          </div>

          <div className="pt-2 flex flex-col items-center gap-3">
            <a
              href="/demo/"
              className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-8 py-3.5 rounded-panel font-bold text-body shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Try the Free Demo</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <span className="text-secondary text-ink-500 text-xs sm:text-sm">
              No sign-in needed &middot; Free demo trial &middot; Nothing is saved to a real account
            </span>
          </div>

        </div>
      </div>

    </section>
  );
}