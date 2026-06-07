import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send, ArrowRight, ArrowLeft, CheckCircle2, Gift, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "offer" | "contact" | "success";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 30 : -30 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -30 : 30 }),
};

const OfferRedeemDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState({
    discountCode: "",
    note: "",
    name: "",
    email: "",
    phone: "",
  });

  // Detekcia ?discount= alebo #kontakt?discount= v URL
  useEffect(() => {
    const detect = () => {
      try {
        const search = window.location.search || "";
        const hash = window.location.hash || "";
        const params = new URLSearchParams(search);
        const hashIdx = hash.indexOf("?");
        const hashParams = hashIdx >= 0 ? new URLSearchParams(hash.substring(hashIdx + 1)) : new URLSearchParams();
        const discount = (params.get("discount") || hashParams.get("discount") || "").toUpperCase();
        if (discount) {
          setData((prev) => ({ ...prev, discountCode: discount }));
          setOpen(true);
        }
      } catch (_) {
        // noop
      }
    };
    detect();
    window.addEventListener("hashchange", detect);
    const onOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ code?: string; note?: string }>).detail || {};
      const code = (detail.code || "").toUpperCase();
      setData((prev) => ({
        ...prev,
        discountCode: code || prev.discountCode,
        note: detail.note ?? prev.note,
      }));
      setStep("offer");
      setDirection(1);
      setOpen(true);
    };
    window.addEventListener("open-offer-redeem", onOpenEvent as EventListener);
    return () => {
      window.removeEventListener("hashchange", detect);
      window.removeEventListener("open-offer-redeem", onOpenEvent as EventListener);
    };
  }, []);

  const reset = () => {
    setStep("offer");
    setDirection(1);
    setData({ discountCode: "", note: "", name: "", email: "", phone: "" });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Vyčistíme URL aby sa pri ďalšom hashchange nezobrazil znova
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("discount");
        if (url.hash.includes("discount=")) {
          const hash = url.hash.split("?")[0];
          url.hash = hash;
        }
        window.history.replaceState({}, "", url.toString());
      } catch (_) {}
      reset();
    }
  };

  const goTo = (s: Step, dir: number) => {
    setDirection(dir);
    setStep(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.email.trim()) {
      toast({ title: "Vyplňte meno a email", variant: "destructive" });
      return;
    }
    const code = data.discountCode.trim().toUpperCase();
    const messageParts: string[] = [];
    if (code) messageParts.push(`🎁 Zľavový kód: ${code}`);
    if (data.note.trim()) messageParts.push(data.note.trim());
    const message = messageParts.join("\n\n");

    try {
      const { error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          message,
          type: "offer",
          language: "sk",
          source: "offer-email-cta",
        },
      });
      if (error) console.error("Lead email error:", error);
    } catch (err) {
      console.error("Lead email failed:", err);
    }
    goTo("success", 1);
  };

  const stepIndex = step === "offer" ? 0 : step === "contact" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            <span className="text-gradient">
              {step === "offer" && "Aktivujte si zľavu"}
              {step === "contact" && "Kontaktné údaje"}
              {step === "success" && "Ďakujeme!"}
            </span>
          </DialogTitle>
          {step !== "success" && (
            <div className="flex items-center gap-2 pt-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= stepIndex ? "bg-primary" : "bg-primary/20"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        <AnimatePresence mode="wait" custom={direction}>
          {step === "offer" && (
            <motion.div
              key="offer"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4 mt-4"
            >
              <div className="rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Zľava −10 % z prvých 3 mesiacov</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skontrolujte kód a napíšte nám čo Vás zaujíma. Odpovieme do 24 hodín.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="or-code" className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  Zľavový kód
                </Label>
                <Input
                  id="or-code"
                  placeholder="napr. VITAJTE10"
                  value={data.discountCode}
                  onChange={(e) => setData({ ...data, discountCode: e.target.value.toUpperCase() })}
                  className="bg-background border-border font-mono tracking-wider uppercase"
                  maxLength={30}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="or-note">Poznámka — čo Vás zaujíma?</Label>
                <Textarea
                  id="or-note"
                  placeholder="Napr. potrebujem nový web pre kaviareň, mám záujem o re-dizajn existujúceho webu..."
                  value={data.note}
                  onChange={(e) => setData({ ...data, note: e.target.value })}
                  className="bg-background border-border min-h-[110px]"
                  maxLength={1000}
                />
              </div>

              <Button
                type="button"
                variant="gradient"
                className="w-full py-5 text-base"
                onClick={() => goTo("contact", 1)}
              >
                Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
                Posledný krok — vaše kontaktné údaje, na ktoré Vám pošleme cenovú ponuku so zľavou.
              </p>

              {data.discountCode && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 flex items-center gap-2 text-sm">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Aktívny kód:</span>
                  <span className="font-mono font-bold text-primary tracking-wider">{data.discountCode}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="or-name">Meno a priezvisko *</Label>
                <Input
                  id="or-name"
                  placeholder="Ján Novák"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  className="bg-background border-border"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="or-email">Email *</Label>
                <Input
                  id="or-email"
                  type="email"
                  placeholder="jan@firma.sk"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  className="bg-background border-border"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="or-phone">Telefón</Label>
                <Input
                  id="or-phone"
                  type="tel"
                  placeholder="+421 9XX XXX XXX"
                  value={data.phone}
                  onChange={(e) => setData({ ...data, phone: e.target.value })}
                  className="bg-background border-border"
                  maxLength={20}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goTo("offer", -1)}
                  className="px-4 py-5"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" variant="gradient" className="flex-1 py-5 text-base">
                  <Send className="w-4 h-4 mr-2" /> Odoslať dopyt
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
              <h3 className="text-xl font-semibold text-foreground">Dopyt úspešne odoslaný!</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Pripravíme Vám cenovú ponuku{data.discountCode ? ` so zľavou ${data.discountCode}` : ""} a
                pošleme ju na email do 24 hodín.
              </p>
              <p className="text-muted-foreground text-xs">Odpoveď dostanete na {data.email}</p>
              <Button
                variant="gradient"
                className="mt-4 px-8 py-5"
                onClick={() => handleOpenChange(false)}
              >
                Zavrieť
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default OfferRedeemDialog;
