import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  COMMISSION_SOURCE_LABELS,
  type CommissionSourceType,
  type CommissionRow,
  resolveCommissionSourceLabel,
  sourceDetailHref,
} from "@/lib/commissionSource";
import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";
import { paymentFormLabel } from "@/lib/paymentForm";
import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import {
  CommissionFormFields,
  type CommissionFormState,
} from "@/components/admin/commissions/CommissionFormFields";
import type { PaymentFormValue } from "@/lib/paymentForm";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { useAccessContext } from "@/hooks/useAccessContext";
import { useHistoricalIdentity } from "@/hooks/useHistoricalIdentity";
import { formatImplementerLabel } from "@/lib/identity/historicalIdentity";
import { filterCommissionsForUser } from "@/lib/rbac/permissions";
import { canWriteCommissions, canToggleCommissionPaymentStatus, commissionPaymentStatusDeniedMessage, writeDeniedMessage } from "@/lib/rbac/writePermissions";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import type { FactDraft } from "@/lib/finance/factDrafts";
import { resolveCommissionPayoutBridgeAfterMarkPaid } from "@/lib/finance/commissionPayoutBridge";
import {
  resolveCommissionPayoutInfo,
  COMMISSION_PAYOUT_STATUS_LABELS,
  type PayoutRecordLike,
} from "@/lib/finance/commissionPayoutStatus";
import {
  validateCommissionPaidPayoutDetails,
  commissionPaidPayoutDbErrorMessage,
} from "@/lib/commissionPayoutValidation";
import {
  formatCommissionAmountHint,
  resolveCommissionPersistedAmount,
  type CommissionAmountMode,
} from "@/lib/commissionAmount";

const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-green-500/15 text-green-500 border-green-500/30",
  unpaid: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
};

interface Props {
  sourceType: CommissionSourceType;
  sourceId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  defaultTitle?: string;
  /** Revenue base for profit-aware commission context (hosting monthly / project payments). */
  revenueAmount?: number;
  operatingCost?: number;
  revenueKnown?: boolean;
  paymentRecordCount?: number;
  /** Batch 3: block new commission rows (e.g. task source). */
  disableCreate?: boolean;
  createDisabledHint?: string;
}

function emptyForm(defaultTitle?: string): CommissionFormState & { id: string } {
  return {
    id: "",
    date: todayISO(),
    title: defaultTitle || "",
    implementer: "",
    amount_mode: "fixed",
    amount: "",
    rate_percent: "",
    payment_status: "unpaid",
    payment_form: "",
    note: "",
  };
}

export function EntityCommissionsPanel({
  sourceType,
  sourceId,
  customerEmail,
  customerId,
  defaultTitle,
  revenueAmount,
  operatingCost = 0,
  revenueKnown = true,
  paymentRecordCount,
  disableCreate = false,
  createDisabledHint,
}: Props) {
  const access = useAccessContext();
  const { historicalIdentity } = useHistoricalIdentity();
  const canWrite = canWriteCommissions(access);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecordLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(defaultTitle));
  const [payoutFactDraft, setPayoutFactDraft] = useState<FactDraft | null>(null);
  const [payoutFactOpen, setPayoutFactOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .order("date", { ascending: false });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setRows([]);
      setPayoutRecords([]);
      setLoading(false);
      return;
    }
    const visibleRows = filterCommissionsForUser((data || []) as CommissionRow[], access);
    setRows(visibleRows);

    // Fáza 5: audit (payout_records) pre zobrazené provízie — pri chybe ticho [] (Stav stĺpec
    // funguje ako predtým, len bez "Výplata" badge).
    const ids = visibleRows.map((r) => r.id);
    if (ids.length === 0) {
      setPayoutRecords([]);
    } else {
      const { data: payoutData, error: payoutError } = await supabase
        .from("payout_records")
        .select("source_table,source_id,amount,paid_at,truth_level")
        .eq("source_table", "commissions")
        .in("source_id", ids);
      setPayoutRecords(payoutError ? [] : ((payoutData || []) as PayoutRecordLike[]));
    }
    setLoading(false);
  }, [sourceType, sourceId, access.role, access.implementerName]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm(defaultTitle));
    setDialogOpen(true);
  };

  const openEdit = (c: CommissionRow, patch?: Partial<CommissionFormState>) => {
    setForm({
      id: c.id,
      date: c.date,
      title: c.title,
      implementer: c.implementer,
      amount_mode: (c.amount_mode as CommissionAmountMode) || "fixed",
      amount: String(c.amount ?? ""),
      rate_percent: c.rate_percent != null ? String(c.rate_percent) : "",
      payment_status: c.payment_status as "paid" | "unpaid",
      payment_form: (c.payment_form as PaymentFormValue) || "",
      note: c.note ?? "",
      ...patch,
    });
    setDialogOpen(true);
  };

  const save = async (): Promise<boolean> => {
    if (!canWrite) {
      toast({ title: writeDeniedMessage("Úpravu provízií"), variant: "destructive" });
      return false;
    }
    if (!form.title.trim() || !form.implementer.trim()) {
      toast({ title: "Vyplň názov a realizátora", variant: "destructive" });
      return false;
    }

    const amountMode: CommissionAmountMode =
      sourceType === "project" && form.amount_mode === "percent" ? "percent" : "fixed";
    const resolvedAmount = resolveCommissionPersistedAmount({
      amount_mode: amountMode,
      amount: form.amount,
      rate_percent: form.rate_percent,
      revenue: revenueAmount ?? 0,
      operatingCost,
    });
    if (!resolvedAmount.ok) {
      toast({ title: "Neplatná provízia", description: resolvedAmount.error, variant: "destructive" });
      return false;
    }

    const paidValidation = validateCommissionPaidPayoutDetails({
      payment_status: form.payment_status,
      payment_form: form.payment_form,
      note: form.note,
      source_type: sourceType,
    });
    if (!paidValidation.valid) {
      toast({ title: "Chýbajú údaje výplaty", description: paidValidation.message, variant: "destructive" });
      return false;
    }

    setSaving(true);
    const linked = await resolveCustomerLinkFields({
      customer_id: customerId,
      customer_email: customerEmail,
      client_name: form.title,
    });
    const payload = {
      date: form.date || todayISO(),
      title: form.title.trim(),
      implementer: form.implementer.trim(),
      amount_mode: amountMode,
      rate_percent: resolvedAmount.rate_percent,
      amount: resolvedAmount.amount,
      payment_status: form.payment_status,
      payment_form: form.payment_form || null,
      note: form.note.trim() || null,
      source_type: sourceType,
      source_id: sourceId,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
    };
    const { data: saved, error } = form.id
      ? await supabase.from("commissions").update(payload).eq("id", form.id).select("id").maybeSingle()
      : await supabase.from("commissions").insert(payload).select("id").maybeSingle();
    setSaving(false);
    if (error) {
      const dbMsg = commissionPaidPayoutDbErrorMessage(error.message);
      toast({
        title: "Chyba uloženia",
        description: dbMsg ?? error.message,
        variant: "destructive",
      });
      return false;
    }
    const recordId = saved?.id ?? form.id;
    if (recordId && access.userId && form.payment_status) {
      void logAdminAuditEvent({
        actorUserId: access.userId,
        actionType: form.id ? AUDIT_ACTION_TYPES.commission_status_changed : AUDIT_ACTION_TYPES.commission_status_changed,
        targetType: "commission",
        targetId: recordId,
        summary: `Provízia ${payload.title}: ${payload.payment_status}`,
        after: { payment_status: payload.payment_status, amount: payload.amount, implementer: payload.implementer },
      });
    }
    if (recordId && !form.id) {
      logEntityCommunicationEventSafe({
        kind: "commission",
        title: payload.title,
        body_preview: `${fmtEur(payload.amount)} · ${payload.payment_status === "paid" ? "vyplatené" : "nezaplatené"}`,
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
    void load();
    return true;
  };

  const closeCommissionDialog = () => setDialogOpen(false);

  const commissionCloseGuard = useAdminCloseGuard({
    isOpen: dialogOpen,
    current: form,
    onSave: save,
    saving,
  });

  const togglePaymentStatus = async (c: CommissionRow) => {
    if (!canToggleCommissionPaymentStatus(access, c.implementer)) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    const next = c.payment_status === "paid" ? "unpaid" : "paid";
    if (next === "paid") {
      const paidValidation = validateCommissionPaidPayoutDetails({
        payment_status: "paid",
        payment_form: c.payment_form,
        note: c.note,
        source_type: sourceType,
      });
      if (!paidValidation.valid) {
        toast({
          title: "Pred označením ako vyplatené",
          description: paidValidation.message,
          variant: "destructive",
        });
        openEdit(c, { payment_status: "paid" });
        return;
      }
    }
    const { error } = await supabase
      .from("commissions")
      .update({ payment_status: next })
      .eq("id", c.id);
    if (error) {
      const dbMsg = commissionPaidPayoutDbErrorMessage(error.message);
      toast({
        title: "Chyba uloženia",
        description: dbMsg ?? error.message,
        variant: "destructive",
      });
      return;
    }
    if (next === "paid") {
      logEntityCommunicationEventSafe({
        kind: "payment",
        title: c.title,
        body_preview: `${fmtEur(Number(c.amount))} · vyplatené`,
        customer_id: (c as { customer_id?: string | null }).customer_id ?? null,
        customer_email: (c as { customer_email?: string | null }).customer_email ?? null,
        source_table: "commissions",
        source_id: c.id,
        idempotency_key: `commissions:${c.id}:paid`,
        metadata: { payment_status: "paid", action: "paid" },
      });
    }
    if (access.userId) {
      void logAdminAuditEvent({
        actorUserId: access.userId,
        actionType: AUDIT_ACTION_TYPES.commission_status_changed,
        targetType: "commission",
        targetId: c.id,
        summary: `Provízia ${c.title}: ${c.payment_status} → ${next}`,
        before: { payment_status: c.payment_status },
        after: { payment_status: next },
      });
    }
    toast({ title: "Stav úhrady upravený" });
    await load();

    if (next === "paid") {
      const bridge = await resolveCommissionPayoutBridgeAfterMarkPaid(c);
      if (bridge.action === "open_dialog") {
        setPayoutFactDraft(bridge.draft);
        setPayoutFactOpen(true);
      }
    }
  };

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const unpaid = rows.filter((r) => r.payment_status === "unpaid").reduce((s, r) => s + Number(r.amount || 0), 0);
    return { paid, unpaid };
  }, [rows]);

  // Fáza 5: "Výplata" — audit stav z payout_records (oddelene od workflow stĺpca "Stav").
  const renderPayoutBadge = (c: CommissionRow) => {
    const info = resolveCommissionPayoutInfo(c, payoutRecords);
    if (info.status === "audited_payout_fact" || info.status === "audited_legacy_import") {
      return (
        <div className="flex flex-col gap-1 items-start">
          <TruthLevelBadge level={info.truthLevel!} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {fmtEur(info.auditedAmount)}
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
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const renderRow = (c: CommissionRow) => {
    const canToggle = canToggleCommissionPaymentStatus(access, c.implementer);
    return (
    <>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(c.date).toLocaleDateString("sk-SK")}
      </TableCell>
      <TableCell className="text-sm">{resolveCommissionSourceLabel(c)}</TableCell>
      <TableCell className="text-sm">{formatImplementerLabel(c.implementer, historicalIdentity)}</TableCell>
      <TableCell className="text-right font-medium">
        <div className="flex flex-col items-end gap-0.5">
          <span>{fmtEur(Number(c.amount || 0))}</span>
          {c.amount_mode === "percent" && c.rate_percent != null && (
            <span className="text-[10px] text-muted-foreground font-normal">
              {formatCommissionAmountHint({
                amount_mode: "percent",
                rate_percent: Number(c.rate_percent),
                amount: Number(c.amount || 0),
              })}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs hidden md:table-cell">{paymentFormLabel(c.payment_form)}</TableCell>
      <TableCell>
        {canToggle ? (
          <button type="button" onClick={() => void togglePaymentStatus(c)} title="Prepnúť stav úhrady">
            <Badge variant="outline" className={`text-[10px] cursor-pointer ${STATUS_CLASS[c.payment_status] ?? ""}`}>
              {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
            </Badge>
          </button>
        ) : (
          <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
            {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs">{renderPayoutBadge(c)}</TableCell>
      <TableCell className="text-right">
        {canWrite ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : null}
      </TableCell>
    </>
  );
  };

  const showProfit = sourceType === "hosting" || sourceType === "project" || sourceType === "marketing";

  return (
    <div className="space-y-4">
      {showProfit && (
        <EntityProfitBanner
          entityKind={sourceType}
          revenue={revenueAmount ?? 0}
          operatingCost={operatingCost}
          revenueKnown={revenueKnown}
          paymentRecordCount={paymentRecordCount}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="text-green-600">Vyplatené: {fmtEur(totals.paid)}</span>
          <span className="text-amber-600">Nezaplatené: {fmtEur(totals.unpaid)}</span>
        </div>
        <Button
          size="sm"
          onClick={openNew}
          className="min-h-9"
          disabled={!canWrite || disableCreate}
          title={disableCreate ? createDisabledHint : undefined}
        >
          <Plus className="w-4 h-4 mr-1" /> Nová provízia
        </Button>
      </div>
      {disableCreate && (
        <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
          {createDisabledHint}
        </p>
      )}
      {!canWrite && (
        <p className="text-[10px] text-muted-foreground italic">
          Úpravy provízií môže vykonať len administrátor. Zobrazené záznamy podliehajú vášmu rozsahu prístupu.
        </p>
      )}

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-xl">
          Žiadne provízie prepojené s týmto záznamom.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Názov</TableHead>
                  <TableHead>Realizátor</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Výplata</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>{renderRow(c)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {rows.map((c) => {
              const canToggle = canToggleCommissionPaymentStatus(access, c.implementer);
              return (
              <div key={c.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{resolveCommissionSourceLabel(c)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.date).toLocaleDateString("sk-SK")} · {formatImplementerLabel(c.implementer, historicalIdentity)}
                    </p>
                  </div>
                  {canWrite && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{fmtEur(Number(c.amount || 0))}</span>
                  {c.amount_mode === "percent" && c.rate_percent != null && (
                    <span className="text-xs text-muted-foreground">{Number(c.rate_percent)}%</span>
                  )}
                  {canToggle ? (
                    <button type="button" onClick={() => void togglePaymentStatus(c)}>
                      <Badge variant="outline" className={`text-[10px] cursor-pointer ${STATUS_CLASS[c.payment_status] ?? ""}`}>
                        {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
                      {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{paymentFormLabel(c.payment_form)}</span>
                </div>
                <div className="text-xs">{renderPayoutBadge(c)}</div>
              </div>
            );
            })}
          </div>
        </>
      )}

      <p className="text-[10px] text-muted-foreground">
        Zdroj: {COMMISSION_SOURCE_LABELS[sourceType]}. Legacy riadky bez source_id sú len vo Financiách.
      </p>

      {commissionCloseGuard.closeGuardDialog}
      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) commissionCloseGuard.handleOpenChange(o, closeCommissionDialog);
        }}
        title={form.id ? "Upraviť províziu" : "Nová provízia"}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => commissionCloseGuard.requestClose(closeCommissionDialog)}
              className="w-full sm:w-auto"
              disabled={saving}
            >
              Zrušiť
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </>
        }
      >
        <CommissionFormFields
          form={form}
          onChange={(patch) => setForm({ ...form, ...patch })}
          allowPercentMode={sourceType === "project"}
          revenueAmount={revenueAmount}
          operatingCost={operatingCost}
          revenueKnown={revenueKnown}
          sourceType={sourceType}
        />
      </AdminDialog>

      <FactConfirmDialog
        open={payoutFactOpen}
        onOpenChange={setPayoutFactOpen}
        draft={payoutFactDraft}
        mode="workflow"
        onSaved={() => {
          toast({
            title: "Payout fact vytvorený",
            description: "Workflow status zostáva nezmenený.",
          });
          void load();
        }}
      />
    </div>
  );
}

export function CommissionSourceLink({ row }: { row: CommissionRow }) {
  const href = sourceDetailHref(row.source_type as CommissionSourceType, row.source_id);
  const label = COMMISSION_SOURCE_LABELS[row.source_type as CommissionSourceType] ?? row.source_type ?? "—";
  if (!href) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <Link to={href} className="text-xs text-primary hover:underline">
      {label}
    </Link>
  );
}