import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#faf6ef]/95 backdrop-blur-md border-b border-[#e8eaed] h-14 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-full">
          
          {/* Left: Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-lg text-[#15171d] tracking-tight leading-none">
                FlowBiz
              </span>
              <span className="text-[8px] font-bold text-[#1a623c] uppercase tracking-wider leading-none mt-1">
                Business Manager
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="flex items-center gap-6 xl:gap-8 text-xs sm:text-sm font-semibold text-[#5a6273] pointer-events-auto leading-none">
              <a 
                href="#features" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                Features
              </a>
              <a 
                href="#live-simulator" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                Live Simulator
              </a>
              <a 
                href="#how-it-works" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                How It Works
              </a>
              <a 
                href="#pricing" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                Pricing
              </a>
              <a 
                href="#faq" 
                className="hover:text-[#1a623c] transition-colors py-1 px-1"
              >
                FAQ
              </a>
            </div>
          </nav>

          {/* Right: Action Buttons */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-bold text-[#363b48] hover:text-[#15171d] px-3 py-2 rounded-lg hover:bg-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="bg-[#1a623c] text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-[#144f30] transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 rounded-lg text-[#5a6273] hover:text-[#15171d] hover:bg-white z-10"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 border-b border-[#e8eaed] bg-white px-6 py-4 space-y-3 shadow-lg">
          <a
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            Features
          </a>
          <a
            href="#live-simulator"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            Live Simulator
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-[#363b48] hover:text-[#1a623c]"
          >
            FAQ
          </a>
          <div className="pt-2.5 border-t border-[#e8eaed] flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full text-center py-2.5 border border-[#cfd3da] rounded-xl text-sm font-bold text-[#15171d]"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="w-full text-center py-3 bg-[#1a623c] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#144f30] transition-all flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}