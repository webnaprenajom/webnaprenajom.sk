import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, ShoppingCart, CalendarCheck, Users, MapPin, FileText,
  CreditCard, MessageSquare, Mail, Search, BarChart3, Image as ImageIcon,
  Lock, Star, Headphones, BellRing, Palette, Layers,
  ArrowRight, ArrowLeft, Sparkles, Loader2, CheckCircle2, Building2, User, Heart,
  Brain, Bot,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LeadFormDialog from "./LeadFormDialog";
import AnimatedSection from "./AnimatedSection";

type WebsiteType = { id: string; icon: any; title: string; desc: string };
type Feature = { id: string; icon: any; title: string; desc: string };
type Audience = { id: string; icon: any; label: string };
type Model = "rental" | "wordpress" | "shoptet";

const websiteTypes: WebsiteType[] = [
  { id: "company", icon: Globe, title: "Firemný web", desc: "Prezentácia firmy a služieb" },
  { id: "eshop", icon: ShoppingCart, title: "E-shop", desc: "Online predaj produktov" },
  { id: "landing", icon: FileText, title: "Landing page", desc: "Jedna predajná stránka" },
  { id: "booking", icon: CalendarCheck, title: "Rezervačný systém", desc: "Online termíny a rezervácie" },
  { id: "portfolio", icon: Users, title: "Portfólio web", desc: "Pre kreatívcov a freelancerov" },
  { id: "local", icon: MapPin, title: "Lokálny biznis", desc: "Reštaurácia, kaviareň, fitko" },
];

const features: Feature[] = [
  { id: "payments", icon: CreditCard, title: "Online platby", desc: "Stripe, PayPal" },
  { id: "chatbot", icon: MessageSquare, title: "AI chatbot", desc: "24/7 komunikácia" },
  { id: "emails", icon: Mail, title: "E-mail notifikácie", desc: "Automatické maily" },
  { id: "seo", icon: Search, title: "SEO optimalizácia", desc: "Lepšie pozície v Google" },
  { id: "analytics", icon: BarChart3, title: "Analytika", desc: "Štatistiky návštevnosti" },
  { id: "gallery", icon: ImageIcon, title: "Galérie & médiá", desc: "Foto, video prezentácie" },
  { id: "security", icon: Lock, title: "Zabezpečenie & GDPR", desc: "SSL, cookie lišta" },
  { id: "reviews", icon: Star, title: "Recenzie", desc: "Hodnotenia od klientov" },
  { id: "forms", icon: Headphones, title: "Kontaktné formuláre", desc: "Inteligentné s validáciou" },
  { id: "push", icon: BellRing, title: "Push notifikácie", desc: "Upozornenia pre návštevníkov" },
  { id: "design", icon: Palette, title: "Vlastný dizajn", desc: "Unikátny vizuál" },
  { id: "multilang", icon: Layers, title: "Multi-jazyčnosť", desc: "SK, EN, DE..." },
  { id: "booking", icon: CalendarCheck, title: "Rezervácie", desc: "Termíny online" },
  { id: "ecommerce", icon: ShoppingCart, title: "E-commerce", desc: "Košík, sklad, faktúry" },
  { id: "crm", icon: Brain, title: "CRM systém", desc: "Správa zákazníkov" },
  { id: "memberArea", icon: Lock, title: "Členská sekcia", desc: "Prihlásenie pre klientov" },
];

const audiences: Audience[] = [
  { id: "smb", icon: Building2, label: "Malá / stredná firma" },
  { id: "freelancer", icon: User, label: "Živnostník / freelancer" },
  { id: "startup", icon: Sparkles, label: "Startup" },
  { id: "service", icon: Heart, label: "Služby (salón, wellness...)" },
  { id: "restaurant", icon: MapPin, label: "Reštaurácia / hotel" },
  { id: "shop", icon: ShoppingCart, label: "Predaj produktov" },
];

type Offer = {
  recommendedPackage: "landing" | "presentation" | "webapp";
  monthly: number;
  oneOffPrice: number | null;
  oneOffPlatform: string | null;
  model: Model;
  headline: string;
  summary: string;
  benefits: string[];
  cta: string;
};

const AiCapabilitiesSection = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [websiteType, setWebsiteType] = useState<string>("");
  const [audience, setAudience] = useState<string>("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [model, setModel] = useState<Model>("rental");
  const [loading, setLoading] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);

  const reset = () => {
    setStep(0);
    setWebsiteType("");
    setAudience("");
    setSelectedFeatures([]);
    setModel("rental");
    setOffer(null);
    setLoading(false);
  };

  const openWith = (preselectedType?: string, preselectedFeature?: string) => {
    reset();
    if (preselectedType) setWebsiteType(preselectedType);
    if (preselectedFeature) setSelectedFeatures([preselectedFeature]);
    setOpen(true);
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const calculatePrice = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-price-calculator", {
        body: {
          websiteType,
          features: selectedFeatures,
          businessType: audience,
          model,
        },
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

  const canNext = () => {
    if (step === 0) return !!websiteType;
    if (step === 1) return !!audience;
    if (step === 2) return selectedFeatures.length > 0;
    return true;
  };

  return (
    <section id="ai-calculator" className="py-24 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <AnimatedSection>
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
              <Sparkles className="w-4 h-4" />
              Interaktívna AI kalkulačka
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Čo všetko dokážeme{" "}
              <span className="text-gradient">s AI vytvoriť</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-2">
              Klikni na typ webu alebo funkciu, ktorá ťa zaujíma — AI ti vypočíta cenu riešenia na mieru.
            </p>
            <p className="text-sm text-primary font-medium">
              Mesačný paušál od 35€ • Jednorazovo WordPress od 800€ • Shoptet eshop od 1 200€
            </p>
          </div>
        </AnimatedSection>

        {/* Website types */}
        <h3 className="text-xl md:text-2xl font-bold text-center mb-6">Pre koho web staviame</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {websiteTypes.map((item, i) => (
            <motion.button
              key={item.id}
              onClick={() => openWith(item.id)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative rounded-2xl p-6 border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)] hover:-translate-y-1 transition-all duration-300 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <item.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold mb-1 flex items-center gap-2">
                    {item.title}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Big CTA */}
        <div className="text-center">
          <Button
            variant="gradient"
            size="lg"
            className="px-8 py-6 text-lg"
            onClick={() => openWith()}
          >
            <Sparkles className="mr-2 w-5 h-5" /> Spustiť AI kalkulačku
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            ⏱ Trvá 30 sekúnd • Bez registrácie • Cena na mieru od AI
          </p>
        </div>
      </div>

      {/* Calculator Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bot className="w-5 h-5 text-primary" />
              AI kalkulačka tvojho webu
            </DialogTitle>
            <DialogDescription>
              {step < 4 ? `Krok ${step + 1} zo 4 — pomôž AI navrhnúť optimálne riešenie` : "Tvoja personalizovaná ponuka"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          {step < 4 && (
            <div className="flex gap-1.5 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="s0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h4 className="font-semibold mb-3">Aký typ webu potrebuješ?</h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {websiteTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setWebsiteType(t.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        websiteType === t.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
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
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h4 className="font-semibold mb-3">Pre koho je tvoj biznis?</h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {audiences.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAudience(a.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        audience === a.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <a.icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">{a.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h4 className="font-semibold mb-1">Ktoré funkcie chceš mať?</h4>
                <p className="text-xs text-muted-foreground mb-3">Vyber jednu alebo viac.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {features.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleFeature(f.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedFeatures.includes(f.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <f.icon className="w-4 h-4 text-primary mb-1" />
                      <div className="text-xs font-semibold leading-tight">{f.title}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <h4 className="font-semibold mb-3">Ako chceš platiť?</h4>
                <div className="space-y-2">
                  {[
                    { id: "rental" as Model, title: "Mesačný paušál (odporúčame)", desc: "Od 35€/mes • Bez vstupných nákladov • Vrátane úprav, hostingu, AI obsahu", badge: "Najobľúbenejšie" },
                    { id: "wordpress" as Model, title: "Jednorazovo na WordPress", desc: "Klasický web, vlastníš ho • Od 800€ jednorazovo", badge: null },
                    { id: "shoptet" as Model, title: "Jednorazovo Shoptet eshop", desc: "Hotová eshop platforma • Od 1 200€ jednorazovo", badge: null },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        model === m.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm">{m.title}</div>
                        {m.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && offer && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      AI odporúčanie
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{offer.headline}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {offer.summary}
                  </p>

                  <div className="rounded-xl bg-background/60 p-4 mb-4">
                    {offer.model === "rental" ? (
                      <>
                        <div className="text-xs text-muted-foreground mb-1">Odporúčaný paušál</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-primary">{offer.monthly}€</span>
                          <span className="text-sm text-muted-foreground">/ mesiac</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Balík:{" "}
                          {offer.recommendedPackage === "landing"
                            ? "Landing page"
                            : offer.recommendedPackage === "presentation"
                            ? "Prezentačný web"
                            : "Web aplikácia (CRM, AI funkcie...)"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground mb-1">
                          Jednorazová cena ({offer.oneOffPlatform})
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-primary">
                            ~ {offer.oneOffPrice}€
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Orientačná cena, finálnu doladíme po krátkom hovore.
                        </div>
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
                  <LeadFormDialog initialStep="inquiry">
                    <Button variant="gradient" size="lg" className="flex-1">
                      Chcem túto ponuku <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </LeadFormDialog>
                  <Button variant="outline" size="lg" onClick={reset}>
                    Vyskúšať znova
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between gap-2 pt-4 border-t mt-2">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="mr-2 w-4 h-4" /> Späť
              </Button>
              {step < 3 ? (
                <Button
                  variant="gradient"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext()}
                >
                  Ďalej <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              ) : (
                <Button variant="gradient" onClick={calculatePrice} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" /> AI počíta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 w-4 h-4" /> Vypočítať cenu
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AiCapabilitiesSection;
