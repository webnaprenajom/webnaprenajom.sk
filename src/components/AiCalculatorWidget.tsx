import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, ShoppingCart, CalendarCheck, Users, MapPin, FileText,
  CreditCard, MessageSquare, Mail, Search, BarChart3, Image as ImageIcon,
  Lock, Star, Headphones, BellRing, Palette, Layers,
  ArrowRight, ArrowLeft, Sparkles, Loader2, CheckCircle2, Building2, User, Heart,
  Brain, Bot, Database, Smartphone, AppWindow, Send,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type WebsiteType = { id: string; icon: any; title: string; desc: string };
type Feature = { id: string; icon: any; title: string; desc: string };
type Audience = { id: string; icon: any; label: string };
type Model = "rental" | "wordpress" | "shoptet";

const websiteTypes: WebsiteType[] = [
  { id: "company", icon: Globe, title: "Firemný web", desc: "Prezentácia firmy" },
  { id: "eshop", icon: ShoppingCart, title: "E-shop", desc: "Online predaj" },
  { id: "booking", icon: CalendarCheck, title: "Rezervácie", desc: "Online termíny" },
  { id: "crm", icon: Database, title: "Vlastné CRM", desc: "Riešenie na mieru" },
  { id: "webapp", icon: AppWindow, title: "Web aplikácia", desc: "SaaS, nástroje" },
  { id: "mobile", icon: Smartphone, title: "Mobilná aplikácia", desc: "iOS & Android" },
];

const companySubtypes: Audience[] = [
  { id: "company-presentation", icon: Globe, label: "Prezentácia firmy" },
  { id: "company-portfolio", icon: Users, label: "Portfólio" },
  { id: "company-local", icon: MapPin, label: "Lokálny biznis (reštaurácia, fitko...)" },
  { id: "company-landing", icon: FileText, label: "Landing page (predajná stránka)" },
];

const features: Feature[] = [
  { id: "payments", icon: CreditCard, title: "Online platby", desc: "Stripe, PayPal" },
  { id: "chatbot", icon: MessageSquare, title: "AI chatbot", desc: "24/7 komunikácia" },
  { id: "emails", icon: Mail, title: "E-mail notifikácie", desc: "Automatické maily" },
  { id: "seo", icon: Search, title: "SEO optimalizácia", desc: "Lepšie pozície" },
  { id: "analytics", icon: BarChart3, title: "Analytika", desc: "Štatistiky" },
  { id: "gallery", icon: ImageIcon, title: "Galérie & médiá", desc: "Foto, video" },
  { id: "security", icon: Lock, title: "GDPR & SSL", desc: "Zabezpečenie" },
  { id: "reviews", icon: Star, title: "Recenzie", desc: "Hodnotenia" },
  { id: "forms", icon: Headphones, title: "Formuláre", desc: "Inteligentné" },
  { id: "push", icon: BellRing, title: "Push notifikácie", desc: "Upozornenia" },
  { id: "design", icon: Palette, title: "Vlastný dizajn", desc: "Unikátny vizuál" },
  { id: "multilang", icon: Layers, title: "Multi-jazyčnosť", desc: "SK, EN, DE..." },
  { id: "booking", icon: CalendarCheck, title: "Rezervácie", desc: "Termíny online" },
  { id: "ecommerce", icon: ShoppingCart, title: "E-commerce", desc: "Košík, sklad" },
  { id: "crm", icon: Brain, title: "CRM systém", desc: "Správa zákazníkov" },
  { id: "memberArea", icon: Lock, title: "Členská sekcia", desc: "Login pre klientov" },
];

const audiences: Audience[] = [
  { id: "smb", icon: Building2, label: "Malá / stredná firma" },
  { id: "freelancer", icon: User, label: "Živnostník / freelancer" },
  { id: "service", icon: Heart, label: "Služby (salón, wellness...)" },
  { id: "restaurant", icon: MapPin, label: "Reštaurácia / hotel" },
  { id: "services-sale", icon: ShoppingCart, label: "Predaj služieb" },
];

type Offer = {
  recommendedPackage: "landing" | "presentation" | "webapp";
  monthly: number;
  oneOffPrice: number | null;
  oneOffPlatform: string | null;
  indicativeTotal?: number;
  model: Model;
  headline: string;
  summary: string;
  benefits: string[];
  cta: string;
};

const AiCalculatorWidget = ({
  compact = false,
  open: openProp,
  onOpenChange,
  variant = "auto",
}: {
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** "mobile" = horizontal carousel only, "desktop" = 3x3 grid only, "auto" = responsive both, "none" = trigger UI hidden (only the dialog), "inline" = render wizard form inline (no trigger, no dialog) */
  variant?: "mobile" | "desktop" | "auto" | "none" | "inline";
}) => {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp !== undefined ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    setOpenInternal(v);
  };
  const [step, setStep] = useState(0);
  const [websiteType, setWebsiteType] = useState<string>("");
  const [showCompanySub, setShowCompanySub] = useState(false);
  const [audience, setAudience] = useState<string>("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [model, setModel] = useState<Model>("rental");
  const [eshopType, setEshopType] = useState<"" | "digital" | "supplier">("");
  const [loading, setLoading] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Contact step
  const [contact, setContact] = useState({ name: "", email: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % websiteTypes.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll carousel to active item (both mobile and desktop now)
  useEffect(() => {
    const container = mobileScrollRef.current;
    if (!container) return;
    const child = container.children[0]?.children[activeIdx] as HTMLElement | undefined;
    if (child) {
      const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [activeIdx]);

  const reset = () => {
    setStep(0); setWebsiteType(""); setAudience("");
    setSelectedFeatures([]); setModel("rental"); setEshopType(""); setOffer(null); setLoading(false);
    setContact({ name: "", email: "", phone: "", note: "" });
    setSubmitting(false);
    setShowCompanySub(false);
  };

  const openWith = (preselectedType?: string) => {
    reset();
    if (preselectedType) setWebsiteType(preselectedType);
    setOpen(true);
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  const calculatePrice = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-price-calculator", {
        body: { websiteType, features: selectedFeatures, businessType: audience, model, eshopType: model === "shoptet" ? eshopType : undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOffer(data as Offer);
      setStep(4);
    } catch (e: any) {
      toast.error("AI kalkulácia zlyhala", { description: e.message || "Skús znova." });
    } finally {
      setLoading(false);
    }
  };

  const submitLead = async () => {
    if (!contact.name.trim() || !contact.email.trim()) {
      toast.error("Vyplň meno a email");
      return;
    }
    setSubmitting(true);
    try {
      const wt = websiteTypes.find(w => w.id === websiteType)?.title || websiteType;
      const aud = [...audiences, ...companySubtypes].find(a => a.id === audience)?.label || audience;
      const featLabels = selectedFeatures
        .map(id => features.find(f => f.id === id)?.title || id)
        .join(", ");
      const modelLabel = model === "rental"
        ? `Mesačný paušál ${offer?.monthly ?? ""}€/mes`
        : model === "wordpress"
        ? `WordPress jednorazovo ~${offer?.oneOffPrice ?? 350}€`
        : `Shoptet jednorazovo ~${offer?.oneOffPrice ?? 950}€`;

      const details = [
        `Typ webu: ${wt}`,
        `Biznis: ${aud}`,
        `Funkcie: ${featLabels || "—"}`,
        `Model: ${modelLabel}`,
        offer?.headline && `Ponuka: ${offer.headline}`,
        contact.note && `Poznámka: ${contact.note}`,
      ].filter(Boolean).join("\n");

      const { error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          message: details,
          type: "ai",
          source: "ai-kalkulacka",
          language: "sk",
        },
      });
      if (error) throw error;
      setStep(6);
    } catch (e: any) {
      toast.error("Odoslanie zlyhalo", { description: e.message || "Skús znova." });
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!websiteType;
    if (step === 1) return !!audience;
    if (step === 2) return selectedFeatures.length > 0;
    if (step === 3 && model === "shoptet") return !!eshopType;
    return true;
  };

  // Wizard content (shared between dialog and inline)
  const isInline = variant === "inline";
  const wizardContent = (
    <>
      {!isInline && (
        <>
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Bot className="w-5 h-5 text-primary" />
              AI kalkulačka tvojho webu
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {step < 4
                ? `Krok ${step + 1} zo 4 — AI ti pomôže navrhnúť optimálne riešenie`
                : step === 4
                ? "Tvoja personalizovaná ponuka"
                : step === 5
                ? "Posledný krok — kontaktné údaje"
                : "Hotovo!"}
            </p>
          </div>

          {step < 4 && (
            <div className="flex gap-1.5 mb-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          )}
        </>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h4 className="font-semibold mb-3">Aký typ webu potrebuješ?</h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {websiteTypes.map((t) => (
                <button key={t.id} onClick={() => { setWebsiteType(t.id); setTimeout(() => setStep(1), 180); }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${websiteType === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <t.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h4 className="font-semibold mb-3">
              {websiteType === "company" ? "Aký typ firemného webu potrebuješ?" : "Pre koho je tvoj biznis?"}
            </h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {(websiteType === "company" ? companySubtypes : audiences).map((a) => (
                <button key={a.id} onClick={() => { setAudience(a.id); setTimeout(() => setStep(2), 180); }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${audience === a.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <a.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{a.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h4 className="font-semibold mb-1">Ktoré funkcie chceš mať?</h4>
            <p className="text-xs text-muted-foreground mb-3">Vyber jednu alebo viac.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
              {features.map((f) => (
                <button key={f.id} onClick={() => toggleFeature(f.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${selectedFeatures.includes(f.id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <f.icon className="w-4 h-4 text-primary mb-1" />
                  <div className="text-xs font-semibold leading-tight">{f.title}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <h4 className="font-semibold mb-3">Ako chceš platiť?</h4>
            <div className="space-y-2">
              {[
                { id: "rental" as Model, title: "Mesačný paušál (odporúčame)", desc: "Od 35€/mes • Bez vstupných nákladov • Vrátane úprav, hostingu, AI obsahu", badge: "Najobľúbenejšie" },
                { id: "wordpress" as Model, title: "Web na mieru", desc: "WordPress alebo AI riešenie podľa zadania • Od 350€ jednorazovo", badge: null },
                { id: "shoptet" as Model, title: "Eshopové riešenie", desc: "Eshop pre digitálny produkt alebo komplexné riešenie s napojením dodávateľov", badge: null },
              ].map((m) => (
                <button key={m.id} onClick={() => { setModel(m.id); if (m.id !== "shoptet") setEshopType(""); }}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${model === m.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-sm">{m.title}</div>
                    {m.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">{m.badge}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </button>
              ))}
            </div>

            {model === "shoptet" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-3 border-t mt-3 space-y-2">
                <h4 className="font-semibold text-sm">Aký typ eshopu?</h4>
                {[
                  { id: "digital" as const, title: "Eshop pre digitálny produkt", desc: "E-booky, kurzy, šablóny, software • Od 350€" },
                  { id: "supplier" as const, title: "Eshop s napojením dodávateľov (Shoptet)", desc: "Sklad, faktúry, doprava, platby • Od 950€" },
                ].map((e) => (
                  <button key={e.id} onClick={() => setEshopType(e.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${eshopType === e.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                    <div className="font-semibold text-sm">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.desc}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 4 && offer && (
          <motion.div key="s4-inline" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">AI odporúčanie</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{offer.headline}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">{offer.summary}</p>
              <div className="rounded-xl bg-background/60 p-3 mb-3">
                {offer.model === "rental" ? (
                  <div className="space-y-1">
                    {offer.indicativeTotal && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Orientačná celková cena:</span>
                        <span className="line-through opacity-60 font-semibold">~ {offer.indicativeTotal}€</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-primary">{offer.monthly}€</span>
                      <span className="text-sm text-muted-foreground">/ mesiac · bez vstupných nákladov</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">~ {offer.oneOffPrice}€</span>
                    <span className="text-sm text-muted-foreground">jednorazovo ({offer.oneOffPlatform})</span>
                  </div>
                )}
              </div>
              <ul className="space-y-1.5">
                {offer.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="gradient" size="lg" className="flex-1" onClick={() => setStep(5)}>
                Chcem túto ponuku <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={reset}>Znova</Button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="s5-inline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <p className="text-sm text-muted-foreground">Vyplň kontaktné údaje a my sa ti ozveme s finálnou ponukou.</p>
            <div className="space-y-2">
              <Label htmlFor="calc-name-i">Meno a priezvisko *</Label>
              <Input id="calc-name-i" placeholder="Ján Novák" value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })} maxLength={100} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="calc-email-i">Email *</Label>
                <Input id="calc-email-i" type="email" placeholder="jan@firma.sk" value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })} maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calc-phone-i">Telefón</Label>
                <Input id="calc-phone-i" type="tel" placeholder="+421 9XX XXX XXX" value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })} maxLength={20} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-note-i">Poznámka</Label>
              <Textarea id="calc-note-i" placeholder="Doplňujúce informácie..." value={contact.note}
                onChange={(e) => setContact({ ...contact, note: e.target.value })} maxLength={1000} className="min-h-[80px]" />
            </div>
          </motion.div>
        )}

        {step === 6 && (
          <motion.div key="s6-inline" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-6 space-y-3">
            <CheckCircle2 className="w-14 h-14 text-primary" />
            <h3 className="text-lg font-bold">Dopyt úspešne odoslaný!</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Ozveme sa ti do 24 hodín na <strong className="text-foreground">{contact.email}</strong>.
            </p>
            <Button variant="gradient" onClick={() => reset()}>Nová kalkulácia</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {step < 4 && (
        <div className="flex justify-between gap-2 pt-4 border-t mt-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Späť
          </Button>
          {step < 3 ? (
            <Button variant="gradient" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Ďalej <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          ) : (
            <Button variant="gradient" onClick={calculatePrice} disabled={loading}>
              {loading ? (<><Loader2 className="mr-2 w-4 h-4 animate-spin" /> AI počíta...</>) : (<><Sparkles className="mr-2 w-4 h-4" /> Vypočítať cenu</>)}
            </Button>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="flex justify-between gap-2 pt-4 border-t mt-3">
          <Button variant="ghost" onClick={() => setStep(4)}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Späť
          </Button>
          <Button variant="gradient" onClick={submitLead} disabled={submitting}>
            {submitting ? (<><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Odosielam...</>) : (<><Send className="mr-2 w-4 h-4" /> Odoslať dopyt</>)}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      {variant === "inline" && (
        <div className="relative">
          {/* gradient halo */}
          <div className="pointer-events-none absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 opacity-40 blur-2xl -z-10" />

          <div className="light relative rounded-[1.75rem] bg-white text-slate-900 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 overflow-hidden" style={{ colorScheme: "light" }}>
            {/* HOOK HEADER */}
            <div className="relative px-5 sm:px-6 pt-5 pb-4 bg-gradient-to-br from-primary/10 via-white to-accent/10 border-b border-slate-200">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-primary text-primary-foreground shadow-md shadow-primary/30">
                  <Sparkles className="w-3 h-3" /> Zdarma · 30 sekúnd
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  237 ľudí dnes vyplnilo
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold leading-tight text-slate-900">
                Zisti <span className="text-primary">cenu webu</span> presne pre tvoj biznis
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-600 mt-1">
                Odpovedz na pár otázok a AI ti zadarmo pripraví riešenie do 24 h.
              </p>

              {/* progress bar with % */}
              {step < 4 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      initial={false}
                      animate={{ width: `${((step + 1) / 4) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-primary tabular-nums">
                    {Math.round(((step + 1) / 4) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* WIZARD BODY (light theme override) */}
            <div className="px-5 sm:px-6 py-5 [&_h4]:text-slate-900 [&_label]:text-slate-700 [&_input]:bg-white [&_input]:border-slate-200 [&_input]:text-slate-900 [&_textarea]:bg-white [&_textarea]:border-slate-200 [&_textarea]:text-slate-900 [&_.border-border]:!border-slate-200 [&_.border-t]:!border-slate-200 [&_.text-muted-foreground]:!text-slate-500 [&_.bg-muted]:!bg-slate-200">
              {wizardContent}
            </div>

            {/* TRUST FOOTER */}
            <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Bez záväzku</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 0€ vstup</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Odpoveď do 24 h</span>
            </div>
          </div>
        </div>
      )}

      {variant !== "none" && variant !== "inline" && (
        <div className={compact ? "" : ""}>
          <div className="relative rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-primary/10 via-background/40 to-accent/10 border border-primary/30 shadow-2xl shadow-primary/20 backdrop-blur-sm">
            <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 opacity-30 blur-xl -z-10" />

            {(variant === "mobile" || variant === "auto") && (
              <div
                ref={mobileScrollRef}
                className={`${variant === "auto" ? "sm:hidden" : ""} overflow-x-auto overflow-y-hidden snap-x snap-mandatory rounded-2xl`}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <div className="flex gap-3 py-2 px-1">
                  {websiteTypes.map((item, i) => {
                    const isActive = activeIdx === i;
                    return (
                      <button
                        key={item.id}
                        onClick={() => openWith(item.id)}
                        className={`snap-center shrink-0 w-[130px] rounded-2xl p-3 flex flex-col items-center justify-center text-center transition-all duration-700 ease-out min-h-[150px] border ${
                          isActive
                            ? "scale-[1.04] border-primary/60 bg-primary/10 shadow-lg shadow-primary/30"
                            : "border-transparent bg-background/30"
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 bg-primary shadow-md shadow-primary/30 transition-transform duration-700 ease-out ${isActive ? "scale-110" : ""}`}>
                          <item.icon className="w-7 h-7 text-primary-foreground" />
                        </div>
                        <div className="text-sm font-bold leading-tight">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-1">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(variant === "desktop" || variant === "auto") && (
              <div className={`${variant === "auto" ? "hidden sm:grid" : "grid"} grid-cols-3 grid-rows-3 gap-3 sm:gap-4`}>
                {websiteTypes.map((item, i) => {
                  const isActive = activeIdx === i;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => openWith(item.id)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.05 }}
                      className={`group relative rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-all duration-700 ease-out min-h-[120px] sm:min-h-[140px] border ${
                        isActive
                          ? "scale-[1.04] border-primary/60 bg-primary/10 shadow-lg shadow-primary/30"
                          : "border-transparent hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-all duration-700 ease-out shadow-lg shadow-primary/30 ${
                          isActive ? "bg-primary scale-110" : "bg-primary group-hover:scale-110"
                        }`}
                      >
                        <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                      </div>
                      <div className="text-xs sm:text-sm font-bold leading-tight">{item.title}</div>
                      <div className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight mt-0.5">{item.desc}</div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bot className="w-5 h-5 text-primary" />
              AI kalkulačka tvojho webu
            </DialogTitle>
            <DialogDescription>
              {step < 4
                ? `Krok ${step + 1} zo 4 — AI ti pomôže navrhnúť optimálne riešenie`
                : step === 4
                ? "Tvoja personalizovaná ponuka"
                : step === 5
                ? "Posledný krok — kontaktné údaje"
                : "Hotovo!"}
            </DialogDescription>
          </DialogHeader>

          {step < 4 && (
            <div className="flex gap-1.5 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <h4 className="font-semibold mb-3">Aký typ webu potrebuješ?</h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {websiteTypes.map((t) => (
                    <button key={t.id} onClick={() => setWebsiteType(t.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${websiteType === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                      <t.icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <h4 className="font-semibold mb-3">Pre koho je tvoj biznis?</h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {audiences.map((a) => (
                    <button key={a.id} onClick={() => setAudience(a.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${audience === a.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                      <a.icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">{a.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <h4 className="font-semibold mb-1">Ktoré funkcie chceš mať?</h4>
                <p className="text-xs text-muted-foreground mb-3">Vyber jednu alebo viac.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {features.map((f) => (
                    <button key={f.id} onClick={() => toggleFeature(f.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${selectedFeatures.includes(f.id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                      <f.icon className="w-4 h-4 text-primary mb-1" />
                      <div className="text-xs font-semibold leading-tight">{f.title}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <h4 className="font-semibold mb-3">Ako chceš platiť?</h4>
                <div className="space-y-2">
                  {[
                    { id: "rental" as Model, title: "Mesačný paušál (odporúčame)", desc: "Od 35€/mes • Bez vstupných nákladov • Vrátane úprav, hostingu, AI obsahu", badge: "Najobľúbenejšie" },
                    { id: "wordpress" as Model, title: "Web na mieru", desc: "WordPress alebo AI riešenie podľa zadania • Od 350€ jednorazovo", badge: null },
                    { id: "shoptet" as Model, title: "Eshopové riešenie", desc: "Eshop pre digitálny produkt alebo komplexné riešenie s napojením dodávateľov", badge: null },
                  ].map((m) => (
                    <button key={m.id} onClick={() => { setModel(m.id); if (m.id !== "shoptet") setEshopType(""); }}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${model === m.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm">{m.title}</div>
                        {m.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">{m.badge}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>

                {model === "shoptet" && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-3 border-t mt-3 space-y-2">
                    <h4 className="font-semibold text-sm">Aký typ eshopu?</h4>
                    {[
                      { id: "digital" as const, title: "Eshop pre digitálny produkt", desc: "E-booky, kurzy, šablóny, software • Od 350€" },
                      { id: "supplier" as const, title: "Eshop s napojením dodávateľov (Shoptet)", desc: "Sklad, faktúry, doprava, platby • Od 950€" },
                    ].map((e) => (
                      <button key={e.id} onClick={() => setEshopType(e.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${eshopType === e.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                        <div className="font-semibold text-sm">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{e.desc}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 4 && offer && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">AI odporúčanie</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{offer.headline}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">{offer.summary}</p>
                  <div className="rounded-xl bg-background/60 p-4 mb-4">
                    {offer.model === "rental" ? (
                      <>
                        {offer.indicativeTotal && (
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <span className="text-muted-foreground">Orientačná celková cena:</span>
                            <span className="line-through opacity-60 font-semibold">~ {offer.indicativeTotal}€</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mb-1">Odporúčaný paušál (relevantná cena pre tvoj výber)</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-primary">{offer.monthly}€</span>
                          <span className="text-sm text-muted-foreground">/ mesiac · bez vstupných nákladov</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Balík: {offer.recommendedPackage === "landing" ? "Landing page" : offer.recommendedPackage === "presentation" ? "Prezentačný web" : "Web aplikácia (CRM, AI funkcie...)"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground mb-1">Jednorazová cena ({offer.oneOffPlatform})</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-primary">~ {offer.oneOffPrice}€</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Orientačná cena, finálnu doladíme po krátkom hovore.</div>
                      </>
                    )}
                  </div>
                  <ul className="space-y-2 mb-4">
                    {offer.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-medium text-foreground">{offer.cta}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="gradient" size="lg" className="flex-1" onClick={() => setStep(5)}>
                    Chcem túto ponuku <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="lg" onClick={reset}>Vyskúšať znova</Button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vyplň kontaktné údaje a my sa ti ozveme s finálnou ponukou.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="calc-name">Meno a priezvisko *</Label>
                  <Input id="calc-name" placeholder="Ján Novák" value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })} maxLength={100} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="calc-email">Email *</Label>
                    <Input id="calc-email" type="email" placeholder="jan@firma.sk" value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })} maxLength={255} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calc-phone">Telefón</Label>
                    <Input id="calc-phone" type="tel" placeholder="+421 9XX XXX XXX" value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })} maxLength={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calc-note">Poznámka</Label>
                  <Textarea id="calc-note" placeholder="Doplňujúce informácie k tvojmu projektu..." value={contact.note}
                    onChange={(e) => setContact({ ...contact, note: e.target.value })} maxLength={1000} className="min-h-[90px]" />
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-8 space-y-4">
                <CheckCircle2 className="w-16 h-16 text-primary" />
                <h3 className="text-xl font-bold">Dopyt úspešne odoslaný!</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Ozveme sa ti najneskôr do 24 hodín na <strong className="text-foreground">{contact.email}</strong> s finálnou ponukou.
                </p>
                <Button variant="gradient" onClick={() => { setOpen(false); reset(); }}>Zavrieť</Button>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 4 && (
            <div className="flex justify-between gap-2 pt-4 border-t mt-2">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Späť
              </Button>
              {step < 3 ? (
                <Button variant="gradient" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                  Ďalej <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <Button variant="gradient" onClick={calculatePrice} disabled={loading}>
                  {loading ? (<><Loader2 className="mr-2 w-4 h-4 animate-spin" /> AI počíta...</>) : (<><Sparkles className="mr-2 w-4 h-4" /> Vypočítať cenu</>)}
                </Button>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="flex justify-between gap-2 pt-4 border-t mt-2">
              <Button variant="ghost" onClick={() => setStep(4)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Späť
              </Button>
              <Button variant="gradient" onClick={submitLead} disabled={submitting}>
                {submitting ? (<><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Odosielam...</>) : (<><Send className="mr-2 w-4 h-4" /> Odoslať dopyt</>)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AiCalculatorWidget;
