import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, Sparkles, Crown,
  Calendar, Target, Send, Zap, Copy, X, Shield,
} from "lucide-react";
import {
  GOALS, GOAL_OPTIONS, URGENCY_OPTIONS, INCLUDED_FEATURES, AGENCY_COMPARISON,
  PACKAGES, RECOMMENDED_PACKAGE, RECOMMENDATION_REASONS,
  BILLING_INFO, generateVariableSymbol, TIME_SLOTS, getAvailableSlots,
  type Goal,
} from "./funnel-data";

/* ── animation ── */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

/* ── types ── */
type Step =
  | "goal" | "sub-goal" | "urgency"
  | "whats-included" | "packages" | "recommendation"
  | "order-or-consult" | "order-online" | "consultation-calendar"
  | "contact" | "success";

interface FunnelState {
  goal: Goal | null;
  subGoal: string;
  urgency: string;
  selectedPackage: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  selectedDate: Date | null;
  selectedTime: string;
  variableSymbol: string;
}

const initialState: FunnelState = {
  goal: null,
  subGoal: "",
  urgency: "",
  selectedPackage: "",
  name: "",
  company: "",
  email: "",
  phone: "",
  message: "",
  selectedDate: null,
  selectedTime: "",
  variableSymbol: "",
};

const TOTAL_STEPS = 7;

/* ── Reusable option card ── */
const OptionCard = ({ emoji, label, desc, active, onClick, badge, highlight }: {
  emoji: string; label: string; desc: string; active: boolean; onClick: () => void;
  badge?: string; highlight?: boolean;
}) => (
  <button type="button" onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full group ${
      active ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
        : highlight ? "border-primary/40 bg-primary/5 hover:border-primary/60"
        : "border-border bg-card hover:border-primary/40"
    }`}>
    <span className="text-xl flex-shrink-0">{emoji}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-sm text-foreground">{label}</p>
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{badge}</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
      active ? "border-primary bg-primary" : "border-muted-foreground/30"
    }`}>
      {active && <Check className="w-3 h-3 text-primary-foreground" />}
    </div>
  </button>
);

/* ── Step wrapper ── */
const StepWrap = ({ stepKey, direction, children }: { stepKey: string; direction: number; children: React.ReactNode }) => (
  <motion.div key={stepKey} custom={direction} variants={slideVariants}
    initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}
    className="space-y-4 mt-2">
    {children}
  </motion.div>
);

/* ── Nav buttons ── */
const NavButtons = ({ onBack, onNext, nextLabel = "Pokračovať", nextDisabled = false }: {
  onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) => (
  <div className="flex gap-3 pt-2">
    <Button type="button" variant="outline" onClick={onBack} className="px-4 py-5">
      <ArrowLeft className="w-4 h-4" />
    </Button>
    <Button type="button" variant="gradient" className="flex-1 py-5 text-base" disabled={nextDisabled} onClick={onNext}>
      {nextLabel} <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  </div>
);

/* ═══════════════════════════════════════════════════════════ */
export default function HeroFunnelForm({ open, onOpenChange, inline = false }: { open?: boolean; onOpenChange?: (v: boolean) => void; inline?: boolean }) {
  const [step, setStep] = useState<Step>("goal");
  const [dir, setDir] = useState(1);
  const [state, setState] = useState<FunnelState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  const update = (partial: Partial<FunnelState>) => setState(prev => ({ ...prev, ...partial }));
  const goTo = (s: Step, d: number) => { setDir(d); setStep(s); };

  const reset = () => { setStep("goal"); setDir(1); setState(initialState); };
  const handleOpenChange = (v: boolean) => { onOpenChange?.(v); if (!v) reset(); };

  const availableDays = useMemo(() => getAvailableSlots(), []);

  const recommendedPkgId = state.goal ? RECOMMENDED_PACKAGE[state.goal] : "business";
  const selectedPkg = PACKAGES.find(p => p.id === state.selectedPackage) || PACKAGES[1];

  // Auto-set recommended package when entering packages step
  const ensurePackageSelected = () => {
    if (!state.selectedPackage) {
      update({ selectedPackage: recommendedPkgId });
    }
  };

  // ── Progress ──
  const stepNumber: Record<Step, number> = {
    "goal": 1, "sub-goal": 2, "urgency": 3,
    "whats-included": 4, "packages": 5, "recommendation": 6,
    "order-or-consult": 7, "order-online": 7, "consultation-calendar": 7,
    "contact": 7, "success": 7,
  };

  const currentStep = stepNumber[step] || 1;

  // ── Submit ──
  const handleSubmit = async () => {
    if (!state.name.trim() || !state.email.trim()) {
      toast({ title: "Vyplňte meno a email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const goalLabel = GOALS.find(g => g.id === state.goal)?.label || "";
      const subGoalLabel = state.goal ? GOAL_OPTIONS[state.goal]?.find(o => o.id === state.subGoal)?.label || "" : "";
      const urgLabel = URGENCY_OPTIONS.find(u => u.id === state.urgency)?.label || "";

      const details = [
        `Cieľ: ${goalLabel}`,
        `Podrobnejšie: ${subGoalLabel}`,
        `Urgentnosť: ${urgLabel}`,
        `Balík: ${selectedPkg.name} (${state.variableSymbol ? selectedPkg.discountedPrice : selectedPkg.price}€/mes)`,
        state.company && `Firma: ${state.company}`,
        state.variableSymbol && `VS: ${state.variableSymbol}`,
        state.message && `Správa: ${state.message}`,
      ].filter(Boolean).join("\n");

      await supabase.functions.invoke("send-lead-email", {
        body: {
          name: state.name,
          email: state.email,
          phone: state.phone,
          message: details,
          type: state.selectedDate ? "consultation" : "order",
          language: "sk",
          source: "hero-funnel",
          ...(state.selectedDate && { date: state.selectedDate.toISOString(), time: state.selectedTime }),
        },
      });
    } catch (err) {
      console.error("Submit error:", err);
    }
    setSubmitting(false);
    goTo("success", 1);
  };

  // ── Title ──
  const getTitle = () => {
    switch (step) {
      case "goal": return "Zistite za 30 sekúnd, aký web vám prinesie zákazníkov";
      case "sub-goal": return state.goal === "earn" ? "Ako chcete zarábať?" : state.goal === "customers" ? "Čo je váš najväčší problém?" : "Aký je hlavný problém?";
      case "urgency": return "Ako rýchlo chcete spustiť?";
      case "whats-included": return "Čo všetko je súčasťou vášho webu?";
      case "packages": return "Vyberte si, aký silný má byť váš web";
      case "recommendation": return `Na základe vašich odpovedí odporúčame: ${selectedPkg.name}`;
      case "order-or-consult": return "Ste jeden krok od vášho nového webu";
      case "order-online": return "Dokončite objednávku";
      case "consultation-calendar": return "Naplánovať bezplatnú konzultáciu";
      case "contact": return "Kontaktné údaje";
      case "success": return "Ďakujeme!";
    }
  };

  const body = (
    <>
        {/* Header */}
        <div className="text-center pt-6 px-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
            <Target className="w-3 h-3" /> Rýchly sprievodca
          </span>
          <h2 className="text-lg md:text-xl font-bold text-foreground">
            <span className="text-gradient">{getTitle()}</span>
          </h2>
          {step === "goal" && (
            <p className="text-sm text-muted-foreground mt-2">Žiadne vstupné náklady. Hotové do 48 hodín.</p>
          )}
          {step !== "goal" && step !== "success" && (
            <div className="flex items-center gap-2 pt-3 max-w-xs mx-auto">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
                  transition={{ duration: 0.4 }} />
              </div>
              <span className="text-xs font-bold text-primary">{currentStep}/{TOTAL_STEPS}</span>
            </div>
          )}
        </div>

        <div className="p-6 pt-2">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ STEP 1: GOAL ═══ */}
            {step === "goal" && (
              <StepWrap stepKey="goal" direction={dir}>
                <p className="text-sm text-muted-foreground">Vyberte, čo chcete dosiahnuť — pripravíme pre vás najlepšie riešenie.</p>
                <div className="space-y-2">
                  {GOALS.map(g => (
                    <OptionCard key={g.id} emoji={g.emoji} label={g.label} desc={g.desc}
                      active={state.goal === g.id}
                      onClick={() => update({ goal: g.id, subGoal: "", selectedPackage: "" })} />
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="gradient" size="lg" className="px-6" disabled={!state.goal}
                    onClick={() => goTo("sub-goal", 1)}>
                    Pokračovať <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </StepWrap>
            )}

            {/* ═══ STEP 2: DYNAMIC SUB-GOAL ═══ */}
            {step === "sub-goal" && state.goal && (
              <StepWrap stepKey="sub-goal" direction={dir}>
                <p className="text-sm text-muted-foreground">Pomôže nám pochopiť, ako má váš web fungovať.</p>
                <div className="space-y-2">
                  {GOAL_OPTIONS[state.goal].map(o => (
                    <OptionCard key={o.id} emoji={o.emoji} label={o.label} desc={o.desc}
                      active={state.subGoal === o.id}
                      onClick={() => update({ subGoal: o.id })} />
                  ))}
                </div>
                <NavButtons onBack={() => goTo("goal", -1)} nextDisabled={!state.subGoal}
                  onNext={() => goTo("urgency", 1)} />
              </StepWrap>
            )}

            {/* ═══ STEP 3: URGENCY ═══ */}
            {step === "urgency" && (
              <StepWrap stepKey="urgency" direction={dir}>
                <p className="text-sm text-muted-foreground">Podľa toho prispôsobíme najlepší prístup.</p>
                <div className="space-y-2">
                  {URGENCY_OPTIONS.map(u => (
                    <OptionCard key={u.id} emoji={u.emoji} label={u.label} desc={u.desc}
                      active={state.urgency === u.id}
                      onClick={() => update({ urgency: u.id })} />
                  ))}
                </div>
                <NavButtons onBack={() => goTo("sub-goal", -1)} nextDisabled={!state.urgency}
                  onNext={() => goTo("whats-included", 1)} />
              </StepWrap>
            )}

            {/* ═══ STEP 4: WHAT'S INCLUDED + COMPARISON ═══ */}
            {step === "whats-included" && (
              <StepWrap stepKey="included" direction={dir}>
                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  <p className="text-sm text-foreground font-medium text-center">
                    Nemusíte písať texty ani nič dizajnovať — všetko pripravíme za vás.
                  </p>
                  {/* Included features */}
                  <div className="grid grid-cols-2 gap-2">
                    {INCLUDED_FEATURES.map(f => (
                      <div key={f.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <span className="text-base">{f.emoji}</span>
                        <p className="text-xs font-medium text-foreground">{f.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center italic">
                    Nepotrebujete programátorov, dizajnérov ani technické znalosti.
                  </p>

                  {/* Comparison */}
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2.5 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <p className="text-sm font-bold text-foreground">Koľko by to stálo inde?</p>
                    </div>
                    <div className="divide-y divide-border">
                      {AGENCY_COMPARISON.map(row => (
                        <div key={row.feature} className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs">
                          <span className="font-medium text-foreground">{row.feature}</span>
                          <span className="text-muted-foreground line-through">{row.agency}</span>
                          <span className="text-primary font-bold">{row.us}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <NavButtons onBack={() => goTo("urgency", -1)}
                  onNext={() => { ensurePackageSelected(); goTo("packages", 1); }}
                  nextLabel="Pozrieť balíky" />
              </StepWrap>
            )}

            {/* ═══ STEP 5: PACKAGES ═══ */}
            {step === "packages" && (
              <StepWrap stepKey="packages" direction={dir}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">💡 Lepšia cena pri online objednávke</span>
                </div>
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {PACKAGES.map(pkg => {
                    const isRecommended = pkg.id === recommendedPkgId;
                    return (
                      <button key={pkg.id} type="button" onClick={() => update({ selectedPackage: pkg.id })}
                        className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${
                          state.selectedPackage === pkg.id ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card hover:border-primary/40"
                        } ${isRecommended ? "ring-1 ring-primary/30" : ""}`}>
                        {isRecommended && (
                          <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                            PRE VÁS IDEÁLNY
                          </span>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl">{pkg.emoji}</span>
                          <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">{pkg.desc}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm line-through text-muted-foreground">{pkg.price}€</p>
                            <p className="text-lg font-bold text-primary">{pkg.discountedPrice}€</p>
                            <p className="text-[10px] text-muted-foreground">/mes</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {pkg.features.map(f => (
                            <div key={f} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Check className="w-3 h-3 text-primary flex-shrink-0" /> {f}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <NavButtons onBack={() => goTo("whats-included", -1)}
                  onNext={() => goTo("recommendation", 1)} />
              </StepWrap>
            )}

            {/* ═══ STEP 6: RECOMMENDATION ═══ */}
            {step === "recommendation" && (
              <StepWrap stepKey="recommendation" direction={dir}>
                <div className="text-center mb-2">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground mb-1">Na základe vašich odpovedí odporúčame:</p>
                  <p className="text-2xl font-bold text-foreground">{selectedPkg.name}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-base line-through text-muted-foreground">{selectedPkg.price}€</span>
                    <span className="text-3xl font-bold text-primary">{selectedPkg.discountedPrice}€</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-1">Zvýhodnená cena pri online objednávke</p>
                </div>

                {state.goal && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm text-foreground font-medium">Prečo je to pre vás ideálne:</p>
                    {RECOMMENDATION_REASONS[state.goal].map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">{reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {["0€ na začiatok", "Viazanosť 12 mesiacov", "Hotové do 48h"].map(tag => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full border border-primary/20 text-primary/80 font-medium">{tag}</span>
                  ))}
                </div>

                <NavButtons onBack={() => goTo("packages", -1)}
                  onNext={() => goTo("order-or-consult", 1)} nextLabel="Pokračovať" />
              </StepWrap>
            )}

            {/* ═══ STEP 7a: ORDER OR CONSULT ═══ */}
            {step === "order-or-consult" && (
              <StepWrap stepKey="order-consult" direction={dir}>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Všetko pripravíme za vás</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Žiadny dlhodobý záväzok</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Spustenie do 48 hodín</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <button type="button" onClick={() => { update({ variableSymbol: generateVariableSymbol() }); goTo("order-online", 1); }}
                    className="w-full glass-card rounded-xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-all group border-2 border-primary/20">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Crown className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-foreground">Objednať a spustiť web</p>
                      <p className="text-sm text-primary font-medium">Lepšia cena — {selectedPkg.discountedPrice}€/mes</p>
                      <p className="text-xs text-muted-foreground">Zvýhodnená cena pri online objednávke</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                  <button type="button" onClick={() => goTo("consultation-calendar", 1)}
                    className="w-full glass-card rounded-xl p-5 flex items-center gap-4 text-left hover:border-primary/40 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Calendar className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-foreground">Naplánovať konzultáciu</p>
                      <p className="text-xs text-muted-foreground">Ešte si nie ste istí? Prejdime to spolu na krátkom hovore.</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </div>
                <div className="flex justify-start pt-2">
                  <Button variant="ghost" size="sm" onClick={() => goTo("recommendation", -1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Späť
                  </Button>
                </div>
              </StepWrap>
            )}

            {/* ═══ STEP 7b: ONLINE ORDER ═══ */}
            {step === "order-online" && (
              <StepWrap stepKey="order" direction={dir}>
                <div className="glass-card rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-sm text-foreground">Fakturačné údaje</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground font-medium">{BILLING_INFO.company}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-muted-foreground text-xs">IBAN: <span className="text-foreground font-mono">{BILLING_INFO.iban}</span></p>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(BILLING_INFO.iban.replace(/\s/g, "")); toast({ title: "IBAN skopírovaný" }); }}
                        className="text-primary hover:text-primary/80"><Copy className="w-3 h-3" /></button>
                    </div>
                    <p className="text-muted-foreground text-xs">SWIFT: {BILLING_INFO.swift}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Mesačná cena</p>
                      <p className="text-2xl font-bold text-primary">{selectedPkg.discountedPrice}€<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                      <p className="text-[10px] text-muted-foreground line-through">{selectedPkg.price}€/mes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Variabilný symbol</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold font-mono text-foreground">{state.variableSymbol}</p>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(state.variableSymbol); toast({ title: "VS skopírovaný" }); }}
                          className="text-primary hover:text-primary/80"><Copy className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center italic">
                  Všetko pripravíme za vás — vy len schválite výsledok.
                </p>
                {renderContactFields(true)}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => goTo("order-or-consult", -1)} className="px-4 py-5">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="gradient" className="flex-1 py-5 text-base"
                    disabled={submitting || !state.name.trim() || !state.email.trim()}
                    onClick={handleSubmit}>
                    <Send className="w-4 h-4 mr-2" /> Objednať a spustiť web
                  </Button>
                </div>
              </StepWrap>
            )}

            {/* ═══ STEP 7c: CONSULTATION ═══ */}
            {step === "consultation-calendar" && (
              <StepWrap stepKey="consult-cal" direction={dir}>
                <p className="text-sm text-muted-foreground">Vyberte deň a čas pre bezplatnú 15-minútovú konzultáciu</p>
                {renderCalendar(() => goTo("order-or-consult", -1))}
              </StepWrap>
            )}

            {/* ═══ CONTACT (after calendar) ═══ */}
            {step === "contact" && (
              <StepWrap stepKey="contact" direction={dir}>
                <p className="text-sm text-muted-foreground">
                  {state.selectedDate
                    ? `Konzultácia: ${state.selectedDate.toLocaleDateString("sk-SK", { day: "numeric", month: "long", weekday: "long" })} o ${state.selectedTime}`
                    : "Vaše kontaktné údaje"}
                </p>
                {renderContactFields(false)}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => goTo("consultation-calendar", -1)} className="px-4 py-5">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="gradient" className="flex-1 py-5 text-base"
                    disabled={submitting || !state.name.trim() || !state.email.trim()}
                    onClick={handleSubmit}>
                    <Send className="w-4 h-4 mr-2" /> Naplánovať hovor
                  </Button>
                </div>
              </StepWrap>
            )}

            {/* ═══ SUCCESS ═══ */}
            {step === "success" && (
              <StepWrap stepKey="success" direction={dir}>
                <div className="flex flex-col items-center text-center py-6 space-y-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}>
                    <CheckCircle2 className="w-16 h-16 text-primary" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {state.variableSymbol ? "Objednávka prijatá!" : state.selectedDate ? "Konzultácia zarezervovaná!" : "Dopyt odoslaný!"}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {state.variableSymbol
                      ? "Po pripísaní platby vám spustíme tvorbu webu. Zvyčajne do 48 hodín."
                      : state.selectedDate
                      ? `Ozveme sa vám na potvrdenie termínu ${state.selectedDate.toLocaleDateString("sk-SK", { day: "numeric", month: "long" })} o ${state.selectedTime}.`
                      : "Pripravíme riešenie a ozveme sa. Zvyčajne do 24 hodín."}
                  </p>
                  <p className="text-muted-foreground text-xs">Odpoveď dostanete na {state.email}</p>
                  <Button variant="gradient" className="mt-4 px-8 py-5" onClick={() => handleOpenChange(false)}>
                    Zavrieť
                  </Button>
                </div>
              </StepWrap>
            )}

          </AnimatePresence>
        </div>
    </>
  );

  if (inline) {
    return (
      <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-primary/10">
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 opacity-30 blur-xl -z-10" />
        {body}
      </div>
    );
  }

  return (
    <Dialog open={!!open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 border-border bg-card overflow-hidden max-h-[90vh] overflow-y-auto">
        {body}
      </DialogContent>
    </Dialog>
  );

  /* ── Shared renders ── */

  function renderCalendar(onBack: () => void) {
    return (
      <>
        <div className="space-y-3">
          <Label className="text-sm">Deň</Label>
          <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1">
            {availableDays.map(slot => (
              <button key={slot.date.toISOString()} type="button"
                onClick={() => update({ selectedDate: slot.date })}
                className={`rounded-lg px-3 py-2 text-sm border transition-all ${
                  state.selectedDate?.toDateString() === slot.date.toDateString()
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/40 text-foreground"
                }`}>
                {slot.label}
              </button>
            ))}
          </div>
        </div>
        {state.selectedDate && (
          <div className="space-y-2">
            <Label className="text-sm">Čas</Label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map(time => (
                <button key={time} type="button"
                  onClick={() => update({ selectedTime: time })}
                  className={`rounded-lg px-3 py-2 text-sm border transition-all ${
                    state.selectedTime === time
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}>
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}
        <NavButtons onBack={onBack}
          nextDisabled={!state.selectedDate || !state.selectedTime}
          onNext={() => goTo("contact", 1)} nextLabel="Naplánovať" />
      </>
    );
  }

  function renderContactFields(showCompany: boolean) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="fn-name" className="text-sm">Meno a priezvisko *</Label>
          <Input id="fn-name" placeholder="Ján Novák" value={state.name}
            onChange={e => update({ name: e.target.value })}
            className="bg-background border-border" maxLength={100} required />
        </div>
        {showCompany && (
          <div className="space-y-1.5">
            <Label htmlFor="fn-company" className="text-sm">Firma</Label>
            <Input id="fn-company" placeholder="Názov firmy" value={state.company}
              onChange={e => update({ company: e.target.value })}
              className="bg-background border-border" maxLength={100} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="fn-email" className="text-sm">Email *</Label>
          <Input id="fn-email" type="email" placeholder="jan@firma.sk" value={state.email}
            onChange={e => update({ email: e.target.value })}
            className="bg-background border-border" maxLength={255} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fn-phone" className="text-sm">Telefón</Label>
          <Input id="fn-phone" type="tel" placeholder="+421 9XX XXX XXX" value={state.phone}
            onChange={e => update({ phone: e.target.value })}
            className="bg-background border-border" maxLength={20} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fn-msg" className="text-sm">Správa (voliteľné)</Label>
          <Textarea id="fn-msg" placeholder="Doplňujúce informácie..."
            value={state.message} onChange={e => update({ message: e.target.value })}
            className="bg-background border-border min-h-[60px] text-sm" maxLength={1000} />
        </div>
      </div>
    );
  }
}
