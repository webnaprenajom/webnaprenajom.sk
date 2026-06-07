import AnimatedSection from "./AnimatedSection";
import BlogSection from "./BlogSection";
import { DollarSign, Zap, Bot, Shield, Smartphone, TrendingUp, Clock, Sparkles, Globe, Cpu, Wallet, HeadphonesIcon } from "lucide-react";

const benefitsMarquee = [
  { icon: Wallet, label: "0€ vstupné náklady" },
  { icon: Clock, label: "Web do 48 hodín" },
  { icon: Bot, label: "AI obsah zadarmo" },
  { icon: Sparkles, label: "Moderný dizajn" },
  { icon: Shield, label: "SSL & GDPR v cene" },
  { icon: Smartphone, label: "Plne responzívny" },
  { icon: TrendingUp, label: "SEO optimalizácia" },
  { icon: Cpu, label: "AI chatbot 24/7" },
  { icon: HeadphonesIcon, label: "Podpora v cene" },
  { icon: Globe, label: "Multi-jazyčnosť" },
  { icon: DollarSign, label: "Od 35€/mesiac" },
  { icon: Zap, label: "Bleskovo rýchly" },
];

const BenefitsGrid = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />

      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <AnimatedSection>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
              Výhody
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">
              Prečo firmy prechádzajú na{" "}
              <span className="text-gradient">AI web na prenájom</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-4">
              Porovnajte si tradičný prístup s moderným riešením
            </p>
          </div>
        </AnimatedSection>

        {/* Auto-scrolling benefits slider */}
        <div className="relative mb-16 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
          <div className="flex animate-marquee gap-4 items-center w-max py-2">
            {[...benefitsMarquee, ...benefitsMarquee].map((b, i) => (
              <div
                key={`${b.label}-${i}`}
                className="flex-shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-full border border-primary/20 bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10 transition-all duration-300"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Blog inline (replaces previous agency vs rental comparison) */}
      <BlogSection />
    </section>
  );
};

export default BenefitsGrid;
