import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import LeadFormDialog from "./LeadFormDialog";

const agencyItems = [
  "1 000€ – 5 000€ jednorazovo",
  "týždne až mesiace čakania",
  "drahé úpravy navyše",
  "riziko zlej investície",
];

const rentalItems = [
  "od 35€ mesačne, nulová investícia",
  "web online do 48 hodín",
  "úpravy v cene",
  "AI obsah a texty zadarmo",
];

const SolutionSection = () => (
  <section className="py-24 section-alt relative overflow-hidden">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

    <div className="container mx-auto px-4 max-w-5xl relative z-10">
      <AnimatedSection>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Prečo firmy prechádzajú na <span className="text-gradient">AI web na prenájom</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Porovnajte si tradičný prístup s moderným riešením
          </p>
        </div>
      </AnimatedSection>

      <div className="grid md:grid-cols-2 gap-8 mb-14">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-border/50 p-8 bg-secondary/20 relative"
        >
          <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground border border-border">
            Tradičný model
          </div>
          <h3 className="text-xl font-bold mb-6 text-muted-foreground">Webová agentúra</h3>
          <ul className="space-y-4">
            {agencyItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-muted-foreground">
                <X className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-2xl glow-border p-8 bg-secondary/40 relative"
        >
          <div className="absolute -top-3 left-6 px-3 py-1 rounded-full gradient-btn text-xs border-0">
            Odporúčané
          </div>
          <h3 className="text-xl font-bold mb-6 text-gradient">Web na prenájom</h3>
          <ul className="space-y-4">
            {rentalItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-foreground">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="text-center">
        <LeadFormDialog initialStep="inquiry">
          <Button variant="gradient" size="lg" className="px-8 py-6 text-lg">
            AI návrh zadarmo <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </LeadFormDialog>
      </div>
    </div>
  </section>
);

export default SolutionSection;
