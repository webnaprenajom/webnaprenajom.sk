/** governance:inline-queries — do not expand; extract loaders to src/lib/ in Plan Mode (GOVERNANCE.md). */
import { useEffect, useMemo, useState, useCallback, type ComponentProps } from "react";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import { resolveProfitDisplayContext } from "@/lib/profit/profitContext";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminLongTextField } from "@/components/admin/AdminLongTextField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { assertDeliveryHasCanonicalCustomer } from "@/lib/crmLookup/entitySaveHelpers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import { FINANCE_TRUTH_DISCLAIMER, RENTAL_MONTH_STATUS_LABELS } from "@/lib/finance/labels";
import { type PaymentFormValue } from "@/lib/paymentForm";
import {
  RENTAL_AI_CREDIT_EUR,
  syncRentalCreditsToFinance,
  syncRentalPaymentToFinance,
  unsyncRentalCreditsFromFinance,
  unsyncRentalPaymentFromFinance,
} from "@/lib/finance/syncFinanceFact";
import { ImplementerCommissionDetailDialog } from "@/components/admin/rentals/ImplementerCommissionDetailDialog";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { useAccessContext } from "@/hooks/useAccessContext";
import { useCrmDraft } from "@/hooks/useCrmDraft";
import { useCrmViewRestore } from "@/hooks/useCrmViewRestore";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { buildDraftKey, clearCrmDraft } from "@/lib/crmPersistence/draftStore";
import { clearCrmViewState } from "@/lib/crmPersistence/viewRestoreStore";
import { filterRentalsForUser } from "@/lib/rbac/scopeHelpers";
import { matchesSearchQuery } from "@/lib/searchMatch";
import { AdminListSearchInput } from "@/components/admin/AdminListSearchInput";
import { useImplementerRegistryOptions } from "@/hooks/useImplementerSelectOptions";
import {
  type RentalImplementer,
  normalizeRentalImplementers,
  rentalImplementerNameKey,
  serializeRentalImplementerForSave,
} from "@/lib/rentalImplementers";

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
  implementers: RentalImplementer[];
}

type PaymentStatus = "none" | "invoice" | "paid" | "unpaid";

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
const CREDIT_COST = RENTAL_AI_CREDIT_EUR;

const NEXT_STATUS: Record<PaymentStatus, PaymentStatus> = {
  none: "invoice",
  invoice: "paid",
  paid: "unpaid",
  unpaid: "none",
};

const PAYMENT_STATUS_RANK: Record<PaymentStatus, number> = {
  none: 0,
  invoice: 1,
  unpaid: 2,
  paid: 3,
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

type RentalFinanceCache = {
  websiteId: string;
  paymentRecords: Array<{ amount: number }>;
  costRecords: Array<{ amount: number }>;
};

function rentalProfitBannerProps(
  website: RentalWebsite,
  finance: RentalFinanceCache,
): ComponentProps<typeof EntityProfitBanner> | null {
  if (finance.websiteId !== website.id) return null;

  const revenue = finance.paymentRecords.reduce((s, p) => s + Number(p.amount || 0), 0);
  const operatingCost =
    finance.costRecords.reduce((s, c) => s + Number(c.amount || 0), 0) +
    (Number(website.credits_used) || 0) * CREDIT_COST;
  const revenueKnown =
    finance.paymentRecords.length > 0 &&
    website.monthly_price != null &&
    Number(website.monthly_price) > 0;

  const ctx = resolveProfitDisplayContext({
    entityKind: "hosting",
    revenueKnown,
    revenue,
    operatingCost,
    paymentRecordCount: finance.paymentRecords.length,
  });
  if (!ctx.canShowProfit) return null;

  return {
    entityKind: "hosting",
    revenue,
    operatingCost,
    revenueKnown,
    paymentRecordCount: finance.paymentRecords.length,
  };
}

const statusStyle = (st: PaymentStatus) => {
  switch (st) {
    case "invoice":
      return "bg-orange-500/20 border-orange-500/50 text-orange-500 hover:bg-orange-500/30";
    case "paid":
      return "bg-green-500/20 border-green-500/50 text-green-500 hover:bg-green-500/30";
    case "unpaid":
      return "bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30";
    default:
      return "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60";
  }
};

const statusIcon = (st: PaymentStatus, month: number) => {
  if (st === "invoice") return <FileText className="w-3.5 h-3.5" />;
  if (st === "paid") return <Check className="w-3.5 h-3.5" />;
  if (st === "unpaid") return <X className="w-3.5 h-3.5" />;
  return <span className="text-[10px] tabular-nums">{month}</span>;
};

function RentalMonthGrid({
  website,
  year,
  paymentMap,
  monthPrice,
  onCycle,
  compact = false,
}: {
  website: RentalWebsite;
  year: number;
  paymentMap: Map<string, RentalPayment>;
  monthPrice: (w: RentalWebsite, month: number) => number;
  onCycle: (w: RentalWebsite, month: number) => void;
  compact?: boolean;
}) {
  const btnClass = compact ? "w-7 h-7" : "w-8 h-8 sm:w-9 sm:h-9";
  return (
    <div className="grid grid-cols-6 gap-1 max-w-full" role="group" aria-label={`Platby ${year}`}>
      {MONTHS.map((label, i) => {
        const month = i + 1;
        const p = paymentMap.get(`${website.id}-${year}-${month}`);
        const st: PaymentStatus = (p?.status as PaymentStatus) || "none";
        const hasCustom = p?.custom_price != null;
        const price = monthPrice(website, month);
        return (
          <button
            key={month}
            type="button"
            onClick={() => onCycle(website, month)}
            className={`${btnClass} rounded-md border flex items-center justify-center transition-colors relative shrink-0 ${statusStyle(st)}`}
            title={`${label} · ${price}€${hasCustom ? " (vlastná cena)" : ""}`}
          >
            {statusIcon(st, month)}
            {hasCustom && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary border border-background" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function RentalIdentityBlock({
  website,
  clientEmailMap,
  isImplementerKnown,
}: {
  website: RentalWebsite;
  clientEmailMap: Map<string, string>;
  isImplementerKnown: (name: string) => boolean;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="font-medium truncate">{website.name}</div>
      {website.url && (
        <a
          href={website.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline break-all"
        >
          {website.url}
        </a>
      )}
      {website.client_name && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>{website.client_name}</div>
          {customerHrefByClientName(website.client_name, clientEmailMap) ? (
            <Link
              to={customerHrefByClientName(website.client_name, clientEmailMap)!}
              className="text-primary hover:underline"
              title="Zhoda podľa mena klienta v pipeline"
            >
              Zákazník 360°
            </Link>
          ) : null}
        </div>
      )}
      {website.rental_start_date && (
        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <CalendarDays className="w-3 h-3 shrink-0" />
          od {new Date(website.rental_start_date).toLocaleDateString("sk-SK")}
        </div>
      )}
      {(website.implementers || []).length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {website.implementers.map((imp, i) => (
            <Badge
              key={i}
              variant="outline"
              className={`text-[10px] ${
                isImplementerKnown(imp.name)
                  ? "bg-primary/5 border-primary/30 text-primary"
                  : "bg-orange-500/10 border-orange-500/40 text-orange-600"
              }`}
              title={
                isImplementerKnown(imp.name)
                  ? undefined
                  : "Meno nie je v registri realizátorov — zváž doplnenie v Nastaveniach"
              }
            >
              {imp.name} {imp.percentage}%
              {!isImplementerKnown(imp.name) ? " ⚠" : ""}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function RentalYearStatsBadges({ stats }: { stats: { paid: number; invoiced: number; unpaid: number } }) {
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-[10px]">
        {stats.paid.toFixed(0)}€
      </Badge>
      <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px]">
        {stats.invoiced.toFixed(0)}€
      </Badge>
      <Badge className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px]">
        {stats.unpaid.toFixed(0)}€
      </Badge>
    </div>
  );
}

function RentalRowActions({
  website,
  onPrices,
  onEdit,
  onDelete,
}: {
  website: RentalWebsite;
  onPrices: (w: RentalWebsite) => void;
  onEdit: (w: RentalWebsite) => void;
  onDelete: (w: RentalWebsite) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onPrices(website)} title="Vlastné ceny po mesiacoch">
        <Euro className="w-4 h-4 text-primary" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(website)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Zmazať prenájom"
        onClick={() => onDelete(website)}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}

export default function AdminRentals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [websites, setWebsites] = useState<RentalWebsite[]>([]);
  const [payments, setPayments] = useState<RentalPayment[]>([]);
  const [editing, setEditing] = useState<RentalWebsite | null>(null);
  const [editBaseline, setEditBaseline] = useState<RentalWebsite | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [pricesOpen, setPricesOpen] = useState<RentalWebsite | null>(null);
  const [pricesDraft, setPricesDraft] = useState<Record<number, string>>({});
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);
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
  const [payoutRecords, setPayoutRecords] = useState<Array<{
    id: string;
    source_table: string | null;
    source_id: string | null;
    amount: number | null;
    paid_at: string;
    truth_level: string | null;
    note: string | null;
    reference: string | null;
    implementer: string | null;
  }>>([]);
  const [detailImplementer, setDetailImplementer] = useState<string | null>(null);
  const [rentalFinance, setRentalFinance] = useState<RentalFinanceCache | null>(null);
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({
    onSuccess: () => void loadAll(),
  });
  const accessCtx = useAccessContext();
  const { optionsFor: implementerOptionsFor, isKnown: isImplementerKnown } = useImplementerRegistryOptions();

  const cloneRental = (w: RentalWebsite): RentalWebsite => JSON.parse(JSON.stringify(w));

  const openRentalEdit = useCallback((w: RentalWebsite) => {
    setCustomerFieldError(null);
    const clone = cloneRental(w);
    setEditBaseline(clone);
    setEditing(clone);
  }, []);

  const openNewRental = useCallback(() => {
    setCustomerFieldError(null);
    const blank = emptyWebsite();
    setEditBaseline(blank);
    setEditing(blank);
  }, []);

  const { discardDraft: discardRentalDraft, clearDraft: clearRentalDraft } = useCrmDraft({
    modalId: "rental-edit",
    route: "/admin/rentals",
    entityId: editing?.id ? editing.id : "new",
    isActive: !!editing,
    data: editing ?? editBaseline ?? emptyWebsite(),
    baseline: editBaseline,
    onRestore: (draft) => setEditing(draft as RentalWebsite),
  });

  const closeRentalEdit = useCallback(() => {
    if (editing) clearRentalDraft();
    clearCrmViewState();
    setCustomerFieldError(null);
    setEditing(null);
    setEditBaseline(null);
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [clearRentalDraft, editing, searchParams, setSearchParams]);

  const discardRentalChanges = useCallback(() => {
    discardRentalDraft();
    clearCrmViewState();
  }, [discardRentalDraft]);

  useCrmViewRestore({
    route: "/admin/rentals",
    modalId: "rental-edit",
    entityId: editing?.id || null,
    isModalOpen: !!editing,
    query: editing?.id ? { edit: editing.id } : undefined,
    enabled: !loading,
    onRestore: (state) => {
      if (editing || !state.modalId || state.modalId !== "rental-edit") return;
      if (state.entityId && state.entityId !== "new") {
        const w = websites.find((x) => x.id === state.entityId);
        if (w) openRentalEdit(w);
        else clearCrmViewState();
        return;
      }
      if (!state.entityId || state.entityId === "new") openNewRental();
    },
  });

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || websites.length === 0) return;
    if (editing?.id === editId) return;
    const w = websites.find((x) => x.id === editId);
    if (w) {
      openRentalEdit(w);
      return;
    }
    clearCrmDraft(buildDraftKey("rental-edit", editId));
    clearCrmViewState();
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }, [searchParams, websites, editing?.id, openRentalEdit, setSearchParams]);

  useEffect(() => {
    if (!editing?.id) return;
    const next = new URLSearchParams(searchParams);
    if (next.get("edit") === editing.id) return;
    next.set("edit", editing.id);
    setSearchParams(next, { replace: true });
  }, [editing?.id, searchParams, setSearchParams]);

  const financeTargetId = editing?.id ?? pricesOpen?.id ?? null;

  useEffect(() => {
    if (accessCtx.authChecking) return;
    void loadAll().finally(() => setLoading(false));
  }, [accessCtx.authChecking, accessCtx.role]);

  useEffect(() => {
    if (!financeTargetId) {
      setRentalFinance(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [payRes, costRes] = await Promise.all([
        supabase.from("payment_records").select("amount").eq("rental_website_id", financeTargetId),
        supabase.from("cost_records").select("amount").eq("rental_website_id", financeTargetId),
      ]);
      if (cancelled) return;
      if (payRes.error || costRes.error) {
        const msg = [payRes.error?.message, costRes.error?.message].filter(Boolean).join("; ");
        toast({
          title: "Chyba načítania financií prenájmu",
          description: msg,
          variant: "destructive",
        });
      }
      setRentalFinance({
        websiteId: financeTargetId,
        paymentRecords: (payRes.error ? [] : payRes.data ?? []) as Array<{ amount: number }>,
        costRecords: (costRes.error ? [] : costRes.data ?? []) as Array<{ amount: number }>,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [financeTargetId]);

  const loadAll = async () => {
    const [w, p, leadsRes, commRes, payoutRes] = await Promise.all([
      supabase.from("rental_websites").select("*").order("created_at", { ascending: false }),
      supabase.from("rental_payments").select("*"),
      supabase.from("leads").select("name,email"),
      supabase.from("commissions").select("id,title,date,amount,payment_status,note,payment_form,implementer,source_type,source_id,customer_email"),
      supabase.from("payout_records").select("id,source_table,source_id,amount,paid_at,truth_level,note,reference,implementer").order("paid_at", { ascending: false }),
    ]);
    if (w.error) {
      toast({
        title: "Chyba načítania prenájmov",
        description: w.error.message,
        variant: "destructive",
      });
    } else if (w.data) {
      const raw = (w.data as any[]).map((r) => ({
        ...r,
        implementers: normalizeRentalImplementers(r?.implementers),
      })) as RentalWebsite[];
      setWebsites(filterRentalsForUser(raw, accessCtx));
    }
    if (p.error) {
      toast({
        title: "Chyba načítania platieb prenájmov",
        description: p.error.message,
        variant: "destructive",
      });
    } else if (p.data) {
      setPayments(p.data as RentalPayment[]);
    }
    if (leadsRes.error) {
      toast({
        title: "Chyba načítania leadov",
        description: leadsRes.error.message,
        variant: "destructive",
      });
    } else if (leadsRes.data) {
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
    if (!payoutRes.error && payoutRes.data) {
      setPayoutRecords(payoutRes.data as typeof payoutRecords);
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

  const saveWebsite = async (): Promise<boolean> => {
    if (!editing) return true;
    if (!editing.name.trim()) {
      toast({ title: "Zadaj názov webu", variant: "destructive" });
      return false;
    }
    const cleanImplementers = (editing.implementers || [])
      .map((i) => serializeRentalImplementerForSave(i))
      .filter((i) => i.name);
    const linked = await resolveCustomerLinkFields({
      customer_id: editing.customer_id,
      customer_email: editing.customer_email,
      client_name: editing.client_name,
      manual_link: !!editing.customer_id,
      createIfMissing: true,
      allowReviewCreate: true,
    });

    const customerGuard = assertDeliveryHasCanonicalCustomer(linked);
    if (!customerGuard.ok) {
      setCustomerFieldError(customerGuard.message);
      toast({ title: customerGuard.message, variant: "destructive" });
      return false;
    }
    setCustomerFieldError(null);

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
      ? await supabase.from("rental_websites").insert(payload).select("id").maybeSingle()
      : await supabase.from("rental_websites").update(payload).eq("id", editing.id!).select("id").maybeSingle();
    if (res.error) {
      toast({ title: "Chyba", description: res.error.message, variant: "destructive" });
      return false;
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
      const { data: existingExp } = await supabase
        .from("expenses")
        .select("id")
        .eq("note", expenseNote)
        .maybeSingle();
      if (existingExp?.id) {
        await supabase.from("expenses").update({
          amount: expenseAmount,
          title: expenseTitle,
          category: "AI kredity",
        }).eq("id", existingExp.id);
      } else {
        await supabase.from("expenses").insert({
          title: expenseTitle,
          amount: expenseAmount,
          category: "AI kredity",
          note: expenseNote,
          payment_status: "paid",
          date: new Date().toISOString().slice(0, 10),
        });
      }
    }

    if (recordId) {
      const websiteForSync = {
        id: recordId,
        name: editing.name,
        client_name: linked.client_name,
        customer_email: linked.customer_email,
      };
      const yearForSync = Number(editing.year) || new Date().getFullYear();
      if (credits > 0) {
        const sync = await syncRentalCreditsToFinance(websiteForSync, yearForSync, credits);
        if (!sync.ok) {
          toast({
            title: "Web uložený, sync nákladov do Financií zlyhal",
            description: sync.error,
            variant: "destructive",
          });
        }
      } else {
        const reverse = await unsyncRentalCreditsFromFinance(recordId, yearForSync);
        if (!reverse.ok) {
          toast({
            title: "Web uložený, sync nákladov do Financií zlyhal",
            description: reverse.error,
            variant: "destructive",
          });
        }
      }
    }

    toast({ title: editing.id ? "Aktualizované" : "Pridané" });
    discardRentalDraft();
    clearCrmViewState();
    closeRentalEdit();
    await loadAll();
    return true;
  };

  const rentalCloseGuard = useAdminCloseGuard({
    isOpen: !!editing,
    current: editing ?? emptyWebsite(),
    onSave: saveWebsite,
    onDiscard: discardRentalChanges,
  });

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
      const { error } = await supabase
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
      const { error } = await supabase.from("rental_payments").insert({
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

    const { data: paymentRow, error: fetchError } = await supabase
      .from("rental_payments")
      .select("*")
      .eq("website_id", website.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (fetchError) {
      toast({ title: "Chyba", description: fetchError.message, variant: "destructive" });
      await loadAll();
      return;
    }

    if (paymentRow) {
      if (next === "paid") {
        const sync = await syncRentalPaymentToFinance(paymentRow, website);
        if (!sync.ok) {
          toast({
            title: "Mesiac uložený, sync do Financií zlyhal",
            description: sync.error,
            variant: "destructive",
          });
        }
      } else if (current === "paid" && next !== "paid") {
        const reverse = await unsyncRentalPaymentFromFinance(paymentRow.id);
        if (!reverse.ok) {
          toast({
            title: "Mesiac uložený, sync do Financií zlyhal",
            description: reverse.error,
            variant: "destructive",
          });
        }
      }
    }

    await loadAll();
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
        await supabase
          .from("rental_payments")
          .update({
            custom_price: value,
            // if status untouched and we have a custom price, keep amount in sync
            amount: value != null ? value : Number(w.monthly_price),
          })
          .eq("id", existing.id);
      } else if (value != null) {
        await supabase.from("rental_payments").insert({
          website_id: w.id,
          year,
          month: m,
          amount: value,
          custom_price: value,
          status: "none",
        });
      }
    }
    const { data: paymentRows, error: fetchError } = await supabase
      .from("rental_payments")
      .select("*")
      .eq("website_id", w.id)
      .eq("year", year);

    if (fetchError) {
      toast({ title: "Chyba", description: fetchError.message, variant: "destructive" });
    } else {
      for (const paymentRow of paymentRows ?? []) {
        if (paymentRow.status !== "paid") continue;
        const sync = await syncRentalPaymentToFinance(paymentRow, w);
        if (!sync.ok) {
          toast({
            title: "Mesiac uložený, sync do Financií zlyhal",
            description: sync.error,
            variant: "destructive",
          });
        }
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
    const map = new Map<string, { paid: number; potential: number; projects: number; displayName: string }>();
    websites.forEach((w) => {
      const s = yearStats(w);
      (w.implementers || []).forEach((imp) => {
        const pct = Number(imp.percentage) || 0;
        if (!imp.name || pct <= 0) return;
        const key = rentalImplementerNameKey(imp.name);
        const cur = map.get(key) || { paid: 0, potential: 0, projects: 0, displayName: imp.name };
        cur.paid += (s.paid * pct) / 100;
        cur.potential += (s.potential * pct) / 100;
        cur.projects += 1;
        map.set(key, cur);
      });
    });
    return Array.from(map.values())
      .map((v) => ({ name: v.displayName, paid: v.paid, potential: v.potential, projects: v.projects }))
      .sort((a, b) => b.potential - a.potential);
  }, [websites, payments, year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const filteredWebsites = useMemo(() => {
    if (!searchQuery.trim()) return websites;
    return websites.filter((w) =>
      matchesSearchQuery(
        searchQuery,
        w.name,
        w.url,
        w.client_name,
        w.source,
        w.note,
        ...(w.implementers || []).map((i) => i.name),
      ),
    );
  }, [websites, searchQuery]);

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
          <Button onClick={openNewRental} size="sm">
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
      <div className="space-y-6 min-w-0">
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
                    <div className="font-semibold">
                      {s.name}
                      {!isImplementerKnown(s.name) ? (
                        <span className="ml-1 text-[10px] font-normal text-orange-600" title="Meno nie je v registri realizátorov">
                          (mimo registra)
                        </span>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.projects} projekt(ov)</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Vyplatené (uhradené)</div>
                      <div className="font-bold text-green-500">{fmtEur(s.paid)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Potenciál ročne</div>
                      <div className="font-bold text-primary">{fmtEur(s.potential)}</div>
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

        <AdminListSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Hľadať web, klienta, URL, realizátora…"
        />

        {websites.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm rounded-lg border border-dashed border-border">
            Žiadne weby. Pridaj prvý.
          </p>
        )}
        {websites.length > 0 && filteredWebsites.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm rounded-lg border border-dashed border-border">
            Žiadna zhoda pre vyhľadávanie.
          </p>
        )}

        {filteredWebsites.length > 0 && (
          <>
            <div className="space-y-3 md:hidden min-w-0">
              {filteredWebsites.map((w) => {
                const stats = yearStats(w);
                const credits = Number(w.credits_used) || 0;
                const creditCost = credits * CREDIT_COST;
                return (
                  <article key={w.id} className="rounded-xl border border-border bg-card p-3 space-y-3 min-w-0">
                    <RentalIdentityBlock
                      website={w}
                      clientEmailMap={clientEmailMap}
                      isImplementerKnown={isImplementerKnown}
                    />
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {w.source ? <Badge variant="outline">{w.source}</Badge> : null}
                      <span className="font-mono">{Number(w.monthly_price).toFixed(0)}€/mes</span>
                      <span>
                        Kredity {credits} (−{fmtEur(creditCost)})
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Platby {year}
                      </p>
                      <RentalMonthGrid
                        website={w}
                        year={year}
                        paymentMap={paymentMap}
                        monthPrice={monthPrice}
                        onCycle={cyclePayment}
                        compact
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <RentalYearStatsBadges stats={stats} />
                      <RentalRowActions
                        website={w}
                        onPrices={openPrices}
                        onEdit={openRentalEdit}
                        onDelete={(site) =>
                          void requestDelete({
                            entityType: "rental_website",
                            entityId: site.id,
                            entityLabel: site.name,
                          })
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block rounded-lg border border-border bg-card min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-0 w-[28%]">Web / Klient</TableHead>
                    <TableHead className="hidden lg:table-cell w-[10%]">Zdroj</TableHead>
                    <TableHead className="whitespace-nowrap w-[7%]">Cena</TableHead>
                    <TableHead className="text-right whitespace-nowrap w-[8%]">Kredity</TableHead>
                    <TableHead className="w-[11rem] max-w-[11rem]">Platby {year}</TableHead>
                    <TableHead className="text-right w-[9%]">Súhrn</TableHead>
                    <TableHead className="text-right w-[7rem]">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWebsites.map((w) => {
                    const stats = yearStats(w);
                    const credits = Number(w.credits_used) || 0;
                    const creditCost = credits * CREDIT_COST;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="min-w-0 align-top">
                          <RentalIdentityBlock
                            website={w}
                            clientEmailMap={clientEmailMap}
                            isImplementerKnown={isImplementerKnown}
                          />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell align-top">
                          {w.source ? (
                            <Badge variant="outline" className="font-normal">
                              {w.source}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm align-top whitespace-nowrap">
                          {Number(w.monthly_price).toFixed(0)}€
                        </TableCell>
                        <TableCell className="text-right align-top whitespace-nowrap">
                          <div className="font-mono text-sm">{credits}</div>
                          <div className="text-[10px] text-purple-500">−{fmtEur(creditCost)}</div>
                        </TableCell>
                        <TableCell className="align-top p-2">
                          <RentalMonthGrid
                            website={w}
                            year={year}
                            paymentMap={paymentMap}
                            monthPrice={monthPrice}
                            onCycle={cyclePayment}
                          />
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <RentalYearStatsBadges stats={stats} />
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <RentalRowActions
                            website={w}
                            onPrices={openPrices}
                            onEdit={openRentalEdit}
                            onDelete={(site) =>
                              void requestDelete({
                                entityType: "rental_website",
                                entityId: site.id,
                                entityLabel: site.name,
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
      )}

      {rentalCloseGuard.closeGuardDialog}

      <AdminDialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) rentalCloseGuard.handleOpenChange(o, closeRentalEdit);
        }}
        size="lg"
        stickyFooter
        title={editing?.id ? "Upraviť web" : "Pridať web"}
        footer={
          editing ? (
            <>
              <Button variant="outline" onClick={() => rentalCloseGuard.requestClose(closeRentalEdit)}>
                Zrušiť
              </Button>
              <Button onClick={() => void saveWebsite()}>Uložiť</Button>
            </>
          ) : undefined
        }
      >
          {editing && (
            <div className="space-y-3">
              {editing.id &&
                rentalFinance &&
                (() => {
                  const bannerProps = rentalProfitBannerProps(editing, rentalFinance);
                  return bannerProps ? <EntityProfitBanner {...bannerProps} /> : null;
                })()}
              <div>
                <label className="text-sm font-medium">Názov webu *</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">URL</label>
                <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Klient</label>
                  <ClientPicker
                    clientName={editing.client_name ?? ""}
                    customerEmail={editing.customer_email}
                    customerId={editing.customer_id}
                    onChange={({ client_name, customer_id, customer_email }) => {
                      setCustomerFieldError(null);
                      setEditing({ ...editing, client_name, customer_id, customer_email });
                    }}
                  />
                  {customerFieldError && (
                    <p className="text-destructive text-xs mt-1">{customerFieldError}</p>
                  )}
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
                    100 kreditov = 30€ · náklad: <strong>{fmtEur(((Number(editing.credits_used) || 0) * CREDIT_COST))}</strong> (zapíše sa do Nákladov)
                  </p>
                </div>
              </div>
              <AdminLongTextField
                label="Poznámka"
                value={editing.note ?? ""}
                onChange={(note) => setEditing({ ...editing, note })}
                withDatePrefix={false}
              />

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
                      {implementerOptionsFor(imp.name).map((name) => (
                        <option key={name} value={name}>
                          {name}
                          {!isImplementerKnown(name) ? " (legacy)" : ""}
                        </option>
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
      <Dialog open={!!pricesOpen} onOpenChange={(o) => !o && setPricesOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Vlastné ceny po mesiacoch — {pricesOpen?.name} ({year})
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Nechaj prázdne pre fixnú cenu {pricesOpen?.monthly_price}€. Zadaná hodnota prepíše cenu len pre daný mesiac.
          </p>
          {pricesOpen &&
            rentalFinance &&
            (() => {
              const bannerProps = rentalProfitBannerProps(pricesOpen, rentalFinance);
              return bannerProps ? <EntityProfitBanner {...bannerProps} /> : null;
            })()}
          <div className="grid grid-cols-3 gap-3 mt-2">
            {MONTHS.map((m, i) => (
              <div key={i}>
                <label className="text-xs font-medium text-muted-foreground">{m}</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder={String(pricesOpen?.monthly_price ?? "")}
                  value={pricesDraft[i + 1] ?? ""}
                  onChange={(e) =>
                    setPricesDraft((d) => ({ ...d, [i + 1]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricesOpen(null)}>Zrušiť</Button>
            <Button onClick={savePrices}>Uložiť ceny</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailImplementer && (
        <ImplementerCommissionDetailDialog
          open={!!detailImplementer}
          onOpenChange={(o) => !o && setDetailImplementer(null)}
          implementerName={detailImplementer}
          year={year}
          websites={websites}
          commissions={commissions}
          payoutRecords={payoutRecords}
          clientEmailMap={clientEmailMap}
          yearStats={yearStats}
          onSaved={() => void loadAll()}
        />
      )}

      <DestructiveModal {...modalProps} />
    </AdminShell>
  );
}
