import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { Language } from "@/i18n/translations";
import HeroSectionLocalized from "@/components/localized/HeroSectionLocalized";
import SocialProofSectionLocalized from "@/components/localized/SocialProofSectionLocalized";
import SolutionSectionLocalized from "@/components/localized/SolutionSectionLocalized";
import BenefitsGridLocalized from "@/components/localized/BenefitsGridLocalized";
import HowItWorksLocalized from "@/components/localized/HowItWorksLocalized";
import AiLeadMagnetLocalized from "@/components/localized/AiLeadMagnetLocalized";
import TargetAudienceSectionLocalized from "@/components/localized/TargetAudienceSectionLocalized";
import FaqSectionLocalized from "@/components/localized/FaqSectionLocalized";
import StrongCtaSectionLocalized from "@/components/localized/StrongCtaSectionLocalized";
import StickyHeaderLocalized from "@/components/localized/StickyHeaderLocalized";
import FloatingCtaLocalized from "@/components/localized/FloatingCtaLocalized";
import FooterSectionLocalized from "@/components/localized/FooterSectionLocalized";
import PartnersMarquee from "@/components/PartnersMarquee";
import FixedThemeToggle from "@/components/FixedThemeToggle";
import MobileBottomBarLocalized from "@/components/localized/MobileBottomBarLocalized";
import CookieBanner from "@/components/CookieBanner";

interface LocalizedPageProps {
  lang: Language;
}

const LocalizedPage = ({ lang }: LocalizedPageProps) => (
  <LanguageProvider lang={lang}>
    <div className="min-h-screen bg-background">
      <FixedThemeToggle />
      <StickyHeaderLocalized />
      <HeroSectionLocalized />
      <SocialProofSectionLocalized />
      <SolutionSectionLocalized />
      <div className="section-divider" />
      <BenefitsGridLocalized />
      <HowItWorksLocalized />
      <div className="section-divider" />
      <AiLeadMagnetLocalized />
      <TargetAudienceSectionLocalized />
      <FaqSectionLocalized />
      <StrongCtaSectionLocalized />
      <PartnersMarquee />
      <FooterSectionLocalized />
      <FloatingCtaLocalized />
      <MobileBottomBarLocalized />
      <CookieBanner />
    </div>
  </LanguageProvider>
);

export default LocalizedPage;
