import { useState, forwardRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send, ArrowRight, ArrowLeft, Bot, Calendar, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

type Flow = "ai" | "consultation";
type Step = "choose" | "ai-details" | "calendar" | "contact" | "success";

interface LeadFormDialogLocalizedProps {
  children: React.ReactNode;
  initialStep?: "inquiry" | "consultation";
}

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 30 : -30 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -30 : 30 }),
};

const LeadFormDialogLocalized = forwardRef<HTMLDivElement, LeadFormDialogLocalizedProps>(({ children }, ref) => {
  const { lang, t } = useLanguage();
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
  });

  const getAvailableSlots = () => {
    const slots: { date: Date; label: string }[] = [];
    const now = new Date();
    const locale = lang === "de" ? "de-DE" : lang === "en" ? "en-GB" : "sk-SK";
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      if (d.getDay() >= 1 && d.getDay() <= 5) {
        slots.push({ date: d, label: d.toLocaleDateString(locale, { day: "numeric", month: "short", weekday: "short" }) });
      }
    }
    return slots;
  };

  const resetForm = () => {
    setStep("choose");
    setFlow(null);
    setDirection(1);
    setFormData({ name: "", email: "", phone: "", message: "", selectedDate: null, selectedTime: "" });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) resetForm();
  };

  const goTo = (s: Step, dir: number) => {
    setDirection(dir);
    setStep(s);
  };

  const handleChooseAi = () => {
    setFlow("ai");
    goTo("ai-details", 1);
  };

  const handleChooseConsultation = () => {
    setFlow("consultation");
    goTo("calendar", 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({ title: t.form.fillNameEmail, variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          type: flow === "consultation" ? "consultation" : "ai",
          language: lang,
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
  const locale = lang === "de" ? "de-DE" : lang === "en" ? "en-GB" : "sk-SK";

  const stepIndex = step === "choose" ? 0 : step === "ai-details" || step === "calendar" ? 1 : step === "contact" ? 2 : 3;
  const totalSteps = 3;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            <span className="text-gradient">
              {step === "choose" && t.form.chooseTitle}
              {step === "ai-details" && t.form.aiTitle}
              {step === "calendar" && t.form.calendarTitle}
              {step === "contact" && t.form.contactTitle}
              {step === "success" && t.form.successTitle}
            </span>
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
                  <p className="font-semibold text-lg">{t.form.chooseAi}</p>
                  <p className="text-sm text-muted-foreground">{t.form.chooseAiDesc}</p>
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
                  <p className="font-semibold text-lg">{t.form.chooseConsultation}</p>
                  <p className="text-sm text-muted-foreground">{t.form.chooseConsultationDesc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
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
              <p className="text-sm text-muted-foreground">{t.form.aiPrompt}</p>
              <div className="space-y-2">
                <Label htmlFor="ld-message">{t.form.aiLabel}</Label>
                <Textarea
                  id="ld-message"
                  placeholder={t.form.aiPlaceholder}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background border-border min-h-[120px]"
                  maxLength={1000}
                  required
                />
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
                    if (!formData.message.trim()) {
                      toast({ title: t.form.describeNeeds, variant: "destructive" });
                      return;
                    }
                    goTo("contact", 1);
                  }}
                >
                  {t.form.continue} <ArrowRight className="w-4 h-4 ml-2" />
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
              <p className="text-sm text-muted-foreground">{t.form.calendarPrompt}</p>
              
              <div className="space-y-3">
                <Label>{t.form.dayLabel}</Label>
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
                  <Label>{t.form.timeLabel}</Label>
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
                      toast({ title: t.form.selectDayTime, variant: "destructive" });
                      return;
                    }
                    goTo("contact", 1);
                  }}
                >
                  {t.form.continue} <ArrowRight className="w-4 h-4 ml-2" />
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
                  ? `${t.form.contactPromptConsultation} ${formData.selectedDate?.toLocaleDateString(locale, { day: "numeric", month: "long", weekday: "long" })} - ${formData.selectedTime}`
                  : t.form.contactPromptLast}
              </p>
              <div className="space-y-2">
                <Label htmlFor="ld-name">{t.form.nameLabel}</Label>
                <Input
                  id="ld-name"
                  placeholder={t.form.namePlaceholder}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ld-email">{t.form.emailLabel}</Label>
                <Input
                  id="ld-email"
                  type="email"
                  placeholder={t.form.emailPlaceholder}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-background border-border"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ld-phone">{t.form.phoneLabel}</Label>
                <Input
                  id="ld-phone"
                  type="tel"
                  placeholder={t.form.phonePlaceholder}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-background border-border"
                  maxLength={20}
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => goTo(flow === "ai" ? "ai-details" : "calendar", -1)} className="px-4 py-5">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" variant="gradient" className="flex-1 py-5 text-base">
                  <Send className="w-4 h-4 mr-2" /> {t.form.submit}
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
                {flow === "consultation" ? t.form.successConsultation : t.form.successAi}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {flow === "consultation"
                  ? `${t.form.successConsultationDesc} ${formData.selectedDate?.toLocaleDateString(locale, { day: "numeric", month: "long" })} - ${formData.selectedTime}.`
                  : t.form.successAiDesc}
              </p>
              <p className="text-muted-foreground text-xs">{t.form.successEmail} {formData.email}</p>
              <Button variant="gradient" className="mt-4 px-8 py-5" onClick={() => handleOpenChange(false)}>
                {t.form.close}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});

LeadFormDialogLocalized.displayName = "LeadFormDialogLocalized";

export default LeadFormDialogLocalized;
