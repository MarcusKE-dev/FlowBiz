import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { PosSimulationMockup } from './PosSimulationMockup';

// Put your image file inside your project's "public/" folder: public/hero-photo.jpg
const HERO_PHOTO_URL = '/hero-photo.jpg';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      
      {/* Full-Bleed Hero Background Banner */}
      <div className="relative min-h-[580px] lg:min-h-[680px] flex items-center bg-[#0d1f16]">
        
        {/* 1. Base Background Photo - Fitted to not crop on desktop right side */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={HERO_PHOTO_URL}
            alt="Retail shop owner managing inventory and POS"
            className="w-full h-full object-cover object-center lg:object-right"
            onError={(e) => {
              // Fallback styling if hero-photo.jpg is not yet loaded
              e.currentTarget.style.opacity = '0.25';
            }}
          />
        </div>

        {/* 2. Left-to-Right Blur & Gradient Overlay */}
        {/* On Left: Deep dark-green backdrop with soft blur to keep bold white text 100% readable */}
        {/* On Right: Blends cleanly to transparent so the person/photo on the right is fully visible and uncropped */}
        <div 
          className="absolute inset-0 z-1 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(13, 31, 22, 0.96) 0%, rgba(13, 31, 22, 0.88) 42%, rgba(13, 31, 22, 0.35) 70%, rgba(13, 31, 22, 0.02) 100%)',
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


            {/* Much Larger, Bold Pure White Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white tracking-tight leading-[1.08] drop-shadow-sm">
              Run your business with ease
            </h1>

            {/* Minimal & Clear Subtitle */}
<p className="text-base sm:text-lg lg:text-xl text-[#d1dcd4] font-normal leading-relaxed max-w-2xl">
  Sell <strong className="text-white font-semibold">faster</strong>, know what you have in{" "}
  <strong className="text-white font-semibold">stock</strong>, and keep your business running
  even while <strong className="text-white font-semibold">offline</strong>, then see how it’s doing when you’re <strong className="text-white font-semibold">online.</strong>
</p>
            {/* Action Buttons */}
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

            {/* Minimal Trust Checklist */}
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

      {/* Interactive POS Simulator Section below Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-6">
        
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#15171d] mt-1">
            Live Point of Sale Simulator
          </h2>
        </div>
        <PosSimulationMockup />
      </div>

    </section>
  );
}