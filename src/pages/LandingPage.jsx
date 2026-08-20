import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { FeatureGrid } from '../components/landing/FeatureGrid';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PricingComparison } from '../components/landing/PricingComparison';
import { FaqSection } from '../components/landing/FaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf6ef] text-[#15171d] flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        
        <FeatureGrid />
        <HowItWorks />
        <PricingComparison />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}