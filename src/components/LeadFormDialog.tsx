import { useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send, ArrowRight, ArrowLeft, Bot, Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Flow = "ai" | "consultation" | "redesign";
type Step = "choose" | "ai-type" | "ai-details" | "calendar" | "redesign-reasons" | "redesign-details" | "contact" | "success";

const AI_WEB_TYPES = [
  { id: "business", label: "Firemný / prezentačný web", desc: "Webstránka pre firmu, služby alebo portfólio" },
  { id: "eshop", label: "E-shop / online predaj", desc: "Predaj produktov online s košíkom a platbami" },
  { id: "reservation", label: "Rezervačný / objednávkový systém", desc: "Online rezervácie, objednávky alebo booking" },
];

interface LeadFormDialogProps {
  children: React.ReactNode;
  initialStep?: "inquiry" | "consultation";
}

const REDESIGN_REASONS = [
  { id: "outdated", label: "Zastaraný dizajn", desc: "Web vyzerá nemoderně" },
  { id: "slow", label: "Pomalá stránka", desc: "Načítava sa príliš dlho" },
  { id: "not-mobile", label: "Nefunguje na mobile", desc: "Nie je responzívna" },
  { id: "low-conversions", label: "Nízke konverzie", desc: "Návštevníci nekonvertujú" },
  { id: "rebrand", label: "Zmena značky", desc: "Nové logo, farby, identita" },
  { id: "new-features", label: "Chýbajúce funkcie", desc: "Potrebujem nové funkcie" },
];

const getAvailableSlots = () => {
  const slots: { date: Date; label: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      slots.push({ date: d, label: d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", weekday: "short" }) });
    }
  }
  return slots;
};

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 30 : -30 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -30 : 30 }),
};

const LeadFormDialog = forwardRef<HTMLDivElement, LeadFormDialogProps>(({ children }, ref) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    selectedDate: null as Date | null,
    selectedTime: "",
    redesignReasons: [] as string[],
    aiWebType: "",
  });

  const resetForm = () => {
    setStep("choose");
    setFlow(null);
    setDirection(1);
    setFormData({ name: "", email: "", phone: "", message: "", selectedDate: null, selectedTime: "", redesignReasons: [], aiWebType: "" });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) resetForm();
  };

  // Auto-open pre zľavový kód spravuje samostatný OfferRedeemDialog

  const goTo = (s: Step, dir: number) => {
    setDirection(dir);
    setStep(s);
  };

  const handleChooseAi = () => {
    setFlow("ai");
    goTo("ai-type", 1);
  };

  const handleChooseConsultation = () => {
    setFlow("consultation");
    goTo("calendar", 1);
  };

  const handleChooseRedesign = () => {
    setFlow("redesign");
    goTo("redesign-reasons", 1);
  };

  const toggleRedesignReason = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      redesignReasons: prev.redesignReasons.includes(id)
        ? prev.redesignReasons.filter((r) => r !== id)
        : [...prev.redesignReasons, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({ title: "Vyplňte meno a email", variant: "destructive" });
      return;
    }
    try {
      const aiTypeInfo = flow === "ai" && formData.aiWebType
        ? `\n\nTyp webu: ${AI_WEB_TYPES.find(t => t.id === formData.aiWebType)?.label}`
        : "";
      const redesignInfo = flow === "redesign"
        ? `\n\nDôvody re-dizajnu: ${formData.redesignReasons.map(id => REDESIGN_REASONS.find(r => r.id === id)?.label).join(", ")}`
        : "";

      const { error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: (formData.message || "") + aiTypeInfo + redesignInfo,
          type: flow === "consultation" ? "consultation" : flow === "redesign" ? "redesign" : "ai",
          language: "sk",
          source: flow === "consultation" ? "lead-dialog-consultation" : flow === "redesign" ? "lead-dialog-redesign" : "lead-dialog-ai",
          ...(flow === "consultation" && {
            date: formData.selectedDate?.toISOString(),
            time: formData.selectedTime,
          }),
        },
      });
      if (error) console.error("Lead email error:", error);
    } catch (err) {
      console.error("Lead email failed:", err);
    }
    goTo("success", 1);
  };

  const availableDays = getAvailableSlots();

  const getStepIndex = () => {
    if (step === "choose") return 0;
    if (step === "ai-type" || step === "calendar" || step === "redesign-reasons") return 1;
    if (step === "ai-details" || step === "redesign-details") return 2;
    if (step === "contact") return 3;
    return 4;
  };

  const totalSteps = 4;
  const stepIndex = getStepIndex();

  const getTitle = () => {
    switch (step) {
      case "choose": return "Ako vám môžeme pomôcť?";
      case "ai-type": return "O aký typ webu ide?";
      case "ai-details": return "Popíšte váš projekt";
      case "calendar": return "Vyberte termín konzultácie";
      case "redesign-reasons": return "Prečo chcete re-dizajn?";
      case "redesign-details": return "Popíšte váš web";
      case "contact": return "Kontaktné údaje";
      case "success": return "Ďakujeme!";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            <span className="text-gradient">{getTitle()}</span>
          </DialogTitle>
          {step !== "choose" && step !== "success" && (
            <div className="flex items-center gap-2 pt-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? "bg-primary" : "bg-primary/20"}`} />
              ))}
            </div>
          )}
        </DialogHeader>

        <AnimatePresence mode="wait" custom={direction}>
          {step === "choose" && (
            <motion.div
              key="choose"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-3 mt-4"
            >
              <button
                onClick={handleChooseAi}
                className="w-full glass-card rounded-xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">Chcem AI návrh zadarmo</p>
                  <p className="text-sm text-muted-foreground">Popíšte čo potrebujete a dostanete návrh</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={handleChooseRedesign}
                className="w-full glass-card rounded-xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <RefreshCw className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">Re-dizajn webstránky</p>
                  <p className="text-sm text-muted-foreground">Už máte web, ale chcete ho zmeniť</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={handleChooseConsultation}
                className="w-full glass-card rounded-xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">Naplánovať konzultáciu</p>
                  <p className="text-sm text-muted-foreground">Vyberte si termín a porozprávame sa</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </motion.div>
          )}

          {step === "ai-type" && (
            <motion.div
              key="ai-type"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">Vyberte typ webstránky, ktorú potrebujete.</p>
              <div className="grid grid-cols-1 gap-2">
                {AI_WEB_TYPES.map((type) => {
                  const selected = formData.aiWebType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, aiWebType: type.id })}
                      className={`rounded-xl px-4 py-3 text-left border transition-all flex items-center gap-3 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo("choose", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 py-5 text-base"
                  onClick={() => {
                    if (!formData.aiWebType) {
                      toast({ title: "Vyberte typ webu", variant: "destructive" });
                      return;
                    }
                    goTo("ai-details", 1);
                  }}
                >
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "ai-details" && (
            <motion.div
              key="ai-details"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">Popíšte aký web potrebujete a my vám pripravíme AI návrh zadarmo.</p>
              <div className="space-y-2">
                <Label htmlFor="ld-message">Čo potrebujete? *</Label>
                <Textarea
                  id="ld-message"
                  placeholder="Napr. web pre reštauráciu s online rezerváciami, e-shop s oblečením, portfólio stránka..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background border-border min-h-[120px]"
                  maxLength={1000}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo("ai-type", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 py-5 text-base"
                  onClick={() => {
                    if (!formData.message.trim()) {
                      toast({ title: "Popíšte čo potrebujete", variant: "destructive" });
                      return;
                    }
                    goTo("contact", 1);
                  }}
                >
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "redesign-reasons" && (
            <motion.div
              key="redesign-reasons"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">Vyberte dôvody, prečo chcete zmeniť svoj web (môžete vybrať viacero).</p>
              <div className="grid grid-cols-1 gap-2">
                {REDESIGN_REASONS.map((reason) => {
                  const selected = formData.redesignReasons.includes(reason.id);
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => toggleRedesignReason(reason.id)}
                      className={`rounded-xl px-4 py-3 text-left border transition-all flex items-center gap-3 ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40 text-foreground"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{reason.label}</p>
                        <p className="text-xs text-muted-foreground">{reason.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo("choose", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 py-5 text-base"
                  onClick={() => {
                    if (formData.redesignReasons.length === 0) {
                      toast({ title: "Vyberte aspoň jeden dôvod", variant: "destructive" });
                      return;
                    }
                    goTo("redesign-details", 1);
                  }}
                >
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "redesign-details" && (
            <motion.div
              key="redesign-details"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">Popíšte váš súčasný web a čo by ste chceli zmeniť.</p>
              <div className="space-y-2">
                <Label htmlFor="ld-redesign-msg">Vaša správa *</Label>
                <Textarea
                  id="ld-redesign-msg"
                  placeholder="Napr. URL vášho webu, čo sa vám nepáči, aké zmeny si predstavujete..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background border-border min-h-[120px]"
                  maxLength={1000}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo("redesign-reasons", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 py-5 text-base"
                  onClick={() => {
                    if (!formData.message.trim()) {
                      toast({ title: "Popíšte čo potrebujete", variant: "destructive" });
                      return;
                    }
                    goTo("contact", 1);
                  }}
                >
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "calendar" && (
            <motion.div
              key="calendar"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">Vyberte deň a čas pre bezplatnú 15-min konzultáciu.</p>
              
              <div className="space-y-3">
                <Label>Deň</Label>
                <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {availableDays.map((slot) => (
                    <button
                      key={slot.date.toISOString()}
                      type="button"
                      onClick={() => setFormData({ ...formData, selectedDate: slot.date })}
                      className={`rounded-lg px-3 py-2 text-sm border transition-all ${
                        formData.selectedDate?.toDateString() === slot.date.toDateString()
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/40 text-foreground"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.selectedDate && (
                <div className="space-y-2">
                  <Label>Čas</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setFormData({ ...formData, selectedTime: time })}
                        className={`rounded-lg px-3 py-2 text-sm border transition-all ${
                          formData.selectedTime === time
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:border-primary/40 text-foreground"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo("choose", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  className="flex-1 py-5 text-base"
                  onClick={() => {
                    if (!formData.selectedDate || !formData.selectedTime) {
                      toast({ title: "Vyberte deň a čas", variant: "destructive" });
                      return;
                    }
                    goTo("contact", 1);
                  }}
                >
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "contact" && (
            <motion.form
              key="contact"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
            >
              <p className="text-sm text-muted-foreground">
                {flow === "consultation"
                  ? `Konzultácia: ${formData.selectedDate?.toLocaleDateString("sk-SK", { day: "numeric", month: "long", weekday: "long" })} o ${formData.selectedTime}`
                  : flow === "redesign"
                  ? "Posledný krok — pošleme vám návrh riešenia re-dizajnu"
                  : "Posledný krok — vaše kontaktné údaje"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="ld-name">Meno a priezvisko *</Label>
                <Input
                  id="ld-name"
                  placeholder="Ján Novák"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ld-email">Email *</Label>
                <Input
                  id="ld-email"
                  type="email"
                  placeholder="jan@firma.sk"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-background border-border"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ld-phone">Telefón</Label>
                <Input
                  id="ld-phone"
                  type="tel"
                  placeholder="+421 9XX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-background border-border"
                  maxLength={20}
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo(flow === "ai" ? "ai-details" : flow === "redesign" ? "redesign-details" : "calendar", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" variant="gradient" className="flex-1 py-5 text-base">
                  <Send className="w-4 h-4 mr-2" /> {flow === "redesign" ? "Získať návrh riešenia" : "Odoslať"}
                </Button>
              </div>
            </motion.form>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center py-8 space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              >
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold text-foreground">
                {flow === "consultation" ? "Konzultácia zarezervovaná!" : flow === "redesign" ? "Dopyt na re-dizajn odoslaný!" : "Dopyt úspešne odoslaný!"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {flow === "consultation"
                  ? `Ozveme sa vám na potvrdenie termínu ${formData.selectedDate?.toLocaleDateString("sk-SK", { day: "numeric", month: "long" })} o ${formData.selectedTime}.`
                  : flow === "redesign"
                  ? "Pripravíme návrh riešenia re-dizajnu a pošleme vám ho na email. Zvyčajne do 24 hodín."
                  : "Váš AI návrh pripravíme a pošleme vám ho na email. Zvyčajne do 24 hodín."}
              </p>
              <p className="text-muted-foreground text-xs">Odpoveď dostanete na {formData.email}</p>
              <Button variant="gradient" className="mt-4 px-8 py-5" onClick={() => handleOpenChange(false)}>
                Zavrieť
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});

LeadFormDialog.displayName = "LeadFormDialog";

export default LeadFormDialog;
