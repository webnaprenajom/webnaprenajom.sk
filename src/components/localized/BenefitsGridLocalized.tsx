import AnimatedSection from "../AnimatedSection";
import { motion } from "framer-motion";
import { DollarSign, Zap, Bot, Shield, Smartphone, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const icons = [DollarSign, Zap, Bot, Shield, Smartphone, TrendingUp];

const BenefitsGridLocalized = () => {
  const { t } = useLanguage();

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2" />
      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <AnimatedSection>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">{t.benefits.badge}</span>
            <h2 className="text-3xl md:text-5xl font-bold">
              {t.benefits.title}{" "}<span className="text-gradient">{t.benefits.titleHighlight}</span>
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.benefits.items.map((b, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="card-elevated rounded-2xl p-7 group hover:border-primary/20 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="number-badge mb-5">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BenefitsGridLocalized;
