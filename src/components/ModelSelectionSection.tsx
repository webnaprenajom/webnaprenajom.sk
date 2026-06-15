import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, CheckCircle2, ArrowRight, ArrowLeft, Send, Calendar as CalendarIcon,
  Rocket, Building2, Database,
  Globe, ShoppingCart, Bot, BarChart3, Mail,
  CalendarClock, CreditCard, Languages, Search, MessageSquare,
  FileText, Workflow, Smartphone, Image as ImageIcon, Bell,
  Database as DbIcon, Download,
} from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import packageStartImg from "@/assets/package-start.png";
import packageBiznisImg from "@/assets/package-biznis.png";
import packageProcrmImg from "@/assets/package-procrm.png";

const OFFER_PDF_URL = "/__l5e/assets-v1/76c1f796-a0f1-458d-9a72-17b349ef38e5/Web-na-prenajom-ponuka.pdf";

// ── Packages ──
const packages = [
  {
    id: "start",
    badge: "Balík 1",
    icon: Rocket,
    image: packageStartImg,
    title: "Štart",
    subtitle: "Landing • Formuláre • Kalkulačky",
    price: 35,
    oneOffPrice: 690,
    desc: "Ideálne pre individuálnych podnikateľov, freelancerov a kampane. Konvertujúca jednostránka s formulármi, kalkulačkami a integráciou CRM nástrojov.",
    features: [
      "Prémiový landing page",
      "Mobile-first, PageSpeed 95+",
      "Hosting, doména, SSL",
      "Až 3 formuláre / kalkulačky",
      "SEO + Google Analytics",
      "Mesačné úpravy obsahu",
    ],
    recommended: false,
  },
  {
    id: "biznis",
    badge: "Balík 2",
    icon: Building2,
    image: packageBiznisImg,
    title: "Biznis",
    subtitle: "Firemný web • Multi-page • Blog",
    price: 49,
    oneOffPrice: 1490,
    desc: "Plnohodnotná firemná prezentácia s viacerými stránkami, sekciami pre služby, referencie, blog a kontaktný systém. Reprezentatívny dizajn na mieru.",
    features: [
      "Až 8 podstránok",
      "Blog s admin editorom",
      "Google Maps, newsletter",
      "Dizajn na mieru značke",
      "Pokročilé SEO + Schema.org",
      "Prioritná podpora",
    ],
    recommended: true,
  },
  {
    id: "pro",
    badge: "Balík 3",
    icon: Database,
    image: packageProcrmImg,
    title: "Pro CRM",
    subtitle: "Vlastný admin • CRM • Inzeráty",
    price: 69,
    oneOffPrice: 3990,
    desc: "Kompletné riešenie s vlastným administračným rozhraním a CRM systémom. Spravujte inzeráty, klientov, ponuky a štatistiky z jedného miesta.",
    features: [
      "Všetko z balíka Biznis",
      "CRM: klienti, deals, úlohy",
      "Reporty + exporty (PDF/CSV)",
      "Vlastný admin (role, login)",
      "Správa inzerátov / katalógov",
      "API: e-mail, SMS, platby",
    ],
    recommended: false,
  },
] as const;

type BillingMode = "rental" | "annual" | "oneoff";

const ANNUAL_DISCOUNT = 0.1;

// ── Capabilities carousel ──
const capabilities = [
  { icon: Globe, title: "Webstránky na mieru", desc: "Landing page, firemné weby, portfóliá – moderné a rýchle." },
  { icon: ShoppingCart, title: "Eshopy a digitálne produkty", desc: "Predaj fyzických aj digitálnych produktov s platobnou bránou." },
  { icon: Bot, title: "AI chatboti a asistenti", desc: "24/7 podpora, kvalifikácia leadov, odpovede na otázky klientov." },
  { icon: DbIcon, title: "CRM systémy", desc: "Vlastný CRM na klientov, dopyty, projekty a poznámky." },
  { icon: BarChart3, title: "Dashboardy a reporty", desc: "Prehľadné štatistiky, grafy a real-time dáta." },
  { icon: Mail, title: "Email automatizácia", desc: "Automatické notifikácie, newslettre a follow-up sekvencie." },
  { icon: CalendarClock, title: "Rezervačné systémy", desc: "Online booking, kalendáre a potvrdenia termínov." },
  { icon: CreditCard, title: "Platobné brány", desc: "Stripe, Paddle, predplatné a jednorazové platby." },
  { icon: Languages, title: "Viacjazyčné weby", desc: "SK, EN, DE a ďalšie jazyky." },
  { icon: Search, title: "SEO optimalizácia", desc: "Rýchle načítanie, štruktúrované dáta, meta tagy." },
  { icon: MessageSquare, title: "Inteligentné formuláre", desc: "Smart formuláre s validáciou a zápisom do CRM." },
  { icon: FileText, title: "Blogy a CMS", desc: "Správa obsahu bez programovania pre redaktorov." },
  { icon: Workflow, title: "Automatizácia procesov", desc: "Napojenie na Zapier, Make, Google Sheets a externé API." },
  { icon: Smartphone, title: "Mobile-first dizajn", desc: "Plne responzívne na všetkých zariadeniach." },
  { icon: ImageIcon, title: "AI generovanie obsahu", desc: "Texty a obrázky vytvorené umelou inteligenciou." },
  { icon: Bell, title: "Real-time notifikácie", desc: "Okamžité upozornenia na nové dopyty a aktivitu." },
];

// ── Calendar helpers ──
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

type SelectedPkg = typeof packages[number];

// ── Propose Solution dialog (multi-step) ──
const DESIGN_OPTIONS = [
  { id: "minimal", label: "Minimalistický", desc: "Čistý, vzdušný, prémiový" },
  { id: "bold", label: "Odvážny / moderný", desc: "Výrazné farby, gradienty" },
  { id: "corporate", label: "Korporátny", desc: "Dôveryhodný, konzervatívny" },
  { id: "playful", label: "Hravý / kreatívny", desc: "Ilustrácie, animácie" },
  { id: "dark", label: "Tmavý / tech", desc: "Dark mode, futuristický" },
  { id: "unsure", label: "Neviem, poraďte mi", desc: "Navrhnete na mieru" },
];
const GOAL_OPTIONS = [
  { id: "leads", label: "Získavať dopyty / leady" },
  { id: "sell", label: "Predávať produkty / služby" },
  { id: "present", label: "Prezentovať firmu / portfólio" },
  { id: "booking", label: "Online rezervácie / kalendár" },
  { id: "crm", label: "CRM / správa klientov" },
  { id: "blog", label: "Blog / obsahový web" },
  { id: "ai", label: "AI chatbot / asistent" },
  { id: "payments", label: "Platby / predplatné" },
];
const DEADLINE_OPTIONS = [
  { id: "asap", label: "Čo najskôr", desc: "Do 7 dní" },
  { id: "2w", label: "Do 2 týždňov" },
  { id: "1m", label: "Do 1 mesiaca" },
  { id: "flex", label: "Mám čas / flexibilne" },
];

const ProposeSolutionDialog = ({ pkg, mode, open, onOpenChange }: { pkg: SelectedPkg | null; mode: BillingMode; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [step, setStep] = useState(1);
  const TOTAL = 5;
  const [design, setDesign] = useState<string>("");
  const [goals, setGoals] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string>("");
  const [extra, setExtra] = useState({ demo: false, consultation: false });
  const [data, setData] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setStep(1); setDesign(""); setGoals([]); setDeadline("");
    setExtra({ demo: false, consultation: false });
    setData({ name: "", email: "", phone: "", message: "" });
    setSubmitted(false);
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  const toggleGoal = (id: string) =>
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const next = () => {
    if (step === 1 && !design) { toast({ title: "Vyberte preferovaný dizajn", variant: "destructive" }); return; }
    if (step === 2 && goals.length === 0) { toast({ title: "Vyberte aspoň jeden cieľ", variant: "destructive" }); return; }
    if (step === 3 && !deadline) { toast({ title: "Vyberte termín dodania", variant: "destructive" }); return; }
    setStep((s) => Math.min(TOTAL, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;
    if (!data.name.trim() || !data.email.trim()) {
      toast({ title: "Vyplňte meno a email", variant: "destructive" });
      return;
    }
    const designLabel = DESIGN_OPTIONS.find((d) => d.id === design)?.label ?? "—";
    const goalLabels = GOAL_OPTIONS.filter((g) => goals.includes(g.id)).map((g) => g.label).join(", ") || "—";
    const deadlineLabel = DEADLINE_OPTIONS.find((d) => d.id === deadline)?.label ?? "—";
    const extras: string[] = [];
    if (extra.demo) extras.push("ukážka");
    if (extra.consultation) extras.push("konzultácia");

    const priceLine = mode === "rental"
      ? `${pkg.price} € / mes`
      : `${pkg.oneOffPrice} € jednorazovo`;
    const message =
`Návrh riešenia pre balík: ${pkg.title} (${priceLine})
Model: ${mode === "rental" ? "Mesačný prenájom" : "Jednorazové riešenie (kúpa)"}

🎨 Dizajn: ${designLabel}
🎯 Ciele a funkcie: ${goalLabels}
⏱ Termín dodania: ${deadlineLabel}
✨ Záujem o: ${extras.length ? extras.join(", ") : "—"}

📝 Doplňujúce info:
${data.message || "—"}`;

    try {
      await supabase.functions.invoke("send-lead-email", {
        body: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          message,
          type: "ai",
          language: "sk",
          source: `package-proposal-${pkg.id}`,
        },
      });
    } catch (err) {
      console.error(err);
    }
    setSubmitted(true);
  };

  if (!pkg) return null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            <span className="text-gradient">
              {submitted ? "Ďakujeme!" : `Navrhnúť riešenie — ${pkg.title}`}
            </span>
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Vaše zadanie sme prijali. Pripravíme návrh na mieru a ozveme sa do 24 hodín.
            </p>
            <Button variant="gradient" onClick={() => close(false)}>Zavrieť</Button>
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* Package summary */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold">{pkg.badge}</p>
                <p className="font-bold">{pkg.title}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gradient">{mode === "rental" ? pkg.price : pkg.oneOffPrice} €</p>
                <p className="text-[10px] text-muted-foreground">{mode === "rental" ? "/ mes" : "jednorazovo"}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all ${i < step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-2">{step}/{TOTAL}</span>
            </div>

            {/* Step 1 — Design */}
            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Aký dizajn / farebnosť preferujete?</p>
                  <p className="text-xs text-muted-foreground">Pomôže nám to pripraviť relevantný návrh.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DESIGN_OPTIONS.map((o) => {
                    const sel = design === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setDesign(o.id)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <p className="text-sm font-semibold">{o.label}</p>
                        <p className="text-[11px] text-muted-foreground">{o.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2 — Goals */}
            {step === 2 && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Aký je cieľ webu a aké funkcie potrebujete?</p>
                  <p className="text-xs text-muted-foreground">Môžete vybrať viac možností.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_OPTIONS.map((o) => {
                    const sel = goals.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleGoal(o.id)}
                        className={`text-left rounded-xl border p-3 text-sm transition-all flex items-center gap-2 ${
                          sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? "bg-primary border-primary" : "border-border"}`}>
                          {sel && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </span>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3 — Deadline */}
            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Kedy potrebujete web spustiť?</p>
                  <p className="text-xs text-muted-foreground">Pomáha nám naplánovať kapacitu tímu.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEADLINE_OPTIONS.map((o) => {
                    const sel = deadline === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setDeadline(o.id)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <p className="text-sm font-semibold">{o.label}</p>
                        {o.desc && <p className="text-[11px] text-muted-foreground">{o.desc}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4 — Extras */}
            {step === 4 && (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Chcete navyše?</p>
                  <p className="text-xs text-muted-foreground">Nezáväzne, môžete preskočiť.</p>
                </div>
                <div className="space-y-2">
                  {[
                    { key: "demo" as const, label: "Chcem ukážku podobného webu", desc: "Pošleme reálne realizácie z vášho segmentu" },
                    { key: "consultation" as const, label: "Chcem bezplatnú konzultáciu", desc: "15-min hovor, odpovieme na otázky" },
                  ].map((o) => {
                    const sel = extra[o.key];
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setExtra((e) => ({ ...e, [o.key]: !e[o.key] }))}
                        className={`w-full text-left rounded-xl border p-3 transition-all flex items-start gap-3 ${
                          sel ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${sel ? "bg-primary border-primary" : "border-border"}`}>
                          {sel && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{o.label}</p>
                          <p className="text-[11px] text-muted-foreground">{o.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5 — Contact */}
            {step === 5 && (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <p className="font-semibold mb-1">Posledný krok — kontakt</p>
                  <p className="text-xs text-muted-foreground">Pripravíme návrh a ozveme sa do 24 hodín.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-name">Meno a priezvisko *</Label>
                  <Input id="p-name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="p-email">E-mail *</Label>
                    <Input id="p-email" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-phone">Telefón</Label>
                    <Input id="p-phone" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-msg">Niečo doplniť? (nepovinné)</Label>
                  <Textarea id="p-msg" value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })} placeholder="Konkurencia, inšpirácia, špeciálne požiadavky..." className="min-h-[70px]" maxLength={1000} />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={back} className="px-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button type="submit" variant="gradient" size="lg" className="flex-1">
                    Odoslať zadanie <Send className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            )}

            {/* Navigation (steps 1-4) */}
            {step < 5 && (
              <div className="flex gap-3 pt-1">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={back} className="px-4">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                <Button type="button" variant="gradient" size="lg" onClick={next} className="flex-1">
                  Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Consultation dialog ──
const ConsultationDialog = ({ pkg, open, onOpenChange }: { pkg: SelectedPkg | null; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("");
  const [data, setData] = useState({ name: "", email: "", phone: "" });
  const [step, setStep] = useState<"slot" | "contact" | "done">("slot");

  const days = getAvailableSlots();

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setStep("slot");
      setDate(null);
      setTime("");
      setData({ name: "", email: "", phone: "" });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.email.trim()) {
      toast({ title: "Vyplňte meno a email", variant: "destructive" });
      return;
    }
    try {
      await supabase.functions.invoke("send-lead-email", {
        body: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          message: `Konzultácia k balíku: ${pkg?.title ?? "—"}`,
          type: "consultation",
          language: "sk",
          source: `package-consultation-${pkg?.id ?? "any"}`,
          date: date?.toISOString(),
          time,
        },
      });
    } catch (err) {
      console.error(err);
    }
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            <span className="text-gradient">
              {step === "done" ? "Termín potvrdený!" : "Konzultácia zdarma"}
            </span>
          </DialogTitle>
          {pkg && step !== "done" && (
            <p className="text-sm text-muted-foreground pt-1">K balíku <span className="text-foreground font-medium">{pkg.title}</span> alebo na mieru.</p>
          )}
        </DialogHeader>

        {step === "slot" && (
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-sm font-medium mb-2">Vyberte deň</p>
              <div className="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
                {days.map((d) => {
                  const sel = date?.toDateString() === d.date.toDateString();
                  return (
                    <button
                      key={d.date.toISOString()}
                      type="button"
                      onClick={() => setDate(d.date)}
                      className={`rounded-lg px-2 py-2 text-xs border transition-all ${
                        sel ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {date && (
              <div>
                <p className="text-sm font-medium mb-2">Vyberte čas</p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((t) => {
                    const sel = time === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        className={`rounded-lg px-2 py-2 text-sm border transition-all ${
                          sel ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-primary/40"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={() => {
                if (!date || !time) {
                  toast({ title: "Vyberte deň a čas", variant: "destructive" });
                  return;
                }
                setStep("contact");
              }}
            >
              Pokračovať <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === "contact" && (
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <p className="text-sm">
                {date?.toLocaleDateString("sk-SK", { day: "numeric", month: "long", weekday: "long" })} o <span className="font-bold">{time}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-name">Meno a priezvisko *</Label>
              <Input id="c-name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-email">E-mail *</Label>
                <Input id="c-email" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-phone">Telefón</Label>
                <Input id="c-phone" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep("slot")} className="px-4">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button type="submit" variant="gradient" size="lg" className="flex-1">
                Potvrdiť termín <Send className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Tešíme sa na vás {date?.toLocaleDateString("sk-SK", { day: "numeric", month: "long" })} o <span className="font-bold text-foreground">{time}</span>.
            </p>
            <Button variant="gradient" onClick={() => close(false)}>Zavrieť</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ModelSelectionSection = () => {
  const autoplay = useRef(Autoplay({ delay: 2800, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [orderPkg, setOrderPkg] = useState<SelectedPkg | null>(null);
  const [consultPkg, setConsultPkg] = useState<SelectedPkg | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [mode, setMode] = useState<BillingMode>("rental");

  const openOrder = (p: SelectedPkg) => { setOrderPkg(p); setOrderOpen(true); };
  const openConsult = (p: SelectedPkg) => { setConsultPkg(p); setConsultOpen(true); };

  const isRental = mode === "rental";
  const isAnnual = mode === "annual";
  const isOneOff = mode === "oneoff";

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="container mx-auto px-4 max-w-6xl relative">
        <AnimatedSection>
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-primary/30 bg-primary/10 text-primary mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Cenníky balíkov
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Tri balíky. Jeden cieľ — <span className="text-gradient">váš rast</span>.
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Vyberte si formu spolupráce — mesačný prenájom, ročný prenájom so zľavou 10 %, alebo jednorazové dodanie s vlastníctvom kódu.
            </p>
          </div>
        </AnimatedSection>

        {/* Billing mode toggle — 3 options */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center p-1 rounded-full border border-border bg-card/60 backdrop-blur-sm relative flex-wrap">
            {([
              { id: "rental" as const, label: "Mesačný prenájom", badge: "0 € vstup" },
              { id: "annual" as const, label: "Ročný prenájom", badge: "−10 %" },
              { id: "oneoff" as const, label: "Jednorazové riešenie", badge: null },
            ]).map((opt) => {
              const active = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`relative z-10 px-4 sm:px-6 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                  {opt.badge && (
                    <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                    }`}>
                      {opt.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 mb-16">
          {packages.map((p, i) => {
            const annualMonthly = p.price * (1 - ANNUAL_DISCOUNT);
            const annualTotal = Math.round(p.price * 12 * (1 - ANNUAL_DISCOUNT));
            const displayPrice = isOneOff
              ? p.oneOffPrice
              : isAnnual
                ? (annualMonthly % 1 === 0 ? annualMonthly.toFixed(0) : annualMonthly.toFixed(2))
                : p.price;
            const priceSuffix = isOneOff
              ? "jednorazovo, bez DPH"
              : isAnnual
                ? "/ mesiac (pri ročnej platbe)"
                : "/ mesiac, bez DPH";
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative rounded-3xl border p-6 md:p-8 grid md:grid-cols-[200px_1fr_220px] gap-6 items-center transition-all hover:-translate-y-0.5 ${
                  p.recommended
                    ? "bg-gradient-to-br from-primary/12 via-primary/5 to-transparent border-primary/30 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)]"
                    : "bg-card border-border/60 hover:border-primary/30"
                }`}
              >
                {p.recommended && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg">
                    <Sparkles className="w-3 h-3" /> Najobľúbenejšie
                  </span>
                )}

                {/* Package image */}
                <div className="flex items-center justify-center">
                  <div className="relative w-[160px] h-[160px] md:w-[200px] md:h-[200px] rounded-2xl overflow-hidden ring-1 ring-border/60 shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)]">
                    <img
                      src={p.image}
                      alt={`Balík ${p.title}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-primary mb-1">{p.badge}</p>
                  <h3 className="text-2xl md:text-3xl font-bold mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{p.subtitle}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-xl">{p.desc}</p>
                  <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[13px] whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price + CTA */}
                <div className="md:border-l md:border-border/60 md:pl-6 flex flex-col items-start md:items-center text-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-gradient">{displayPrice}</span>
                    <span className="text-2xl font-bold text-muted-foreground">€</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{priceSuffix}</p>
                  {isOneOff && (
                    <p className="text-[10px] text-primary/80 font-medium">
                      Prenájom od {p.price} €/mes • bez vstupu
                    </p>
                  )}
                  {isAnnual && (
                    <p className="text-[10px] text-primary font-medium">
                      Fakturované {annualTotal} € / rok (ušetríte 10 %)
                    </p>
                  )}
                  {isRental && (
                    <p className="text-[10px] text-muted-foreground/70">
                      Jednorazovo {p.oneOffPrice} €
                    </p>
                  )}
                  <Button onClick={() => openOrder(p)} variant="gradient" size="lg" className="w-full mt-2">
                    Navrhnúť riešenie <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  <a
                    href={OFFER_PDF_URL}
                    download
                    className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground/70 hover:text-primary transition-colors mt-1"
                  >
                    <Download className="w-3 h-3" /> Stiahnuť ponuku (PDF)
                  </a>
                  <button
                    onClick={() => openConsult(p)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors mt-1 underline-offset-4 hover:underline"
                  >
                    Alebo konzultácia →
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Rental advantage callout (only when one-off selected) */}
        {isOneOff && (
          <div className="mb-12 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center text-sm">
            <p className="text-foreground">
              <span className="font-bold text-primary">Tip:</span> Pri mesačnom prenájme začínate na <span className="font-bold">0 € vstupných nákladov</span>, máte v cene všetky úpravy, hosting, SSL aj nové AI funkcie. Vyplatí sa prvé 2 – 3 roky.
            </p>
          </div>
        )}

        {/* Capabilities carousel */}
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] font-bold text-primary mb-2">
              Čo všetko vieme vytvoriť
            </p>
            <h3 className="text-2xl md:text-3xl font-bold">
              Riešenia <span className="text-gradient">bez limitov</span>
            </h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Od jednoduchej landing page až po komplexné systémy s AI a automatizáciami.
          </p>
        </div>

        <Carousel opts={{ align: "start", loop: true }} plugins={[autoplay.current]} className="w-full">
          <CarouselContent className="-ml-3">
            {capabilities.map((c) => (
              <CarouselItem key={c.title} className="pl-3 basis-[80%] sm:basis-[45%] md:basis-[33%] lg:basis-[25%]">
                <div className="h-full flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 hover:border-primary/40 hover:shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.4)] transition-all">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <c.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{c.desc}</p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <ProposeSolutionDialog pkg={orderPkg} mode={mode} open={orderOpen} onOpenChange={setOrderOpen} />
      <ConsultationDialog pkg={consultPkg} open={consultOpen} onOpenChange={setConsultOpen} />
    </section>
  );
};

export default ModelSelectionSection;
