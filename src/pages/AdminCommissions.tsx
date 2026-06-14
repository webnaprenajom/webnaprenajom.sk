import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  COMMISSION_STATUS_LABELS,
  EXPENSE_STATUS_LABELS,
  FINANCE_TRUTH_DISCLAIMER,
} from "@/lib/finance/labels";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import { type FactDraft, prefillFromCommission, prefillFromExpense } from "@/lib/finance/factDrafts";
import { PAYMENT_FORM_OPTIONS, type PaymentFormValue } from "@/lib/paymentForm";
import { assigneeSelectOptions, isKnownAssignee } from "@/lib/assignees";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { EntitySearchPicker } from "@/components/admin/lookup/EntitySearchPicker";
import {
  COMMISSION_SOURCE_LABELS,
  type CommissionSourceType,
  getCommissionLinkStatus,
  resolveCommissionSourceLabel,
  sanitizeCommissionSourceFields,
  sourceDetailHref,
  validateCommissionSourceFields,
} from "@/lib/commissionSource";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import type { LookupResult } from "@/lib/crmLookup/types";
import { Link } from "react-router-dom";
import { CommissionLinkBadge } from "@/components/admin/lookup/LinkStatusBadge";
import { useAccessContext } from "@/hooks/useAccessContext";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import {
  resolveCommissionPayoutInfo,
  summarizeCommissionPayoutTotals,
  COMMISSION_PAYOUT_STATUS_LABELS,
  type PayoutRecordLike,
} from "@/lib/finance/commissionPayoutStatus";
import {
  Loader2,
  Wallet,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  Copy,
} from "lucide-react";

type PaymentStatus = "paid" | "unpaid";

interface Commission {
  id: string;
  date: string;
  title: string;
  implementer: string;
  amount: number;
  payment_status: PaymentStatus;
  note: string | null;
  payment_form: string | null;
  source_type: CommissionSourceType | null;
  source_id: string | null;
  customer_email: string | null;
  customer_id: string | null;
  created_at: string;
}

interface Expense {
  id: string;
  date: string;
  title: string;
  category: string | null;
  amount: number;
  payment_status: PaymentStatus;
  note: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: COMMISSION_STATUS_LABELS.paid, className: "bg-green-500/15 text-green-500 border-green-500/30" },
  unpaid: { label: COMMISSION_STATUS_LABELS.unpaid, className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyCommission = () => ({
  id: "",
  date: todayISO(),
  title: "",
  implementer: "",
  amount: "",
  payment_status: "unpaid" as PaymentStatus,
  note: "",
  payment_form: "" as PaymentFormValue | "",
  source_type: "" as CommissionSourceType | "",
  source_id: "",
  customer_email: "",
  customer_id: "",
  sourceSelection: null as LookupResult | null,
});

const emptyExpense = () => ({
  id: "",
  date: todayISO(),
  title: "",
  category: "",
  amount: "",
  payment_status: "unpaid" as PaymentStatus,
  note: "",
});

export function CommissionsExpensesContent() {
  const access = useAccessContext();

  // Commissions
  const [items, setItems] = useState<Commission[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecordLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCommission());

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [expStatusFilter, setExpStatusFilter] = useState<string>("all");
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [savingExp, setSavingExp] = useState(false);
  const [expForm, setExpForm] = useState(emptyExpense());
  const [payoutFactDraft, setPayoutFactDraft] = useState<FactDraft | null>(null);
  const [payoutFactOpen, setPayoutFactOpen] = useState(false);
  const [costFactDraft, setCostFactDraft] = useState<FactDraft | null>(null);
  const [costFactOpen, setCostFactOpen] = useState(false);

  useEffect(() => {
    void load();
    void loadExpenses();
  }, []);

  const load = async () => {
    setLoading(true);
    const [commissionsRes, payoutRecordsRes] = await Promise.all([
      supabase
        .from("commissions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("payout_records")
        .select("source_table,source_id,amount,paid_at,truth_level")
        .eq("source_table", "commissions"),
    ]);
    if (commissionsRes.error) {
      toast({ title: "Chyba načítania", description: commissionsRes.error.message, variant: "destructive" });
    } else {
      setItems((commissionsRes.data || []) as Commission[]);
    }
    // payout_records sú zdroj pravdy pre "auditovaná výplata" (Fáza 5). Pri chybe sa provízie
    // stále zobrazia (payment_status funguje ako predtým), len bez audit badge — upozorníme.
    if (payoutRecordsRes.error) {
      toast({
        title: "Audit výplat sa nenačítal",
        description: `Stĺpec "Výplata" nemusí byť presný: ${payoutRecordsRes.error.message}`,
        variant: "destructive",
      });
      setPayoutRecords([]);
    } else {
      setPayoutRecords((payoutRecordsRes.data || []) as PayoutRecordLike[]);
    }
    setLoading(false);
  };

  const loadExpenses = async () => {
    setLoadingExp(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    else setExpenses((data || []) as Expense[]);
    setLoadingExp(false);
  };

  // ===== Commissions =====
  const openNew = () => { setForm(emptyCommission()); setDialogOpen(true); };
  const openEdit = (c: Commission) => {
    const sourceSelection: LookupResult | null =
      c.source_type && c.source_id && c.source_type !== "other"
        ? { kind: c.source_type as any, id: c.source_id, label: c.title }
        : null;
    setForm({
      id: c.id, date: c.date, title: c.title, implementer: c.implementer,
      amount: String(c.amount ?? ""), payment_status: c.payment_status, note: c.note ?? "",
      payment_form: (c.payment_form as PaymentFormValue) || "",
      source_type: (c.source_type as CommissionSourceType) || "",
      source_id: c.source_id || "",
      customer_email: c.customer_email || "",
      customer_id: c.customer_id || "",
      sourceSelection,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.implementer.trim()) {
      toast({ title: "Vyplň názov a implementátora", variant: "destructive" });
      return;
    }

    const validation = validateCommissionSourceFields(form.source_type, form.source_id);
    if (!validation.valid) {
      toast({ title: "Neplatné prepojenie", description: validation.error, variant: "destructive" });
      return;
    }
    if (validation.warning) {
      toast({ title: "Upozornenie", description: validation.warning });
    }

    const { source_type, source_id } = sanitizeCommissionSourceFields(form.source_type, form.source_id);
    const linked = await resolveCustomerLinkFields({
      customer_id: form.customer_id || null,
      customer_email: form.customer_email,
      client_name: form.title,
    });

    setSaving(true);
    const payload = {
      date: form.date || todayISO(),
      title: form.title.trim(),
      implementer: form.implementer.trim(),
      amount: parseFloat(form.amount.replace(",", ".")) || 0,
      payment_status: form.payment_status,
      note: form.note.trim() || null,
      payment_form: form.payment_form || null,
      source_type,
      source_id,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
    };
    const { data: saved, error } = form.id
      ? await supabase.from("commissions").update(payload).eq("id", form.id).select("id").maybeSingle()
      : await supabase.from("commissions").insert(payload).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" }); return; }
    const recordId = saved?.id ?? form.id;
    if (recordId && !form.id) {
      logEntityCommunicationEventSafe({
        kind: "commission",
        title: payload.title,
        body_preview: `${payload.amount.toFixed(2)} € · ${payload.payment_status === "paid" ? "vyplatené" : "nezaplatené"}`,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "commissions",
        source_id: recordId,
        idempotency_key: `commissions:${recordId}:created`,
        metadata: { payment_status: payload.payment_status, action: "created" },
      });
    }
    toast({ title: form.id ? "Provízia upravená" : "Provízia pridaná" });
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať túto províziu?")) return;
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); load(); }
  };

  const togglePaid = async (c: Commission) => {
    const next: PaymentStatus = c.payment_status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("commissions").update({ payment_status: next }).eq("id", c.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (next === "paid") {
      logEntityCommunicationEventSafe({
        kind: "payment",
        title: c.title,
        body_preview: `${Number(c.amount).toFixed(2)} € · vyplatené`,
        customer_id: (c as { customer_id?: string | null }).customer_id ?? null,
        customer_email: (c as { customer_email?: string | null }).customer_email ?? null,
        source_table: "commissions",
        source_id: c.id,
        idempotency_key: `commissions:${c.id}:paid`,
        metadata: { payment_status: "paid", action: "paid" },
      });
    }
    load();
    if (next === "paid") {
      const { data: linked } = await supabase
        .from("payout_records")
        .select("id")
        .eq("source_table", "commissions")
        .eq("source_id", c.id)
        .maybeSingle();
      if (!linked) {
        const draft = prefillFromCommission(c, {
          commissions: [],
          expenses: [],
          websites: [],
          payments: [],
          paymentRecords: [],
          payoutRecords: [],
          costRecords: [],
        });
        if (draft) {
          setPayoutFactDraft(draft);
          setPayoutFactOpen(true);
        }
      }
    }
  };

  // ===== Expenses =====
  const openNewExp = () => { setExpForm(emptyExpense()); setExpDialogOpen(true); };
  const openEditExp = (e: Expense) => {
    setExpForm({
      id: e.id, date: e.date, title: e.title, category: e.category ?? "",
      amount: String(e.amount ?? ""), payment_status: e.payment_status, note: e.note ?? "",
    });
    setExpDialogOpen(true);
  };

  const saveExp = async () => {
    if (!expForm.title.trim()) {
      toast({ title: "Vyplň názov nákladu", variant: "destructive" });
      return;
    }
    setSavingExp(true);
    const payload = {
      date: expForm.date || todayISO(),
      title: expForm.title.trim(),
      category: expForm.category.trim() || null,
      amount: parseFloat(expForm.amount.replace(",", ".")) || 0,
      payment_status: expForm.payment_status,
      note: expForm.note.trim() || null,
    };
    const { error } = expForm.id
      ? await supabase.from("expenses").update(payload).eq("id", expForm.id)
      : await supabase.from("expenses").insert(payload);
    setSavingExp(false);
    if (error) { toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" }); return; }
    toast({ title: expForm.id ? "Náklad upravený" : "Náklad pridaný" });
    setExpDialogOpen(false);
    loadExpenses();
  };

  const removeExp = async (id: string) => {
    if (!confirm("Naozaj zmazať tento náklad?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); loadExpenses(); }
  };

  const duplicateExp = (e: Expense) => {
    setExpForm({
      id: "",
      date: todayISO(),
      title: e.title,
      category: e.category ?? "",
      amount: String(e.amount ?? ""),
      payment_status: "unpaid",
      note: e.note ?? "",
    });
    setExpDialogOpen(true);
  };

  const togglePaidExp = async (e: Expense) => {
    const next: PaymentStatus = e.payment_status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("expenses").update({ payment_status: next }).eq("id", e.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    loadExpenses();
    if (next === "paid") {
      const { data: linked } = await supabase
        .from("cost_records")
        .select("id")
        .eq("source_table", "expenses")
        .eq("source_id", e.id)
        .maybeSingle();
      if (!linked) {
        const draft = prefillFromExpense(e, {
          commissions: [],
          expenses: [],
          websites: [],
          payments: [],
          paymentRecords: [],
          payoutRecords: [],
          costRecords: [],
        });
        if (draft) {
          setCostFactDraft(draft);
          setCostFactOpen(true);
        }
      }
    }
  };

  const filtered = useMemo(
    () => items.filter((i) => statusFilter === "all" || i.payment_status === statusFilter),
    [items, statusFilter],
  );

  const filteredExp = useMemo(
    () => expenses.filter((e) => expStatusFilter === "all" || e.payment_status === expStatusFilter),
    [expenses, expStatusFilter],
  );

  const totals = useMemo(() => {
    const paid = items.filter((i) => i.payment_status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const unpaid = items.filter((i) => i.payment_status === "unpaid").reduce((s, i) => s + Number(i.amount || 0), 0);
    return { paid, unpaid, total: paid + unpaid };
  }, [items]);

  // Fáza 5: "paid vs not yet paid" bez miešania workflow stavu (commissions.payment_status)
  // a auditovaných výplat (payout_records).
  const payoutTotals = useMemo(() => summarizeCommissionPayoutTotals(items, payoutRecords), [items, payoutRecords]);

  const expTotals = useMemo(() => {
    const paid = expenses.filter((i) => i.payment_status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const unpaid = expenses.filter((i) => i.payment_status === "unpaid").reduce((s, i) => s + Number(i.amount || 0), 0);
    return { paid, unpaid, total: paid + unpaid };
  }, [expenses]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{FINANCE_TRUTH_DISCLAIMER}</p>
        <Tabs defaultValue="commissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="commissions"><Wallet className="w-4 h-4 mr-2" />Provízie</TabsTrigger>
            <TabsTrigger value="expenses"><Receipt className="w-4 h-4 mr-2" />Náklady</TabsTrigger>
          </TabsList>

          {/* COMMISSIONS TAB */}
          <TabsContent value="commissions" className="space-y-4">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Označ. vyplatené</div>
                <div className="text-2xl font-bold text-green-500">{totals.paid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Nevyplatené (interný)</div>
                <div className="text-2xl font-bold text-yellow-500">{totals.unpaid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Spolu</div>
                <div className="text-2xl font-bold">{totals.total.toFixed(2)} €</div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">Vyplatené (workflow) — neauditované</div>
                  <TruthLevelBadge level="workflow_only" />
                </div>
                <div className="text-2xl font-bold text-muted-foreground">{payoutTotals.paidWorkflowUnaudited.toFixed(2)} €</div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Označené ako vyplatené, ale bez záznamu v payout_records — interný stav, nie audit.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">Auditované výplaty (payout_records)</div>
                  <TruthLevelBadge level="payout_fact" />
                </div>
                <div className="text-2xl font-bold text-green-500">{payoutTotals.auditedTotal.toFixed(2)} €</div>
                <p className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                  <span>z toho:</span>
                  <span className="inline-flex items-center gap-1"><TruthLevelBadge level="payout_fact" />{payoutTotals.auditedFact.toFixed(2)} €</span>
                  <span className="inline-flex items-center gap-1"><TruthLevelBadge level="legacy_import" />{payoutTotals.auditedLegacyImport.toFixed(2)} €</span>
                </p>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Stav" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky stavy</SelectItem>
                  <SelectItem value="unpaid">Nevyplatené (interný)</SelectItem>
                  <SelectItem value="paid">Označ. vyplatené</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-2" /> Nová provízia</Button>
            </section>

            <section className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">Žiadne provízie</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Dátum</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead>Zdroj</TableHead>
                        <TableHead>Implementátor</TableHead>
                        {access.isAdmin && <TableHead>Klient</TableHead>}
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>Výplata</TableHead>
                        <TableHead>Poznámka</TableHead>
                        <TableHead className="text-right">Akcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const cfg = STATUS_CONFIG[c.payment_status];
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                              {new Date(c.date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{resolveCommissionSourceLabel(c)}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-col gap-1 items-start">
                                <CommissionLinkBadge status={getCommissionLinkStatus(c)} />
                                {c.source_type && c.source_type !== "other" && sourceDetailHref(c.source_type, c.source_id) ? (
                                  <Link to={sourceDetailHref(c.source_type, c.source_id)!} className="text-primary hover:underline">
                                    {COMMISSION_SOURCE_LABELS[c.source_type as CommissionSourceType]}
                                  </Link>
                                ) : c.source_type === "other" ? (
                                  <span>{COMMISSION_SOURCE_LABELS.other}</span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{c.implementer}</TableCell>
                            {access.isAdmin && (
                              <TableCell className="text-xs whitespace-nowrap">
                                {c.customer_email ? (
                                  (() => {
                                    const href = adminCustomerHrefPreferred(c.customer_id, c.customer_email);
                                    return href ? (
                                      <Link to={href} className="text-primary hover:underline">{c.customer_email}</Link>
                                    ) : (
                                      <span>{c.customer_email}</span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-muted-foreground italic">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-right font-semibold whitespace-nowrap">{Number(c.amount || 0).toFixed(2)} €</TableCell>
                            <TableCell>
                              <button onClick={() => togglePaid(c)} title="Prepnúť stav">
                                <Badge variant="outline" className={`text-xs cursor-pointer ${cfg.className}`}>{cfg.label}</Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-xs">
                              {(() => {
                                const info = resolveCommissionPayoutInfo(c, payoutRecords);
                                if (info.status === "audited_payout_fact" || info.status === "audited_legacy_import") {
                                  return (
                                    <div className="flex flex-col gap-1 items-start">
                                      <TruthLevelBadge level={info.truthLevel!} />
                                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                        {info.auditedAmount.toFixed(2)} €
                                        {info.auditedPaidAt
                                          ? ` · ${new Date(info.auditedPaidAt).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}`
                                          : ""}
                                      </span>
                                    </div>
                                  );
                                }
                                if (info.status === "paid_workflow_unaudited") {
                                  return (
                                    <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground whitespace-nowrap">
                                      {COMMISSION_PAYOUT_STATUS_LABELS.paid_workflow_unaudited}
                                    </Badge>
                                  );
                                }
                                return <span className="text-muted-foreground">—</span>;
                              })()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                              <div className="line-clamp-2 break-words">{c.note || <span className="italic opacity-60">—</span>}</div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-4">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Označ. uhradené</div>
                <div className="text-2xl font-bold text-red-500">−{expTotals.paid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Neuhradené (interný)</div>
                <div className="text-2xl font-bold text-red-400">−{expTotals.unpaid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Spolu náklady</div>
                <div className="text-2xl font-bold text-red-500">−{expTotals.total.toFixed(2)} €</div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 justify-between">
              <Select value={expStatusFilter} onValueChange={setExpStatusFilter}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Stav" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky stavy</SelectItem>
                  <SelectItem value="unpaid">Neuhradené</SelectItem>
                  <SelectItem value="paid">Uhradené</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openNewExp} size="sm"><Plus className="w-4 h-4 mr-2" /> Nový náklad</Button>
            </section>

            <section className="rounded-xl border border-border bg-card overflow-hidden">
              {loadingExp ? (
                <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredExp.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">Žiadne náklady</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Dátum</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead>Kategória</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>Poznámka</TableHead>
                        <TableHead className="text-right">Akcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExp.map((e) => {
                        const cfg = STATUS_CONFIG[e.payment_status];
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                              {new Date(e.date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{e.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.category || <span className="italic opacity-60">—</span>}</TableCell>
                            <TableCell className="text-sm text-right font-semibold whitespace-nowrap text-red-500">−{Number(e.amount || 0).toFixed(2)} €</TableCell>
                            <TableCell>
                              <button onClick={() => togglePaidExp(e)} title="Prepnúť stav">
                                <Badge variant="outline" className={`text-xs cursor-pointer ${cfg.className}`}>
                                  {e.payment_status === "paid" ? EXPENSE_STATUS_LABELS.paid : EXPENSE_STATUS_LABELS.unpaid}
                                </Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                              <div className="line-clamp-2 break-words">{e.note || <span className="italic opacity-60">—</span>}</div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => openEditExp(e)} title="Upraviť"><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => duplicateExp(e)} title="Duplikovať"><Copy className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => removeExp(e.id)} title="Zmazať"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>

      {/* Commission dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {form.id ? "Upraviť províziu" : "Nová provízia"}
              <CommissionLinkBadge
                status={getCommissionLinkStatus({
                  source_type: form.source_type || null,
                  source_id: form.source_id || null,
                })}
              />
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dátum</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Názov</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="napr. Web pre klienta XY" />
            </div>
            {getCommissionLinkStatus({ source_type: form.source_type || null, source_id: form.source_id || null }) === "partial" && (
              <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                Neúplné prepojenie v databáze — vyberte entitu alebo zvoľte legacy režim pred uložením.
              </p>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Typ zdroja (voliteľné)</label>
              <Select
                value={form.source_type || "none"}
                onValueChange={(v) => {
                  const type = v === "none" ? "" : (v as CommissionSourceType);
                  setForm({
                    ...form,
                    source_type: type,
                    source_id: "",
                    sourceSelection: null,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="— legacy —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— legacy (bez prepojenia) —</SelectItem>
                  {(Object.keys(COMMISSION_SOURCE_LABELS) as CommissionSourceType[]).map((k) => (
                    <SelectItem key={k} value={k}>{COMMISSION_SOURCE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.source_type && form.source_type !== "other" && (
              <div>
                <label className="text-xs text-muted-foreground">
                  {COMMISSION_SOURCE_LABELS[form.source_type as CommissionSourceType]} *
                </label>
                <EntitySearchPicker
                  kind={form.source_type === "project" ? "project" : form.source_type === "rental" ? "rental" : "hosting"}
                  value={form.sourceSelection}
                  onSelect={(result) =>
                    setForm({
                      ...form,
                      sourceSelection: result,
                      source_id: result?.id ?? "",
                      customer_email: result?.email ?? form.customer_email,
                      customer_id: result?.kind === "customer" ? result.id : form.customer_id,
                      title: form.title || result?.label || form.title,
                    })
                  }
                />
                {!form.source_id && (
                  <p className="text-[10px] text-amber-600 mt-1">Vyberte záznam pre uloženie prepojenia.</p>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">E-mail klienta (voliteľné)</label>
              <Input
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                placeholder="pre Klient 360°"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Meno implementátora</label>
              <Select
                value={form.implementer || "__none__"}
                onValueChange={(v) => setForm({ ...form, implementer: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— vyber —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— vyber —</SelectItem>
                  {assigneeSelectOptions(form.implementer).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                      {!isKnownAssignee(name) ? " (legacy)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Stav vyplatenia</label>
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Nevyplatené (interný)</SelectItem>
                  <SelectItem value="paid">Označ. vyplatené</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Forma úhrady</label>
              <Select
                value={form.payment_form || "none"}
                onValueChange={(v) => setForm({ ...form, payment_form: v === "none" ? "" : (v as PaymentFormValue) })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PAYMENT_FORM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <NoteTextarea value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{expForm.id ? "Upraviť náklad" : "Nový náklad"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dátum</label>
                <Input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Názov</label>
              <Input value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="napr. Hosting, Resend, doména" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Kategória</label>
              <Input value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} placeholder="napr. Software, Marketing, Doména" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Stav</label>
              <Select value={expForm.payment_status} onValueChange={(v) => setExpForm({ ...expForm, payment_status: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Neuhradené</SelectItem>
                  <SelectItem value="paid">Uhradené</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <Textarea value={expForm.note} onChange={(e) => setExpForm({ ...expForm, note: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={saveExp} disabled={savingExp}>
              {savingExp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FactConfirmDialog
        open={payoutFactOpen}
        onOpenChange={setPayoutFactOpen}
        draft={payoutFactDraft}
        mode="workflow"
        onSaved={() => {
          toast({ title: "Payout fact vytvorený", description: "Workflow status zostáva nezmenený." });
        }}
      />

      <FactConfirmDialog
        open={costFactOpen}
        onOpenChange={setCostFactOpen}
        draft={costFactDraft}
        mode="workflow"
        onSaved={() => {
          toast({ title: "Cost fact vytvorený", description: "Workflow status zostáva nezmenený." });
        }}
      />
    </div>
  );
}
