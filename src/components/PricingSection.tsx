import { useState } from "react";
import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { Check, Star, ArrowRight, Shield } from "lucide-react";
import { motion } from "framer-motion";
import LeadFormDialog from "./LeadFormDialog";
import { Badge } from "@/components/ui/badge";

type Plan = {
  name: string;
  monthly: number;
  highlight: boolean;
  badge?: string;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Starter",
    monthly: 35,
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
    monthly: 47,
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
    monthly: 59,
    highlight: false,
    features: [
      "všetko z Professional",
      "pokročilé AI nástroje",
      "prioritná podpora",
      "prémiový dizajn",
    ],
  },
];

const ANNUAL_DISCOUNT = 0.1;

const PricingSection = () => {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
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

        {/* Billing toggle */}
        <div className="flex justify-center mt-8">
          <div className="relative inline-flex items-center p-1 rounded-full bg-secondary/60 border border-border/60 backdrop-blur">
            <button
              onClick={() => setBilling("monthly")}
              className={`relative z-10 px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                billing === "monthly" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mesačne
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`relative z-10 px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
                billing === "annual" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ročný prenájom
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                billing === "annual" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
              }`}>
                −10 %
              </span>
            </button>
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="absolute inset-y-1 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/30"
              style={{
                left: billing === "monthly" ? 4 : "50%",
                right: billing === "monthly" ? "50%" : 4,
              }}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-10 mb-14">
          {plans.map((plan, i) => {
            const monthly = plan.monthly;
            const effective = billing === "annual" ? monthly * (1 - ANNUAL_DISCOUNT) : monthly;
            const displayPrice = effective % 1 === 0 ? effective.toFixed(0) : effective.toFixed(2);
            const annualTotal = Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));

            return (
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
                <div className="mb-1 mt-4 flex items-baseline gap-2">
                  {billing === "annual" && (
                    <span className="text-xl font-bold text-muted-foreground line-through opacity-70">
                      {monthly}€
                    </span>
                  )}
                  <span className="text-5xl font-bold">{displayPrice}€</span>
                  <span className="text-muted-foreground text-sm">/ mesačne</span>
                </div>
                {billing === "annual" ? (
                  <p className="text-sm text-primary mb-6">
                    Pri ročnej platbe — fakturované {annualTotal}€ / rok (ušetríte 10 %)
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/80 mb-6">
                    Bez záväzkov, fakturované mesačne
                  </p>
                )}

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
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
