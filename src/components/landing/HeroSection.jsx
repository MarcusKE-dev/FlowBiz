import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Play } from 'lucide-react';

const HERO_PHOTO_URL = '/hero-photo.webp';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      
      {/* Full-Bleed Hero Banner */}
      <div className="relative min-h-[560px] lg:min-h-[620px] flex items-center bg-[#0d1f16]">
        
        {/* Background Image */}
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

        {/* Gradient Overlay */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(13, 31, 22, 0.96) 0%, rgba(13, 31, 22, 0.88) 42%, rgba(13, 31, 22, 0.35) 70%, rgba(13, 31, 22, 0.02) 100%)',
          }}
        />

        {/* Soft Left Blur Mask */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none hidden md:block"
          style={{
            maskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            WebkitMaskImage: 'linear-gradient(to right, black 25%, transparent 65%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 w-full">
          <div className="max-w-3xl space-y-6 text-white text-left">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white tracking-tight leading-[1.08] drop-shadow-sm">
              Run your business with ease
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-[#d1dcd4] font-normal leading-relaxed max-w-2xl">
              Sell <strong className="text-white font-semibold">faster</strong>, know what you have in{' '}
              <strong className="text-white font-semibold">stock</strong>, and keep your business running
              even while <strong className="text-white font-semibold">offline</strong>, then see how it’s doing when you’re <strong className="text-white font-semibold">online.</strong>
            </p>

            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                to="/setup"
                className="bg-[#1a623c] text-white px-8 py-4 rounded-xl text-base font-bold shadow-lg hover:bg-[#144f30] transition-all flex items-center justify-center gap-2 border border-[#348a58]"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="bg-white/10 backdrop-blur-md border border-white/30 text-white px-7 py-4 rounded-xl text-base font-bold hover:bg-white/20 transition-all flex items-center justify-center"
              >
                Sign In to Counter
              </Link>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-xs sm:text-sm font-semibold text-[#e1ece4]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                Works 100% Offline
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                M-Pesa Till Reconciled
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                Customer Reminders
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#a3e6ba] shrink-0" />
                No POS Hardware Required
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* Clean, Focused Live Demo Section */}
      <div className="py-16 md:py-24 border-b border-[#e8eaed] bg-[#faf6ef]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          
          {/* Centered Heading & Explanation */}
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#15171d] tracking-tight">
              Try FlowBiz Live in Your Browser
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-[#5a6273] leading-relaxed">
              Explore the fully interactive demo account with preloaded inventory, customers, and registers. Test sales, debt ledgers, and closing reconciliations with zero sign-up required.
            </p>
          </div>

          {/* Action Button & Enlarged Subtext */}
          <div className="pt-2 space-y-3">
            <div>
              <a
                href="/demo/"
                className="inline-flex items-center justify-center gap-2 bg-[#1a623c] hover:bg-[#144f30] text-white px-9 py-4 rounded-xl font-bold text-base transition-all shadow-md hover:shadow-lg"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Launch Live Demo Account</span>
              </a>
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#5a6273]">
              Instant access · Runs entirely in your browser · No login required
            </p>
          </div>

        </div>
      </div>

    </section>
  );
}