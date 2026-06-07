import { ShieldCheck, Star, Facebook, Instagram } from "lucide-react";
import AnimatedSection from "./AnimatedSection";

const TrustBarSection = () => {
  return (
    <section className="relative py-12 md:py-14 overflow-hidden">
      <div className="container mx-auto px-4 max-w-5xl">
        <AnimatedSection>
          {/* Trust badges */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <span className="text-base md:text-lg font-semibold text-foreground">
                Garancia spokojnosti a vrátenia peňazí
              </span>
            </div>

            <div className="hidden sm:block w-px h-10 bg-border" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary fill-primary" />
              </div>
              <span className="text-base md:text-lg font-semibold text-foreground">
                Najlepšie recenzie na Google
              </span>
            </div>
          </div>

          {/* Socials */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Sledujte nás
            </span>
            <a
              href="https://www.facebook.com/salelogics"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a
              href="https://www.instagram.com/salelogics"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://g.page/r/salelogics/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-sm font-semibold"
            >
              <Star className="w-4 h-4 fill-current" />
              Google recenzie
            </a>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default TrustBarSection;
