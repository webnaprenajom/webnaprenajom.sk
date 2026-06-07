import HeroSection from "@/components/HeroSection";
import SocialProofSection from "@/components/SocialProofSection";
import BlogSection from "@/components/BlogSection";
import WheelOfFortuneSection from "@/components/WheelOfFortuneSection";
import ModelSelectionSection from "@/components/ModelSelectionSection";

import FaqSection from "@/components/FaqSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import TrustBarSection from "@/components/TrustBarSection";
import StickyHeader from "@/components/StickyHeader";
import FloatingCta from "@/components/FloatingCta";
import FooterSection from "@/components/FooterSection";
import PartnersMarquee from "@/components/PartnersMarquee";
import FixedThemeToggle from "@/components/FixedThemeToggle";
import MobileBottomBar from "@/components/MobileBottomBar";
import CookieBanner from "@/components/CookieBanner";

const Index = () => (
  <div className="min-h-screen bg-background">
    <FixedThemeToggle />
    <StickyHeader />
    <HeroSection />
    <SocialProofSection />
    <WheelOfFortuneSection />
    <BlogSection />
    <div className="section-divider" />
    <ModelSelectionSection />
    <TestimonialsSection />
    <TrustBarSection />
    <FaqSection />
    <PartnersMarquee />
    <FooterSection />
    <FloatingCta />
    <MobileBottomBar />
    <CookieBanner />
  </div>
);

export default Index;
