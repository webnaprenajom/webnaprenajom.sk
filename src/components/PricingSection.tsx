import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { Check, Star, ArrowRight, Shield } from "lucide-react";
import { motion } from "framer-motion";
import LeadFormDialog from "./LeadFormDialog";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Starter",
    price: "35€",
    period: "mesačne",
    highlight: false,
    features: [
      "základná webstránka",
      "moderný dizajn",
      "mobilná optimalizácia",
      "technická správa",
    ],
  },
  {
    name: "Professional",
    price: "47€",
    period: "mesačne",
    highlight: true,
    badge: "Najobľúbenejšia voľba",
    features: [
      "viacstránkový web",
      "AI pomoc s obsahom",
      "SEO pripravenosť",
      "plná správa webu",
      "marketing ready",
    ],
  },
  {
    name: "Business",
    price: "39€",
    period: "mesačne",
    subtext: "pri ročnej platbe",
    highlight: false,
    features: [
      "všetko z Professional",
      "pokročilé AI nástroje",
      "prioritná podpora",
      "prémiový dizajn",
    ],
  },
];

const PricingSection = () => (
  <section className="py-24 section-alt relative overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

    <div className="container mx-auto px-4 max-w-5xl relative z-10">
      <AnimatedSection>
        <div className="text-center mb-4">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Jednoduchý cenník, <span className="text-gradient">žiadne prekvapenia</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-2">
            Bez skrytých poplatkov. Bez záväzkov. Zrušíte kedykoľvek.
          </p>
          <div className="inline-flex items-center gap-2 text-sm text-primary mt-2">
            <Shield className="w-4 h-4" />
            <span>30-dňová garancia spokojnosti</span>
          </div>
        </div>
      </AnimatedSection>

      <div className="grid md:grid-cols-3 gap-6 mt-14 mb-14">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.12 }}
            className={`rounded-2xl p-8 relative overflow-hidden transition-all duration-300 ${
              plan.highlight
                ? "glow-border bg-secondary/50 md:scale-105 md:-my-4 md:py-12"
                : "border border-border/50 bg-secondary/20 hover:border-border"
            }`}
          >
            {plan.badge && (
              <Badge className="absolute top-4 right-4 gradient-btn border-0 text-xs">
                <Star className="w-3 h-3 mr-1" />
                {plan.badge}
              </Badge>
            )}
            <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? "text-gradient" : ""}`}>
              {plan.name}
            </h3>
            <div className="mb-1 mt-4">
              <span className="text-5xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground ml-1 text-sm">/ {plan.period}</span>
            </div>
            {plan.subtext && (
              <p className="text-sm text-primary mb-6">{plan.subtext}</p>
            )}
            {!plan.subtext && <div className="mb-6" />}

            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-secondary-foreground text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <LeadFormDialog initialStep="inquiry">
              <Button
                variant={plan.highlight ? "gradient" : "gradient-outline"}
                className="w-full py-5"
              >
                {plan.highlight ? (
                  <>Začať teraz <ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  "Vybrať plán"
                )}
              </Button>
            </LeadFormDialog>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
