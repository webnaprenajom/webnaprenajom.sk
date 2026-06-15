import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { CheckCircle2, FileSignature, Loader2, ShieldCheck, Sparkles, Calendar, Zap, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PACKAGES = {
  start:  { label: "Štart",   rental: 35, oneoff: 690  },
  biznis: { label: "Biznis",  rental: 49, oneoff: 1490 },
  pro:    { label: "Pro CRM", rental: 69, oneoff: 3990 },
  custom: { label: "Individuálny", rental: 0, oneoff: 0 },
} as const;

const ANNUAL_DISCOUNT = 0.1;

type PackageKey = keyof typeof PACKAGES;
type Plan = "rental" | "annual" | "oneoff";

const PLAN_META: Record<Plan, { label: string; icon: typeof Calendar; sub: string }> = {
  rental: { label: "Mesačný prenájom",  icon: Calendar, sub: "0 € vstupný poplatok · viazanosť 12 mesiacov" },
  annual: { label: "Ročný prenájom",    icon: Sparkles, sub: "Zľava 10 % oproti mesačnej platbe · platba raz ročne" },
  oneoff: { label: "Jednorazové riešenie", icon: Zap,   sub: "Bez viazanosti, jednorazová platba — web je váš" },
};

export default function OrderSignature() {
  const [params] = useSearchParams();

  const [pkg, setPkg] = useState<PackageKey>((params.get("package") as PackageKey) || "biznis");
  const [plan, setPlan] = useState<Plan>((params.get("plan") as Plan) || "rental");
  const [customPrice, setCustomPrice] = useState<number>(Number(params.get("price")) || 0);

  const [clientName, setClientName] = useState(params.get("name") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [ico, setIco] = useState("");
  const [dic, setDic] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [signatureName, setSignatureName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedCommitment, setAgreedCommitment] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  useEffect(() => {
    document.title = "Objednávka a elektronický podpis – Web na prenájom";
  }, []);

  const price = useMemo(() => {
    if (pkg === "custom") return customPrice;
    if (plan === "oneoff") return PACKAGES[pkg].oneoff;
    if (plan === "annual") return Math.round(PACKAGES[pkg].rental * 12 * (1 - ANNUAL_DISCOUNT));
    return PACKAGES[pkg].rental;
  }, [pkg, plan, customPrice]);

  const monthlyEquivalent = useMemo(() => {
    if (pkg === "custom" || plan !== "annual") return null;
    return Math.round(PACKAGES[pkg].rental * (1 - ANNUAL_DISCOUNT));
  }, [pkg, plan]);

  const contractMonths = plan === "rental" || plan === "annual" ? 12 : 0;
  const isRecurring = plan === "rental" || plan === "annual";

  const canSubmit =
    clientName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    signatureName.trim().length > 1 &&
    agreedTerms &&
    (!isRecurring || agreedCommitment) &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-signature", {
        body: {
          client_name: clientName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          company: company.trim(),
          ico: ico.trim(),
          dic: dic.trim(),
          address: address.trim(),
          plan,
          package_name: pkg,
          price,
          contract_months: contractMonths,
          signature_name: signatureName.trim(),
          agreed_terms: true,
          notes: notes.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone({ id: (data as any).id });
    } catch (e) {
      toast({
        title: "Odoslanie zlyhalo",
        description: e instanceof Error ? e.message : "Skúste znova",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex items-center justify-center px-4 py-12">
        <Card className="max-w-xl w-full p-10 text-center space-y-5 border-primary/20 shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Objednávka podpísaná ✍️</h1>
          <p className="text-muted-foreground">
            Ďakujeme! Vaša objednávka bola zaregistrovaná a elektronicky podpísaná. Do 24 hodín sa Vám ozveme s ďalšími krokmi.
          </p>
          <p className="text-xs text-muted-foreground bg-muted/50 inline-block px-3 py-1 rounded-full">
            Referenčné číslo: <strong>{done.id.slice(0, 8).toUpperCase()}</strong>
          </p>
        </Card>
      </div>
    );
  }

  const priceSuffix =
    plan === "annual" ? " / rok"
    : plan === "rental" && pkg !== "custom" ? " / mesiac"
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background py-10 sm:py-14 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Bezpečný elektronický podpis
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Objednávka služby <span className="text-primary">Web na prenájom</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Vyplňte údaje, skontrolujte zhrnutie a podpíšte objednávku vypísaním Vášho mena.
          </p>
        </header>

        {/* Step 1 */}
        <Card className="p-6 sm:p-8 space-y-6 border-border/60 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">1</div>
            <h2 className="text-xl font-bold">Vybraný balík</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(PACKAGES) as PackageKey[]).map((k) => {
              const active = pkg === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPkg(k)}
                  className={`group p-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-md scale-[1.02]"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-center mb-1.5">
                    {k === "pro" ? <Crown className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                     : k === "custom" ? <Sparkles className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                     : <Zap className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />}
                  </div>
                  {PACKAGES[k].label}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {(Object.keys(PLAN_META) as Plan[]).map((p) => {
              const meta = PLAN_META[p];
              const Icon = meta.icon;
              const active = plan === p;
              const isAnnual = p === "annual";
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {isAnnual && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow">
                      ZĽAVA 10 %
                    </span>
                  )}
                  <Icon className={`w-5 h-5 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">{meta.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{meta.sub}</div>
                </button>
              );
            })}
          </div>

          {pkg === "custom" ? (
            <div>
              <Label htmlFor="cp">Dohodnutá cena (€)</Label>
              <Input id="cp" type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(Number(e.target.value))} />
            </div>
          ) : null}

          <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Cena objednávky</div>
              {monthlyEquivalent != null && (
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  ≈ {monthlyEquivalent} € / mesiac (ušetríte 10 %)
                </div>
              )}
            </div>
            <span className="text-3xl sm:text-4xl font-extrabold text-primary">
              {price} €<span className="text-base font-medium text-muted-foreground">{priceSuffix}</span>
            </span>
          </div>
        </Card>

        {/* Step 2 */}
        <Card className="p-6 sm:p-8 space-y-5 border-border/60 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">2</div>
            <h2 className="text-xl font-bold">Fakturačné údaje</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Meno a priezvisko / Kontaktná osoba *</Label>
              <Input id="name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">Telefón</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="company">Firma</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ico">IČO</Label>
              <Input id="ico" value={ico} onChange={(e) => setIco(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="dic">DIČ / IČ DPH</Label>
              <Input id="dic" value={dic} onChange={(e) => setDic(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="addr">Fakturačná adresa</Label>
              <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ulica, mesto, PSČ" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Poznámka (nepovinné)</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Step 3 */}
        <Card className="p-6 sm:p-8 space-y-6 border-border/60 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">3</div>
            <h2 className="text-xl font-bold">Podmienky a elektronický podpis</h2>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm space-y-3 max-h-56 overflow-y-auto">
            <p className="font-semibold">Zhrnutie objednávky:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Balík: <strong className="text-foreground">{PACKAGES[pkg].label}</strong></li>
              <li>Forma: <strong className="text-foreground">{PLAN_META[plan].label}</strong></li>
              <li>Cena: <strong className="text-foreground">{price} €{priceSuffix}</strong>{monthlyEquivalent != null && <span className="text-emerald-600"> (≈ {monthlyEquivalent} €/mes, ušetríte 10 %)</span>}</li>
              {isRecurring && (
                <li>Viazanosť: <strong className="text-foreground">12 mesiacov</strong> od dátumu spustenia webu</li>
              )}
              <li>Vstupný poplatok: <strong className="text-foreground">0 €</strong></li>
            </ul>
            {isRecurring && (
              <p className="pt-2 text-xs leading-relaxed">
                Zákazník sa zaväzuje uhrádzať {plan === "annual" ? "ročný" : "mesačný"} poplatok počas celej doby viazanosti (12 mesiacov).
                Po skončení viazanosti pokračuje zmluva na dobu neurčitú s výpovednou lehotou 1 mesiac.
                Web je hostovaný a spravovaný poskytovateľom SaleLogics s.r.o.
              </p>
            )}
          </div>

          <div className="space-y-4">
            {isRecurring && (
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/40 transition">
                <Checkbox checked={agreedCommitment} onCheckedChange={(v) => setAgreedCommitment(v === true)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">
                  Súhlasím s <strong>12-mesačnou viazanosťou</strong> a podmienkami {plan === "annual" ? "ročného" : "mesačného"} prenájmu webu.
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/40 transition">
              <Checkbox checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(v === true)} className="mt-0.5" />
              <span className="text-sm leading-relaxed">
                Súhlasím s obchodnými podmienkami a so spracovaním osobných údajov pre účely tejto objednávky.
              </span>
            </label>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="sig" className="flex items-center gap-2 text-sm font-semibold">
              <FileSignature className="w-4 h-4 text-primary" />
              Elektronický podpis – vypíšte Vaše celé meno *
            </Label>
            <Input
              id="sig"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="napr. Ján Novák"
              className="text-xl italic h-14 border-2 focus-visible:border-primary"
              style={{ fontFamily: "'Caveat', cursive" }}
            />
            <p className="text-[11px] text-muted-foreground">
              Vypísaním mena potvrdzujete objednávku. Bude zaznamenaný čas, IP adresa a prehliadač.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full h-14 text-base font-semibold shadow-lg shadow-primary/20 mt-2"
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileSignature className="w-5 h-5 mr-2" />}
            Podpísať a odoslať objednávku
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-8">
          © SaleLogics s.r.o. · webnaprenajom.sk
        </p>
      </div>
    </div>
  );
}
