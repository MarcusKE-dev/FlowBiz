import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-line h-14 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-full">
          
          {/* Left: Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-lg text-ink-900 tracking-tight leading-none">
                FlowBiz
              </span>
              <span className="text-[8px] font-bold text-primary-600 uppercase tracking-wider leading-none mt-1">
                Business Manager
              </span>
            </div>
          </Link>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="flex items-center gap-6 xl:gap-8 text-xs sm:text-sm font-semibold text-ink-600 pointer-events-auto leading-none">
              <a 
                href="#features" 
                className="hover:text-primary-600 transition-colors py-1 px-1"
              >
                Features
              </a>
              <a 
                href="#demo" 
                className="hover:text-primary-600 transition-colors py-1 px-1"
              >
                Demo
              </a>
              <a 
                href="#how-it-works" 
                className="hover:text-primary-600 transition-colors py-1 px-1"
              >
                How It Works
              </a>
              <a 
                href="#pricing" 
                className="hover:text-primary-600 transition-colors py-1 px-1"
              >
                Pricing
              </a>
              <a 
                href="#faq" 
                className="hover:text-primary-600 transition-colors py-1 px-1"
              >
                FAQ
              </a>
            </div>
          </nav>

          {/* Right: Action Buttons */}
          <div className="hidden sm:flex items-center gap-2.5 shrink-0 z-10 leading-none">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-bold text-ink-700 hover:text-ink-900 px-3 py-2 rounded-lg hover:bg-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold hover:bg-primary-700 transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Get Started</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-1.5 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-white z-10"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 border-b border-line bg-white px-6 py-4 space-y-3 shadow-lg">
          <a
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-ink-700 hover:text-primary-600"
          >
            Features
          </a>
          <a
            href="#demo"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-ink-700 hover:text-primary-600"
          >
            Demo
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-ink-700 hover:text-primary-600"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-ink-700 hover:text-primary-600"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={() => setMobileOpen(false)}
            className="block text-sm font-semibold py-1 text-ink-700 hover:text-primary-600"
          >
            FAQ
          </a>
          <div className="pt-2.5 border-t border-line flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full text-center py-2.5 border border-ink-300 rounded-xl text-sm font-bold text-ink-900"
            >
              Sign In
            </Link>
            <Link
              to="/setup"
              className="w-full text-center py-3 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}