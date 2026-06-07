import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket, Shield, Clock, Sparkles, Flame, Calendar, Star } from "lucide-react";
import LeadFormDialog from "./LeadFormDialog";

const urgencyPoints = [
  { icon: Shield, text: "30-dňová garancia" },
  { icon: Clock, text: "Spustenie do 48h" },
  { icon: Sparkles, text: "AI obsah zadarmo" },
];

const useCountdown = (targetDate: Date) => {
  const calcRemaining = () => {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 };
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };

  const [time, setTime] = useState(calcRemaining);

  useEffect(() => {
    const interval = setInterval(() => setTime(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
};

// Set countdown to 23h 59m from first load (persisted in session)
const getTargetDate = () => {
  const key = "cta_countdown_target";
  const stored = sessionStorage.getItem(key);
  if (stored) return new Date(parseInt(stored));
  const target = new Date(Date.now() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000);
  sessionStorage.setItem(key, target.getTime().toString());
  return target;
};

const CountdownBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="text-2xl md:text-3xl font-bold text-primary tabular-nums">
      {String(value).padStart(2, "0")}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

const StrongCtaSection = () => {
  const [target] = useState(getTargetDate);
  const { hours, minutes, seconds } = useCountdown(target);

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 rounded-3xl border-2 border-primary/30 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite] pointer-events-none m-4" />
      <div className="absolute inset-0 rounded-3xl border border-primary/15 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite_0.5s] pointer-events-none m-4" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[400px] h-[300px] bg-accent/5 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 max-w-3xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Spustite svoj nový web{" "}
            <span className="text-gradient">do 48 hodín</span>
          </h2>

          {/* Discount badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 mb-6">
            <Flame className="w-5 h-5 text-primary animate-pulse" />
            <span className="font-bold text-foreground">-10% zľava</span>
            <span className="text-muted-foreground text-sm">pre posledných 15 klientov</span>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <CountdownBlock value={hours} label="hodín" />
            <span className="text-2xl text-muted-foreground font-bold">:</span>
            <CountdownBlock value={minutes} label="minút" />
            <span className="text-2xl text-muted-foreground font-bold">:</span>
            <CountdownBlock value={seconds} label="sekúnd" />
          </div>

          <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-xl mx-auto">
            Neplaťte tisíce eur. Získajte profesionálnu webstránku za jednoduchý mesačný poplatok.
          </p>

          <div className="flex flex-col items-center gap-3 mb-10 w-full">
            <LeadFormDialog initialStep="inquiry">
              <div className="rotating-border p-[2px] max-w-[320px] sm:max-w-none sm:w-auto">
                 <Button variant="gradient" size="lg" className="w-full sm:w-auto px-[10px] sm:px-10 py-4 sm:py-7 text-xs sm:text-lg relative z-10">
                   <Rocket className="mr-1 sm:mr-2 w-3.5 h-3.5 sm:w-5 sm:h-5 flex-shrink-0" /> <span>Chcem AI Web na prenájom s 10% zľavou</span> <ArrowRight className="ml-1 sm:ml-2 w-3.5 h-3.5 sm:w-5 sm:h-5 flex-shrink-0" />
                 </Button>
              </div>
            </LeadFormDialog>
            <LeadFormDialog initialStep="consultation">
              <button className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 inline-flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Konzultácia zdarma
              </button>
            </LeadFormDialog>

            {/* Customer rating */}
            <div className="flex flex-col items-center gap-2 mt-6">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Takto nás hodnotili spokojní zákazníci</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {urgencyPoints.map((p) => (
              <div key={p.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <p.icon className="w-4 h-4 text-primary" />
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default StrongCtaSection;
