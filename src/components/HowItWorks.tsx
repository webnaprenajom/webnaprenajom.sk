import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Send, FileCheck, Rocket, Sparkles, ArrowRight } from "lucide-react";
import LeadFormDialog from "./LeadFormDialog";

const steps = [
  { num: 1, icon: Send, title: "Zašlite dopyt", desc: "Napíšte nám alebo si rezervujte bezplatný hovor. Povieme si, čo potrebujete." },
  { num: 2, icon: FileCheck, title: "Pošleme návrh a riešenie", desc: "Pripravíme vizuálny návrh webu a riešenie presne pre váš biznis." },
  { num: 3, icon: Rocket, title: "Objednávka a spustenie", desc: "Odsúhlasíte návrh, spustíme web a vy začnete získavať zákazníkov." },
];

const HowItWorks = () => (
  <section className="py-24 section-warm relative overflow-hidden">
    <div className="container mx-auto px-4 max-w-5xl relative z-10">
      <AnimatedSection>
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
            3 jednoduché kroky
          </span>
          <h2 className="text-3xl md:text-5xl font-bold">
            Váš nový web v <span className="text-gradient">3 krokoch</span>
          </h2>
        </div>
      </AnimatedSection>

      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.3 }}
            className="h-full w-full origin-top bg-gradient-to-b from-primary/40 via-accent/30 to-transparent"
          />
        </div>

        <div className="space-y-12 md:space-y-0">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              className={`md:flex items-center gap-12 md:py-12 ${i % 2 === 0 ? "" : "md:flex-row-reverse"}`}
            >
              <div className={`flex-1 ${i % 2 === 0 ? "md:text-right" : "md:text-left"}`}>
                <div className={`card-gradient rounded-2xl p-8 inline-block ${i % 2 === 0 ? "md:ml-auto" : ""}`}>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="number-badge flex-shrink-0">
                      {s.num}
                    </div>
                    <h3 className="text-xl font-bold">{s.title}</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
              <div className="hidden md:flex items-center justify-center relative z-10">
                <div className="w-16 h-16 rounded-full glow-border bg-card flex items-center justify-center">
                  <s.icon className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div className="flex-1" />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="text-center mt-14">
        <LeadFormDialog initialStep="consultation">
          <Button variant="gradient" size="lg" className="px-8 py-6 text-lg">
            <Sparkles className="w-5 h-5 mr-2" /> Chcem nezáväzný návrh <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </LeadFormDialog>
      </div>
    </div>
  </section>
);

export default HowItWorks;
