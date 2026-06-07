import AnimatedSection from "./AnimatedSection";
import { motion } from "framer-motion";
import { Bot, Sparkles, Eye, Palette, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadFormDialog from "./LeadFormDialog";

const features = [
  { icon: Eye, title: "Ukážka dizajnu", desc: "Uvidíte vizuálny návrh pre váš biznis ešte pred objednávkou." },
  { icon: Palette, title: "Farebná schéma", desc: "AI navrhne farby a štýl podľa vášho odvetvia." },
  { icon: FileText, title: "Texty a štruktúra", desc: "Dostanete návrh obsahu a rozloženia stránok." },
];

const AiLeadMagnet = () => (
  <section className="py-24 relative overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[600px] h-[600px] bg-accent/8 rounded-full blur-[140px]" />
    </div>

    <div className="container mx-auto px-4 max-w-5xl relative z-10">
      <AnimatedSection>
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 text-primary mb-6">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">AI nástroj – zadarmo</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Váš web navrhne{" "}
            <span className="text-gradient">AI za vás</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Do 24 hodín vám zašleme aj navrhovaný vizuál. Úplne zadarmo.
          </p>
        </div>
      </AnimatedSection>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.12 }}
            className="card-gradient rounded-2xl p-7 text-center"
          >
            <div className="number-badge mx-auto mb-5">
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <LeadFormDialog initialStep="inquiry">
          <Button variant="gradient" size="lg" className="w-full sm:w-auto px-6 sm:px-10 py-6 text-base sm:text-lg">
            <Sparkles className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>Získať web bez vstupnej investície</span>
            <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
          </Button>
        </LeadFormDialog>
        <p className="text-xs text-muted-foreground mt-4">Žiadne záväzky. Odpovieme do 24 hodín.</p>
      </div>
    </div>
  </section>
);

export default AiLeadMagnet;
