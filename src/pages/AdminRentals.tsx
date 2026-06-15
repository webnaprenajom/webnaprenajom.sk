import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  FileText,
  X,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Coins,
  Euro,
  CalendarDays,
} from "lucide-react";
import { buildClientNameEmailMap, customerHrefByClientName } from "@/lib/adminNav";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import { FINANCE_TRUTH_DISCLAIMER, RENTAL_MONTH_STATUS_LABELS } from "@/lib/finance/labels";
import { type PaymentFormValue } from "@/lib/paymentForm";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import { type FactDraft, prefillFromRentalPayment } from "@/lib/finance/factDrafts";
import { ImplementerCommissionDetailDialog } from "@/components/admin/rentals/ImplementerCommissionDetailDialog";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

interface Implementer {
  name: string;
  percentage: number;
  payment_form?: PaymentFormValue | "";
  note?: string;
}

interface RentalWebsite {
  id: string;
  name: string;
  url: string | null;
  client_name: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  source: string | null;
  monthly_price: number;
  year: number;
  note: string | null;
  rental_start_date: string | null;
  credits_used: number;
  implementers: Implementer[];
}

type PaymentStatus = "none" | "invoice" | "paid" | "unpaid" | "overdue";

interface RentalPayment {
  id: string;
  website_id: string;
  year: number;
  month: number;
  amount: number;
  paid: boolean;
  status: PaymentStatus;
  paid_at: string | null;
  custom_price: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"];

// 100 credits = 30 EUR cost
const CREDIT_COST = 30 / 100;

const NEXT_STATUS: Record<PaymentStatus, PaymentStatus> = {
  none: "invoice",
  invoice: "paid",
  paid: "unpaid",
  unpaid: "overdue",
  overdue: "none",
};

const PAYMENT_STATUS_RANK: Record<PaymentStatus, number> = {
  none: 0,
  invoice: 1,
  unpaid: 2,
  overdue: 3,
  paid: 4,
};

const isPaymentDowngrade = (current: PaymentStatus, next: PaymentStatus) =>
  PAYMENT_STATUS_RANK[next] < PAYMENT_STATUS_RANK[current];

const emptyWebsite = (): RentalWebsite => ({
  id: "",
  name: "",
  url: "",
  client_name: "",
  source: "",
  monthly_price: 35,
  year: new Date().getFullYear(),
  note: "",
  rental_start_date: null,
  credits_used: 0,
  implementers: [],
});

// ponytail: Phase 1 PoC unsaved-changes guard — normalizes null/"" and number
// coercion drift so dirty-check matches what the form inputs actually do.
const normalizeWebsiteForCompare = (w: RentalWebsite | null) => {
  if (!w) return null;
  return {
    name: w.name ?? "",
    url: w.url ?? "",
    client_name: w.client_name ?? "",
    customer_id: w.customer_id ?? null,
    customer_email: w.customer_email ?? "",
    source: w.source ?? "",
    monthly_price: Number(w.monthly_price) || 0,
    year: Number(w.year) || 0,
    note: w.note ?? "",
    rental_start_date: w.rental_start_date ?? "",
    credits_used: Number(w.credits_used) || 0,
    implementers: (w.implementers || []).map((i) => ({
      name: i.name ?? "",
      percentage: Number(i.percentage) || 0,
      payment_form: i.payment_form ?? "",
      note: i.note ?? "",
    })),
  };
};

const ASSIGNEES = ["Peter", "Maroš", "Matuš"];

const normalizeImplementers = (raw: unknown): Implementer[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any): Implementer => {
      const paymentForm = ["cash", "iban", "crypto", "faktura", "ine"].includes(String(r?.payment_form))
        ? (r.payment_form as PaymentFormValue)
        : "";
      return {
        name: String(r?.name ?? "").trim(),
        percentage: Number(r?.percentage) || 0,
        payment_form: paymentForm,
        note: String(r?.note ?? "").trim(),
      };
    })
    .filter((r) => r.name);
};

export default function AdminRentals() {
  const [loading, setLoading] = useState(true);
  const [websites, setWebsites] = useState<RentalWebsite[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [editing, setEditing] = useState<RentalWebsite | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [pricesOpen, setPricesOpen] = useState<RentalWebsite | null>(null);
  const [pricesDraft, setPricesDraft] = useState<Record<number, string>>({});
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [paymentFactDraft, setPaymentFactDraft] = useState<FactDraft | null>(null);
  const [paymentFactOpen, setPaymentFactOpen] = useState(false);
  const [commissions, setCommissions] = useState<Array<{
    id: string;
    title: string;
    date: string;
    amount: number;
    payment_status: string;
    note: string | null;
    payment_form: string | null;
    implementer: string;
    source_type?: string | null;
    source_id?: string | null;
    customer_email?: string | null;
  }>>([]);
  const [detailImplementer, setDetailImplementer] = useState<string | null>(null);
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({
    onSuccess: () => void loadAll(),
  });

  // ponytail: Phase 1 PoC — unsaved-changes guard for the "Pridať/Upraviť web" modal.
  const websiteGuard = useUnsavedChangesGuard({
    isOpen: !!editing,
    current: editing,
    normalize: normalizeWebsiteForCompare,
  });

  const requestCloseWebsiteDialog = () => {
    if (!websiteGuard.confirmDiscard()) return;
    setEditing(null);
  };

  useEffect(() => {
    void loadAll().finally(() => setLoading(false));
  }, []);

  const loadAll = async () => {
    const [w, p, leadsRes, commRes] = await Promise.all([
      (supabase as any).from("rental_websites").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("rental_payments").select("*"),
      supabase.from("leads").select("name,email"),
      supabase.from("commissions").select("id,title,date,amount,payment_status,note,payment_form,implementer,source_type,source_id,customer_email"),
    ]);
    if (w.data) {
      setWebsites(
        (w.data as any[]).map((r) => ({
          ...r,
          implementers: normalizeImplementers(r?.implementers),
        })) as RentalWebsite[]
      );
    }
    if (p.data) setPayments(p.data as RentalPayment[]);
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
    }
    if (!commRes.error && commRes.data) {
      setCommissions(commRes.data as typeof commissions);
    } else if (commRes.error) {
      const fallback = await supabase.from("commissions").select("id,title,date,amount,payment_status,note,implementer");
      if (!fallback.error && fallback.data) {
        setCommissions(
          fallback.data.map((r) => ({ ...r, payment_form: null })) as typeof commissions,
        );
      }
    }
  };

  const paymentMap = useMemo(() => {
    const map = new Map<string, RentalPayment>();
    payments.forEach((p) => map.set(`${p.website_id}-${p.year}-${p.month}`, p));
    return map;
  }, [payments]);

  const monthPrice = (w: RentalWebsite, month: number): number => {
    const p = paymentMap.get(`${w.id}-${year}-${month}`);
    if (p?.custom_price != null) return Number(p.custom_price);
    return Number(w.monthly_price);
  };

  const saveWebsite = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast({ title: "Zadaj názov webu", variant: "destructive" });
      return;
    }
    const cleanImplementers = (editing.implementers || [])
      .map((i) => {
        const row: Record<string, unknown> = {
          name: i.name.trim(),
          percentage: Number(i.percentage) || 0,
        };
        if (i.payment_form) row.payment_form = i.payment_form;
        if (i.note?.trim()) row.note = i.note.trim();
        return row;
      })
      .filter((i) => i.name);
    const linked = await resolveCustomerLinkFields({
      customer_id: editing.customer_id,
      customer_email: editing.customer_email,
      client_name: editing.client_name,
      manual_link: !!editing.customer_id,
    });
    if (linked.warnings?.length) {
      toast({ title: "Upozornenie klienta", description: linked.warnings[0] });
    }
    const payload = {
      name: editing.name,
      url: editing.url || null,
      client_name: linked.client_name || null,
      customer_id: linked.customer_id,
      customer_email: linked.customer_email,
      source: editing.source || null,
      monthly_price: Number(editing.monthly_price) || 0,
      year: Number(editing.year) || new Date().getFullYear(),
      note: editing.note || null,
      rental_start_date: editing.rental_start_date || null,
      credits_used: Number(editing.credits_used) || 0,
      implementers: cleanImplementers,
    };
    const isCreate = !editing.id;
    const res = isCreate
      ? await (supabase as any).from("rental_websites").insert(payload).select("id").maybeSingle()
      : await (supabase as any).from("rental_websites").update(payload).eq("id", editing.id!).select("id").maybeSingle();
    if (res.error) {
      toast({ title: "Chyba", description: res.error.message, variant: "destructive" });
      return;
    }
    const recordId = res.data?.id ?? editing.id;
    if (isCreate && recordId) {
      logEntityCommunicationEventSafe({
        kind: "rental_event",
        title: payload.name,
        body_preview: payload.url ?? `${payload.monthly_price} €/mes`,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "rental_websites",
        source_id: recordId,
        idempotency_key: `rental_websites:${recordId}:created`,
        metadata: { action: "created" },
      });
    }

    // Sync credits as expense (one row per website per year)
    const credits = Number(editing.credits_used) || 0;
    const expenseAmount = credits * CREDIT_COST;
    const expenseTitle = `AI kredity — ${editing.name} (${editing.year})`;
    const expenseNote = `rental_credits:${recordId || editing.name}:${editing.year}`;
    if (credits > 0 && recordId) {
      const { data: existingExp } = await (supabase as any)
        .from("expenses")
        .select("id")
        .eq("note", expenseNote)
        .maybeSingle();
      if (existingExp?.id) {
        await (supabase as any).from("expenses").update({
          amount: expenseAmount,
          title: expenseTitle,
          category: "AI kredity",
        }).eq("id", existingExp.id);
      } else {
        await (supabase as any).from("expenses").insert({
          title: expenseTitle,
          amount: expenseAmount,
          category: "AI kredity",
          note: expenseNote,
          payment_status: "paid",
          date: new Date().toISOString().slice(0, 10),
        });
      }
    }

    toast({ title: editing.id ? "Aktualizované" : "Pridané" });
    setEditing(null);
    await loadAll();
  };

  const cyclePayment = async (website: RentalWebsite, month: number) => {
    const key = `${website.id}-${year}-${month}`;
    const existing = paymentMap.get(key);
    const current: PaymentStatus = (existing?.status as PaymentStatus) || "none";
    const next = NEXT_STATUS[current];

    if (isPaymentDowngrade(current, next)) {
      const from = RENTAL_MONTH_STATUS_LABELS[current] ?? current;
      const to = RENTAL_MONTH_STATUS_LABELS[next] ?? next;
      if (!confirm(`Zmeniť stav platby z „${from}" na „${to}"?\n\nIde o krok späť — overte, či je to zámer.`)) {
        return;
      }
    }

    const price = monthPrice(website, month);

    if (existing) {
      const { error } = await (supabase as any)
        .from("rental_payments")
        .update({
          status: next,
          paid: next === "paid",
          paid_at: next === "paid" ? new Date().toISOString() : null,
          amount: price,
        })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await (supabase as any).from("rental_payments").insert({
        website_id: website.id,
        year,
        month,
        amount: price,
        status: next,
        paid: next === "paid",
        paid_at: next === "paid" ? new Date().toISOString() : null,
      });
      if (error) {
        toast({ title: "Chyba", description: error.message, variant: "destructive" });
        return;
      }
    }

    if (next === "paid") {
      await loadAll();
      const { data: paymentRow } = await (supabase as any)
        .from("rental_payments")
        .select("*")
        .eq("website_id", website.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (paymentRow) {
        const { data: linked } = await supabase
          .from("payment_records")
          .select("id")
          .eq("source_table", "rental_payments")
          .eq("source_id", paymentRow.id)
          .maybeSingle();
        if (!linked) {
          const draft = prefillFromRentalPayment(paymentRow, website, {
            commissions: [],
            expenses: [],
            websites: [],
            payments: [],
            paymentRecords: [],
            payoutRecords: [],
            costRecords: [],
          });
          if (draft) {
            setPaymentFactDraft(draft);
            setPaymentFactOpen(true);
          }
        }
      }
    } else {
      await loadAll();
    }

    if (next === "overdue") {
      const recipient = (website.customer_email || "").trim();
      if (!recipient) {
        toast({
          title: "Stav nastavený na omeškaná platba",
          description: "E-mail klientovi nebol odoslaný — chýba kontaktný e-mail pri webe.",
          variant: "destructive",
        });
      } else {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-overdue-email", {
            body: {
              email: recipient,
              client_name: website.client_name || "",
              website_name: website.name,
              website_url: website.url || "",
              month,
              year,
              amount: monthPrice(website, month),
            },
          });
          if (emailError) throw emailError;
          toast({
            title: "Omeškaná platba",
            description: `Klientovi (${recipient}) bol odoslaný e-mail o deaktivácii.`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Neznáma chyba";
          toast({ title: "E-mail nebol odoslaný", description: msg, variant: "destructive" });
        }
      }
    }
  };

  const openPrices = (w: RentalWebsite) => {
    const draft: Record<number, string> = {};
    for (let m = 1; m <= 12; m++) {
      const p = paymentMap.get(`${w.id}-${year}-${m}`);
      draft[m] = p?.custom_price != null ? String(p.custom_price) : "";
    }
    setPricesDraft(draft);
    setPricesOpen(w);
  };

  const savePrices = async () => {
    if (!pricesOpen) return;
    const w = pricesOpen;
    for (let m = 1; m <= 12; m++) {
      const raw = (pricesDraft[m] ?? "").trim();
      const value = raw === "" ? null : Number(raw.replace(",", "."));
      if (raw !== "" && Number.isNaN(value)) continue;
      const key = `${w.id}-${year}-${m}`;
      const existing = paymentMap.get(key);
      if (existing) {
        await (supabase as any)
          .from("rental_payments")
          .update({
            custom_price: value,
            // if status untouched and we have a custom price, keep amount in sync
            amount: value != null ? value : Number(w.monthly_price),
          })
          .eq("id", existing.id);
      } else if (value != null) {
        await (supabase as any).from("rental_payments").insert({
          website_id: w.id,
          year,
          month: m,
          amount: value,
          custom_price: value,
          status: "none",
        });
      }
    }
    toast({ title: "Ceny uložené" });
    setPricesOpen(null);
    await loadAll();
  };

  const yearStats = (website: RentalWebsite) => {
    let paid = 0;
    let invoiced = 0;
    let unpaid = 0;
    let potential = 0;
    for (let m = 1; m <= 12; m++) {
      const p = paymentMap.get(`${website.id}-${year}-${m}`);
      const price = p?.custom_price != null ? Number(p.custom_price) : Number(website.monthly_price);
      const amt = Number(p?.amount ?? price);
      const st = (p?.status as PaymentStatus) || "none";
      if (st === "paid") paid += amt;
      else if (st === "invoice") invoiced += amt;
      else if (st === "unpaid") unpaid += amt;
      potential += price;
    }
    return { paid, invoiced, unpaid, potential };
  };

  const totals = useMemo(() => {
    let paid = 0, invoiced = 0, unpaid = 0, potential = 0, creditsCost = 0;
    websites.forEach((w) => {
      const s = yearStats(w);
      paid += s.paid;
      invoiced += s.invoiced;
      unpaid += s.unpaid;
      potential += s.potential;
      creditsCost += (Number(w.credits_used) || 0) * CREDIT_COST;
    });
    return { paid, invoiced, unpaid, potential, creditsCost };
  }, [websites, payments, year]);

  // Per-implementer commission breakdown (year)
  const implementerStats = useMemo(() => {
    const map = new Map<string, { paid: number; potential: number; projects: number }>();
    websites.forEach((w) => {
      const s = yearStats(w);
      (w.implementers || []).forEach((imp) => {
        const pct = Number(imp.percentage) || 0;
        if (!imp.name || pct <= 0) return;
        const cur = map.get(imp.name) || { paid: 0, potential: 0, projects: 0 };
        cur.paid += (s.paid * pct) / 100;
        cur.potential += (s.potential * pct) / 100;
        cur.projects += 1;
        map.set(imp.name, cur);
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.potential - a.potential);
  }, [websites, payments, year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const statusStyle = (st: PaymentStatus) => {
    switch (st) {
      case "invoice":
        return "bg-orange-500/20 border-orange-500/50 text-orange-500 hover:bg-orange-500/30";
      case "paid":
        return "bg-green-500/20 border-green-500/50 text-green-500 hover:bg-green-500/30";
      case "unpaid":
        return "bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30";
      case "overdue":
        return "bg-purple-600/25 border-purple-600/60 text-purple-200 hover:bg-purple-600/40";
      default:
        return "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60";
    }
  };

  const statusIcon = (st: PaymentStatus, month: number) => {
    if (st === "invoice") return <FileText className="w-4 h-4" />;
    if (st === "paid") return <Check className="w-4 h-4" />;
    if (st === "unpaid") return <X className="w-4 h-4" />;
    if (st === "overdue") return <AlertTriangle className="w-4 h-4" />;
    return <span className="text-xs">{month}</span>;
  };

  return (
    <AdminShell
      title="Weby na prenájom"
      subtitle="Mesiac = interný workflow stav, nie bankový dôkaz"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={() => setEditing(emptyWebsite())} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Pridať web
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">{FINANCE_TRUTH_DISCLAIMER}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center gap-2 text-green-500 text-xs font-medium uppercase tracking-wide">
              <Wallet className="w-4 h-4" /> {RENTAL_MONTH_STATUS_LABELS.paid} ({year})
            </div>
            <div className="text-2xl font-bold mt-1">{totals.paid.toFixed(0)}€</div>
          </div>
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-center gap-2 text-orange-500 text-xs font-medium uppercase tracking-wide">
              <FileText className="w-4 h-4" /> Faktúry vystavené
            </div>
            <div className="text-2xl font-bold mt-1">{totals.invoiced.toFixed(0)}€</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center gap-2 text-red-500 text-xs font-medium uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4" /> Nezaplatené
            </div>
            <div className="text-2xl font-bold mt-1">{totals.unpaid.toFixed(0)}€</div>
          </div>
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
            <div className="flex items-center gap-2 text-purple-500 text-xs font-medium uppercase tracking-wide">
              <Coins className="w-4 h-4" /> Náklad kredity
            </div>
            <div className="text-2xl font-bold mt-1">{totals.creditsCost.toFixed(0)}€</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-2 text-primary text-xs font-medium uppercase tracking-wide">
              <TrendingUp className="w-4 h-4" /> Potenciál ročne
            </div>
            <div className="text-2xl font-bold mt-1">{totals.potential.toFixed(0)}€</div>
          </div>
        </div>

        {/* Per-implementer commissions for the selected year */}
        {implementerStats.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Provízie realizátorov ({year})</h2>
              <span className="text-xs text-muted-foreground">· odvodené z % podielu — nie payout záznam</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {implementerStats.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setDetailImplementer(s.name)}
                  className="rounded-md border border-border bg-background/60 p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{s.name}</div>
                    <Badge variant="outline" className="text-[10px]">{s.projects} projekt(ov)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Vyplatené (uhradené)</div>
                      <div className="font-bold text-green-500">{s.paid.toFixed(2)}€</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Potenciál ročne</div>
                      <div className="font-bold text-primary">{s.potential.toFixed(2)}€</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-primary mt-2">Klikni pre detail webov a zákaziek →</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Legenda:</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500/40 border border-orange-500/60"/> Faktúra</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500/40 border border-green-500/60"/> Uhradené</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/40 border border-red-500/60"/> Nezaplatené</span>
          <span className="inline-flex items-center gap-1.5"><Euro className="w-3 h-3 text-primary"/> Klikni € pre úpravu ceny pre konkrétny mesiac</span>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Web / Klient</TableHead>
                <TableHead className="min-w-[120px]">Zdroj</TableHead>
                <TableHead>Cena/mes</TableHead>
                <TableHead className="text-right whitespace-nowrap">Kredity</TableHead>
                {MONTHS.map((m, i) => (
                  <TableHead key={i} className="text-center px-2">{m}</TableHead>
                ))}
                <TableHead className="text-right">Uhradené</TableHead>
                <TableHead className="text-right">Faktúry</TableHead>
                <TableHead className="text-right">Dlh</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={20} className="text-center text-muted-foreground py-10">
                    Žiadne weby. Pridaj prvý.
                  </TableCell>
                </TableRow>
              )}
              {websites.map((w) => {
                const stats = yearStats(w);
                const credits = Number(w.credits_used) || 0;
                const creditCost = credits * CREDIT_COST;
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="font-medium">{w.name}</div>
                      {w.url && (
                        <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          {w.url}
                        </a>
                      )}
                      {w.client_name && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>{w.client_name}</div>
                          {customerHrefByClientName(w.client_name, clientEmailMap) ? (
                            <Link
                              to={customerHrefByClientName(w.client_name, clientEmailMap)!}
                              className="text-primary hover:underline"
                              title="Zhoda podľa mena klienta v pipeline"
                            >
                              Zákazník 360°
                            </Link>
                          ) : null}
                        </div>
                      )}
                      {w.rental_start_date && (
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                          <CalendarDays className="w-3 h-3" />
                          od {new Date(w.rental_start_date).toLocaleDateString("sk-SK")}
                        </div>
                      )}
                      {(w.implementers || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {w.implementers.map((imp, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 border-primary/30 text-primary">
                              {imp.name} {imp.percentage}%
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {w.source ? (
                        <Badge variant="outline" className="font-normal">{w.source}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{Number(w.monthly_price).toFixed(0)}€</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="font-mono text-sm">{credits}</div>
                      <div className="text-[10px] text-purple-500">−{creditCost.toFixed(2)}€</div>
                    </TableCell>
                    {MONTHS.map((_, i) => {
                      const month = i + 1;
                      const p = paymentMap.get(`${w.id}-${year}-${month}`);
                      const st: PaymentStatus = (p?.status as PaymentStatus) || "none";
                      const hasCustom = p?.custom_price != null;
                      const price = monthPrice(w, month);
                      return (
                        <TableCell key={i} className="text-center px-1">
                          <button
                            onClick={() => cyclePayment(w, month)}
                            className={`w-9 h-9 rounded-md border flex items-center justify-center transition-colors mx-auto relative ${statusStyle(st)}`}
                            title={`${MONTHS[i]} · ${price}€${hasCustom ? " (vlastná cena)" : ""}`}
                          >
                            {statusIcon(st, month)}
                            {hasCustom && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary border border-background" />
                            )}
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <Badge className="bg-green-500/15 text-green-500 border-green-500/30">{stats.paid.toFixed(0)}€</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30">{stats.invoiced.toFixed(0)}€</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-red-500/15 text-red-500 border-red-500/30">{stats.unpaid.toFixed(0)}€</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openPrices(w)} title="Vlastné ceny po mesiacoch">
                          <Euro className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(w)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Zmazať prenájom"
                          onClick={() =>
                            void requestDelete({
                              entityType: "rental_website",
                              entityId: w.id,
                              entityLabel: w.name,
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      <AdminDialog
        open={!!editing}
        onOpenChange={(o) => !o && requestCloseWebsiteDialog()}
        size="2xl"
        stickyFooter
        title={editing?.id ? "Upraviť web" : "Pridať web"}
        footer={
          <>
            <Button variant="outline" onClick={requestCloseWebsiteDialog}>Zrušiť</Button>
            <Button onClick={saveWebsite}>Uložiť</Button>
          </>
        }
      >
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Názov webu *</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">URL</label>
                  <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Klient</label>
                  <ClientPicker
                    clientName={editing.client_name ?? ""}
                    customerEmail={editing.customer_email}
                    customerId={editing.customer_id}
                    onChange={({ client_name, customer_id, customer_email }) =>
                      setEditing({ ...editing, client_name, customer_id, customer_email })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Zdroj</label>
                  <Input value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })} placeholder="napr. Facebook..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Mesačná cena (€)</label>
                  <Input type="number" value={editing.monthly_price} onChange={(e) => setEditing({ ...editing, monthly_price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Rok</label>
                  <Input type="number" value={editing.year} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Dátum začiatku nájmu
                  </label>
                  <Input
                    type="date"
                    value={editing.rental_start_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, rental_start_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> Použité kredity
                  </label>
                  <Input
                    type="number"
                    value={editing.credits_used}
                    onChange={(e) => setEditing({ ...editing, credits_used: Number(e.target.value) })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    100 kreditov = 30€ · náklad: <strong>{((Number(editing.credits_used) || 0) * CREDIT_COST).toFixed(2)}€</strong> (zapíše sa do Nákladov)
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Poznámka</label>
                <Textarea rows={4} value={editing.note ?? ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              </div>

              {/* Implementers / commissions */}
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" /> Realizátori a podiel %
                  </label>
                  {(editing.implementers?.length || 0) < 3 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          implementers: [...(editing.implementers || []), { name: "", percentage: 0 }],
                        })
                      }
                    >
                      <Plus className="w-3 h-3 mr-1" /> Pridať
                    </Button>
                  )}
                </div>
                {(editing.implementers || []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Pridaj 1–3 realizátorov a ich % podiel — z toho sa počíta provízia (ročný potenciál a vyplatené).
                  </p>
                )}
                {(editing.implementers || []).map((imp, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_90px_36px] gap-2 items-center">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={imp.name}
                      onChange={(e) => {
                        const arr = [...editing.implementers];
                        arr[idx] = { ...arr[idx], name: e.target.value };
                        setEditing({ ...editing, implementers: arr });
                      }}
                    >
                      <option value="">— vyber meno —</option>
                      {ASSIGNEES.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={imp.percentage}
                      onChange={(e) => {
                        const arr = [...editing.implementers];
                        arr[idx] = { ...arr[idx], percentage: Number(e.target.value) };
                        setEditing({ ...editing, implementers: arr });
                      }}
                      placeholder="%"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          implementers: editing.implementers.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {(editing.implementers || []).length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Súčet podielov: <strong>{(editing.implementers || []).reduce((s, i) => s + (Number(i.percentage) || 0), 0)}%</strong>
                  </p>
                )}
              </div>
            </div>
          )}
      </AdminDialog>

      {/* Per-month custom prices */}
      <AdminDialog
        open={!!pricesOpen}
        onOpenChange={(o) => !o && setPricesOpen(null)}
        size="lg"
        title={
          <>
            Vlastné ceny po mesiacoch — {pricesOpen?.name} ({year})
          </>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPricesOpen(null)}>Zrušiť</Button>
            <Button onClick={savePrices}>Uložiť ceny</Button>
          </>
        }
      >
          <p className="text-xs text-muted-foreground -mt-2">
            Nechaj prázdne pre fixnú cenu {pricesOpen?.monthly_price}€. Zadaná hodnota prepíše cenu len pre daný mesiac.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {MONTHS.map((m, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-muted-foreground">{m}</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={String(pricesOpen?.monthly_price ?? "")}
                  value={pricesDraft[i + 1] ?? ""}
                  onChange={(e) =>
                    setPricesDraft((d) => ({ ...d, [i + 1]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
      </AdminDialog>

      <FactConfirmDialog
        open={paymentFactOpen}
        onOpenChange={setPaymentFactOpen}
        draft={paymentFactDraft}
        mode="workflow"
        onSaved={() => {
          toast({ title: "Payment fact vytvorený", description: "Workflow status zostáva nezmenený." });
        }}
      />

      {detailImplementer && (
        <ImplementerCommissionDetailDialog
          open={!!detailImplementer}
          onOpenChange={(o) => !o && setDetailImplementer(null)}
          implementerName={detailImplementer}
          year={year}
          websites={websites}
          commissions={commissions}
          clientEmailMap={clientEmailMap}
          yearStats={yearStats}
          onSaved={() => void loadAll()}
        />
      )}

      <DestructiveModal {...modalProps} />
    </AdminShell>
  );
}
