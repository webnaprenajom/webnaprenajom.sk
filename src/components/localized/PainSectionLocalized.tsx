import AnimatedSection from "../AnimatedSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Search, ShieldX, Users } from "lucide-react";
import { motion } from "framer-motion";
import LeadFormDialogLocalized from "./LeadFormDialogLocalized";
import { useLanguage } from "@/contexts/LanguageContext";

const icons = [Search, ShieldX, Users];

const PainSectionLocalized = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 section-warm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <AnimatedSection>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-destructive/30 text-destructive mb-6">
              <TrendingDown className="w-4 h-4" />{t.pain.badge}
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {t.pain.title} <span className="text-gradient">{t.pain.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.pain.subtitle}</p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6 mb-14">
          {t.pain.cards.map((card, i) => {
            const Icon = icons[i];
            return (
              <motion.div key={card.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }} className="card-gradient rounded-2xl p-8 text-center group hover:border-primary/20 transition-all duration-300">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-destructive/10 group-hover:bg-primary/10 transition-colors">
                  <Icon className="w-7 h-7 text-destructive group-hover:text-primary transition-colors" />
                </div>
                <p className="text-4xl font-bold text-gradient mb-2">{card.stat}</p>
                <p className="font-semibold text-foreground mb-2">{card.title}</p>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <LeadFormDialogLocalized initialStep="inquiry">
            <Button variant="gradient" size="lg" className="px-8 py-6 text-lg">
              {t.pain.cta} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </LeadFormDialogLocalized>
        </div>
      </div>
    </section>
  );
};

export default PainSectionLocalized;
