import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AiCalculatorWidget from "./AiCalculatorWidget";

import heroVideoFile from "@/assets/hero-video-new.mp4";

const HeroVideoPlayer = () => (
  <div className="relative rounded-2xl overflow-hidden w-full max-w-[90vw] sm:max-w-[460px] mx-auto aspect-[16/13.5] shadow-2xl shadow-primary/20 border border-primary/20">
    <video
      src={heroVideoFile}
      autoPlay
      controls
      playsInline
      className="w-full h-full object-contain bg-black"
    />
  </div>
);

const AnimatedCounter = ({ target, suffix = "", decimals = 0 }: {
  target: number; suffix?: string; decimals?: number;
}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 3800;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Number((eased * target).toFixed(decimals)));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, decimals]);

  return (
    <span ref={ref} className="inline-block min-w-[5.5rem] text-center tabular-nums whitespace-nowrap">
      {count}{suffix}
    </span>
  );
};

/* Floating animated orbs */
const FloatingOrb = ({ className, delay = 0 }: { className?: string; delay?: number }) => (
  <motion.div
    className={`absolute rounded-full pointer-events-none ${className}`}
    animate={{
      y: [0, -30, 0],
      x: [0, 20, 0],
      scale: [1, 1.1, 1],
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const HeroSection = () => {
  const [showCalc, setShowCalc] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showConsult, setShowConsult] = useState(false);
  const [consultDate, setConsultDate] = useState<Date | undefined>(undefined);
  const [consultTime, setConsultTime] = useState<string | undefined>(undefined);
  const [consultName, setConsultName] = useState("");
  const [consultEmail, setConsultEmail] = useState("");
  const [consultPhone, setConsultPhone] = useState("");
  const [consultLoading, setConsultLoading] = useState(false);

  // Global event: any component can call window.dispatchEvent(new Event("open-ai-calculator"))
  useEffect(() => {
    const handler = () => setShowCalc(true);
    window.addEventListener("open-ai-calculator", handler);
    return () => window.removeEventListener("open-ai-calculator", handler);
  }, []);

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultDate || !consultTime || !consultName || !consultEmail) {
      toast.error("Vyplň prosím všetky povinné polia.");
      return;
    }
    setConsultLoading(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: consultName,
        email: consultEmail,
        phone: consultPhone || null,
        message: `KONZULTÁCIA — Termín: ${format(consultDate, "EEEE d. M. yyyy", { locale: sk })} o ${consultTime}`,
        source: "konzultacia-hero",
        status: "new",
        type: "consultation",
        consultation_date: consultDate.toISOString(),
        consultation_time: consultTime,
      } as any);
      if (error) throw error;
      toast.success("Termín odoslaný! Ozveme sa Vám pre potvrdenie.");
      setShowConsult(false);
      setConsultDate(undefined); setConsultTime(undefined);
      setConsultName(""); setConsultEmail(""); setConsultPhone("");
    } catch (err: any) {
      toast.error("Nepodarilo sa odoslať. Skús to znova.");
      console.error(err);
    } finally {
      setConsultLoading(false);
    }
  };

  return (
    <>
      {/* dark wrapper isolates this section to dark theme regardless of global mode */}
      <div className="force-dark dark bg-background text-foreground relative" style={{ colorScheme: "dark" }}>
        <section id="kontakt" className="relative min-h-[90vh] flex items-center overflow-hidden pt-20 pb-16 md:pb-20">
          {/* Animated grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--primary)/0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.5) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          {/* Animated orbs */}
          <FloatingOrb className="top-[10%] left-[5%] w-[400px] h-[400px] bg-primary/20 blur-[120px]" delay={0} />
          <FloatingOrb className="top-[40%] right-[5%] w-[500px] h-[500px] bg-accent/15 blur-[140px]" delay={2} />
          <FloatingOrb className="bottom-[10%] left-[30%] w-[350px] h-[350px] bg-primary/15 blur-[100px]" delay={4} />

          {/* Animated gradient sweep */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" />
          </div>

          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary/60 pointer-events-none"
              style={{
                top: `${15 + i * 12}%`,
                left: `${10 + (i * 17) % 80}%`,
              }}
              animate={{
                y: [0, -40, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 4 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.7,
                ease: "easeInOut",
              }}
            />
          ))}

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* LEFT: text + CTA + stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center lg:text-left min-w-0 order-2 lg:order-1"
              >
                <motion.span
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-primary/40 bg-primary/10 text-primary mb-6 backdrop-blur-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Odštartujte s nami ďalší projekt
                </motion.span>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6">
                  Zastaraný web{" "}
                  <span className="text-gradient">zarába,</span>
                  <br />
                  vašej{" "}
                  <span className="text-gradient">konkurencii!</span>
                </h1>

                <p className="text-lg text-muted-foreground mb-3 max-w-xl mx-auto lg:mx-0 text-slate-50 md:text-xl rounded-none shadow-md opacity-100">
                  Najmodernejšie digitálne riešenia na trhu.
                </p>
                <p className="text-base md:text-lg text-foreground/80 mb-8 max-w-xl mx-auto lg:mx-0">
                  Vyplň formulár a do 24 hodín ti pošleme{" "}
                  <strong className="text-foreground">najvhodnejšie riešenie presne pre tvoj biznis.</strong>
                </p>

                <div className="flex flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start mb-6">
                  <Button variant="gradient" size="lg" className="min-w-0 flex-1 sm:flex-initial px-3 sm:px-8 py-5 sm:py-6 text-[13px] sm:text-lg uppercase tracking-wide"
                    onClick={() => setShowCalc(true)}>
                    <span className="sm:hidden">Riešenie do 24h</span>
                    <span className="hidden sm:inline">Bezplatné riešenie do 24 hodín</span>
                    <ArrowRight className="ml-2 w-5 h-5 shrink-0" />
                  </Button>
                  <button
                    type="button"
                    aria-label="Prehrať video"
                    onClick={() => setShowVideo(true)}
                    className="relative w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 hover:scale-110 transition-transform flex-shrink-0"
                  >
                    <span className="absolute inset-0 rounded-full bg-primary/40" style={{ animation: "ping 3.5s cubic-bezier(0,0,0.2,1) infinite" }} />
                    <span className="absolute inset-0 rounded-full bg-primary/30" style={{ animation: "pulse 3.5s cubic-bezier(0.4,0,0.6,1) infinite" }} />
                    <Play className="w-4 h-4 sm:w-7 sm:h-7 relative z-10 ml-0.5" fill="currentColor" />
                  </button>
                </div>

                {/* Konzultácia CTA */}
                <button
                  type="button"
                  onClick={() => setShowConsult(true)}
                  className="inline-flex items-center gap-2 text-sm text-foreground/90 hover:text-primary transition-colors mb-6 group"
                >
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="border-b border-dashed border-foreground/30 group-hover:border-primary">
                    Naplánuj si bezplatnú konzultáciu
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-row sm:items-center sm:gap-6 justify-center lg:justify-start text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
                  <div className="text-center flex flex-col items-center">
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-none min-h-[2rem] sm:min-h-[2.25rem] flex items-center justify-center">
                      <AnimatedCounter target={100} suffix="+" />
                    </p>
                    <p className="text-[11px] sm:text-xs leading-tight max-w-[7rem] sm:max-w-none">zrealizovaných projektov</p>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-border" />
                  <div className="text-center flex flex-col items-center">
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-none min-h-[2rem] sm:min-h-[2.25rem] flex items-center justify-center">
                      <AnimatedCounter target={11} suffix=" rokov" />
                    </p>
                    <p className="text-[11px] sm:text-xs leading-tight max-w-[7rem] sm:max-w-none">skúsenosti</p>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-border" />
                  <div className="text-center flex flex-col items-center">
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-none min-h-[2rem] sm:min-h-[2.25rem] flex items-center justify-center">
                      <AnimatedCounter target={99.9} suffix="%" decimals={1} />
                    </p>
                    <p className="text-[11px] sm:text-xs leading-tight max-w-[7rem] sm:max-w-none">uptime</p>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT: inline funnel form (above text on mobile) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-full max-w-[560px] mx-auto order-1 lg:order-2"
              >
                <AiCalculatorWidget variant="inline" />
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      <AiCalculatorWidget variant="none" open={showCalc} onOpenChange={setShowCalc} />

      <Dialog open={showVideo} onOpenChange={setShowVideo}>
        <DialogContent className="max-w-3xl p-2 sm:p-3 bg-black border-primary/20">
          <div className="relative rounded-xl overflow-hidden aspect-video w-full">
            <video
              src={heroVideoFile}
              autoPlay
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Konzultácia Dialog */}
      <Dialog open={showConsult} onOpenChange={setShowConsult}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="grid md:grid-cols-[auto_1fr] gap-0">
            {/* Calendar side */}
            <div className="bg-muted/40 p-4 border-b md:border-b-0 md:border-r border-border">
              <DialogHeader className="mb-3">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="w-4 h-4 text-primary" /> Vyber termín
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Bezplatná online konzultácia · 30 minút
                </DialogDescription>
              </DialogHeader>
              <Calendar
                mode="single"
                selected={consultDate}
                onSelect={setConsultDate}
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || d.getDay() === 0 || d.getDay() === 6}
                locale={sk}
                weekStartsOn={1}
                className={cn("p-2 pointer-events-auto bg-background rounded-md border border-border")}
              />
            </div>

            {/* Form side */}
            <form onSubmit={handleConsultSubmit} className="p-5 space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-primary" /> Čas</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setConsultTime(t)}
                      className={cn(
                        "text-xs py-1.5 rounded-md border transition-colors",
                        consultTime === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="c-name" className="text-xs">Meno *</Label>
                <Input id="c-name" value={consultName} onChange={(e) => setConsultName(e.target.value)} required className="h-9 mt-1" />
              </div>
              <div>
                <Label htmlFor="c-email" className="text-xs">E-mail *</Label>
                <Input id="c-email" type="email" value={consultEmail} onChange={(e) => setConsultEmail(e.target.value)} required className="h-9 mt-1" />
              </div>
              <div>
                <Label htmlFor="c-phone" className="text-xs">Telefón</Label>
                <Input id="c-phone" type="tel" value={consultPhone} onChange={(e) => setConsultPhone(e.target.value)} className="h-9 mt-1" />
              </div>

              {consultDate && consultTime && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/30 rounded-md p-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {format(consultDate, "EEEE d. M. yyyy", { locale: sk })} o {consultTime}
                </div>
              )}

              <Button type="submit" disabled={consultLoading} variant="gradient" className="w-full">
                {consultLoading ? "Odosielam..." : "Potvrdiť termín"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">Bez záväzku · termín potvrdíme e-mailom</p>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HeroSection;
