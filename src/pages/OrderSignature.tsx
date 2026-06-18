import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, FileSignature, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PACKAGES = {
  start:  { label: "Štart",   rental: 35, oneoff: 690  },
  biznis: { label: "Biznis",  rental: 49, oneoff: 1490 },
  pro:    { label: "Pro CRM", rental: 69, oneoff: 3990 },
  custom: { label: "Individuálny", rental: 0, oneoff: 0 },
} as const;

type PackageKey = keyof typeof PACKAGES;
type Plan = "rental" | "oneoff";

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
    return plan === "rental" ? PACKAGES[pkg].rental : PACKAGES[pkg].oneoff;
  }, [pkg, plan, customPrice]);

  const contractMonths = plan === "rental" ? 12 : 0;

  const canSubmit =
    clientName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    signatureName.trim().length > 1 &&
    agreedTerms &&
    (plan === "oneoff" || agreedCommitment) &&
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="max-w-xl w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Objednávka podpísaná ✍️</h1>
          <p className="text-muted-foreground">
            Ďakujeme! Vaša objednávka bola zaregistrovaná a elektronicky podpísaná. Do 24 hodín sa Vám ozveme s ďalšími krokmi.
          </p>
          <p className="text-xs text-muted-foreground">Referenčné číslo: {done.id.slice(0, 8).toUpperCase()}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Bezpečný elektronický podpis
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">Objednávka služby Web na prenájom</h1>
          <p className="text-muted-foreground text-sm">
            Vyplňte údaje, skontrolujte zhrnutie a podpíšte objednávku vypísaním Vášho mena.
          </p>
        </header>

        <Card className="p-5 sm:p-6 space-y-5">
          <h2 className="text-lg font-bold">1. Vybraný balík</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(PACKAGES) as PackageKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPkg(k)}
                className={`p-3 rounded-lg border text-sm font-medium transition ${
                  pkg === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {PACKAGES[k].label}
              </button>
            ))}
          </div>

          <RadioGroup value={plan} onValueChange={(v) => setPlan(v as Plan)} className="grid sm:grid-cols-2 gap-3">
            <Label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${plan === "rental" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="rental" id="r" className="mt-1" />
              <div>
                <div className="font-semibold">Mesačný prenájom</div>
                <div className="text-xs text-muted-foreground">0 € vstupný poplatok · viazanosť 12 mesiacov</div>
              </div>
            </Label>
            <Label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${plan === "oneoff" ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value="oneoff" id="o" className="mt-1" />
              <div>
                <div className="font-semibold">Jednorazové riešenie</div>
                <div className="text-xs text-muted-foreground">Bez viazanosti, jednorazová platba</div>
              </div>
            </Label>
          </RadioGroup>

          {pkg === "custom" ? (
            <div>
              <Label htmlFor="cp">Dohodnutá cena (€)</Label>
              <Input id="cp" type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(Number(e.target.value))} />
            </div>
          ) : null}

          <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cena</span>
            <span className="text-2xl font-bold text-primary">
              {price} €{plan === "rental" && pkg !== "custom" ? " / mesiac" : ""}
            </span>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold">2. Fakturačné údaje</h2>
          <div className="grid sm:grid-cols-2 gap-3">
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

        <Card className="p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold">3. Podmienky a elektronický podpis</h2>

          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2 max-h-48 overflow-y-auto">
            <p className="font-semibold">Zhrnutie objednávky:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Balík: <strong className="text-foreground">{PACKAGES[pkg].label}</strong></li>
              <li>Forma: <strong className="text-foreground">{plan === "rental" ? "Mesačný prenájom" : "Jednorazové riešenie"}</strong></li>
              <li>Cena: <strong className="text-foreground">{price} €{plan === "rental" ? " mesačne" : ""}</strong></li>
              {plan === "rental" && (
                <li>Viazanosť: <strong className="text-foreground">12 mesiacov</strong> od dátumu spustenia webu</li>
              )}
              <li>Vstupný poplatok: <strong className="text-foreground">0 €</strong></li>
            </ul>
            {plan === "rental" && (
              <p className="pt-2 text-xs">
                Zákazník sa zaväzuje uhrádzať mesačný poplatok počas celej doby viazanosti (12 mesiacov).
                Po skončení viazanosti pokračuje zmluva na dobu neurčitú s výpovednou lehotou 1 mesiac.
                Web je hostovaný a spravovaný poskytovateľom SaleLogics s.r.o.
              </p>
            )}
          </div>

          {plan === "rental" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={agreedCommitment} onCheckedChange={(v) => setAgreedCommitment(v === true)} className="mt-1" />
              <span className="text-sm">
                Súhlasím s <strong>12-mesačnou viazanosťou</strong> a podmienkami mesačného prenájmu webu.
              </span>
            </label>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(v === true)} className="mt-1" />
            <span className="text-sm">
              Súhlasím s obchodnými podmienkami a so spracovaním osobných údajov pre účely tejto objednávky.
            </span>
          </label>

          <div>
            <Label htmlFor="sig" className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-primary" />
              Elektronický podpis – vypíšte Vaše celé meno *
            </Label>
            <Input
              id="sig"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="napr. Ján Novák"
              className="text-lg font-signature italic"
              style={{ fontFamily: "'Caveat', cursive" }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Vypísaním mena potvrdzujete objednávku. Bude zaznamenaný čas, IP adresa a prehliadač.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
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
