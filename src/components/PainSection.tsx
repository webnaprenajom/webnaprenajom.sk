import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, Search, ShieldX, Users } from "lucide-react";
import { motion } from "framer-motion";
import LeadFormDialog from "./LeadFormDialog";

const painCards = [
  {
    icon: Search,
    stat: "93%",
    title: "zákazníkov hľadá online",
    desc: "Ak nemáte web, jednoducho vás nenájdu.",
  },
  {
    icon: ShieldX,
    stat: "75%",
    title: "posudzuje dôveryhodnosť podľa webu",
    desc: "Bez webu pôsobíte neprofesionálne.",
  },
  {
    icon: Users,
    stat: "3x",
    title: "viac zákazníkov získa konkurencia",
    desc: "Firmy s webom majú jasnú výhodu.",
  },
];

const PainSection = () => (
  <section className="py-24 section-warm relative overflow-hidden">
    {/* Subtle red glow for urgency */}
    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[150px] pointer-events-none" />

    <div className="container mx-auto px-4 max-w-5xl relative z-10">
      <AnimatedSection>
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-destructive/30 text-destructive mb-6">
            <TrendingDown className="w-4 h-4" />
            Strata zákazníkov
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Koľko zákazníkov strácate <span className="text-gradient">bez webu?</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Dnes si väčšina zákazníkov najprv vyhľadá firmu na Google. Bez webu prehrávate.
          </p>
        </div>
      </AnimatedSection>

      <div className="grid md:grid-cols-3 gap-6 mb-14">
        {painCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="card-gradient rounded-2xl p-8 text-center group hover:border-primary/20 transition-all duration-300"
          >
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-destructive/10 group-hover:bg-primary/10 transition-colors">
              <card.icon className="w-7 h-7 text-destructive group-hover:text-primary transition-colors" />
            </div>
            <p className="text-4xl font-bold text-gradient mb-2">{card.stat}</p>
            <p className="font-semibold text-foreground mb-2">{card.title}</p>
            <p className="text-sm text-muted-foreground">{card.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <LeadFormDialog initialStep="inquiry">
          <Button variant="gradient" size="lg" className="px-8 py-6 text-lg">
            Zistiť ako získať viac zákazníkov <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </LeadFormDialog>
      </div>
    </div>
  </section>
);

export default PainSection;
