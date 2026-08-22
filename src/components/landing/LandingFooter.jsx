import { Link } from 'react-router-dom';
import { Mail, Shield, FileText, ArrowRight } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="bg-[#15171d] text-[#cfd3da] border-t border-[#2b303c] pt-14 pb-10 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        


        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
             
              <span className="font-bold text-xl text-white tracking-tight">FlowBiz</span>
            </div>
            <p className="text-xs text-[#9aa2b1] max-w-sm leading-relaxed">
              The offline-first Point of Sale, inventory intelligence, and cash-flow management platform purpose-built for Kenyan retailers and small businesses.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-[#767f8f]">
              <span>Nairobi, Kenya</span>
              <span>·</span>
              <a href="mailto:support@flowbiz.co.ke" className="hover:text-white transition-colors flex items-center gap-1">
                <Mail className="h-3 w-3" /> support@flowbiz.co.ke
              </a>
            </div>
          </div>

          {/* Application Navigation */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white block">
              Application
            </span>
            <ul className="space-y-2 text-[#9aa2b1]">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  POS Features
                </a>
              </li>
              <li>
                <a href="#simulator" className="hover:text-white transition-colors">
                  Live Simulator
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Trust: Tight Spacing, No Sign In */}
       {/* Column 3: Legal & Compliance */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white block">
              Trust & Legal
            </span>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#54b67c]" />
                  Privacy Policy (KDPA 2019)
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#54b67c]" />
                  Terms of Service
                </Link>
              </li>
             
            </ul>
          </div>

        </div>

        {/* Bottom Line */}
        <div className="pt-8 border-t border-[#2b303c] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#767f8f]">
          <p>© {new Date().getFullYear()} FlowBiz. All rights reserved.</p>
          
        </div>

      </div>
    </footer>
  );
}