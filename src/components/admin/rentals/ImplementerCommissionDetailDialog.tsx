import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { fmtEur } from "@/lib/money/formatMoney";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PAYMENT_FORM_OPTIONS, paymentFormLabel, type PaymentFormValue } from "@/lib/paymentForm";
import { COMMISSION_PAYOUT_STATUS_LABELS } from "@/lib/finance/commissionPayoutStatus";
import { customerHrefByClientName } from "@/lib/adminNav";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import type { FactDraft } from "@/lib/finance/factDrafts";
import {
  buildPartialCommissionPayoutDraft,
} from "@/lib/finance/commissionPayoutBridge";
import {
  buildPayoutEditDraft,
  canMutatePayoutRecord,
  deletePayoutRecord,
} from "@/lib/finance/commissionPayoutMutations";
import {
  ensureRentalCommissionMaterialized,
} from "@/lib/finance/rentalCommissionPayoutBridge";
import {
  buildRentalCommissionDeals,
  DEAL_PAYOUT_STATUS_LABELS,
  dealPayoutStatusClass,
  summarizeRentalCommissionDeals,
  type PayoutTransaction,
  type RentalCommissionDeal,
} from "@/lib/finance/rentalCommissionDeal";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canToggleCommissionPaymentStatus,
  commissionPaymentStatusDeniedMessage,
} from "@/lib/rbac/writePermissions";
import type { CommissionRow as SourceCommissionRow } from "@/lib/commissionSource";
import {
  type RentalImplementer,
  serializeRentalImplementerForSave,
} from "@/lib/rentalImplementers";

export type { RentalImplementer } from "@/lib/rentalImplementers";

type RentalWebsite = {
  id: string;
  name: string;
  url: string | null;
  client_name: string | null;
  implementers: RentalImplementer[];
};

type CommissionRow = SourceCommissionRow & {
  payment_form: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  implementerName: string;
  year: number;
  websites: RentalWebsite[];
  commissions: CommissionRow[];
  payoutRecords?: PayoutRecordLike[];
  clientEmailMap: Map<string, string>;
  yearStats: (w: RentalWebsite) => { paid: number; potential: number };
  onSaved: () => void;
  /** Scoped reload after payout fact — commissions + payout_records only. */
  onPayoutSaved?: () => void | Promise<void>;
}

export function ImplementerCommissionDetailDialog({
  open,
  onOpenChange,
  implementerName,
  year,
  websites,
  commissions,
  payoutRecords = [],
  clientEmailMap,
  yearStats,
  onSaved,
  onPayoutSaved,
}: Props) {
  const access = useAccessContext();
  const canTogglePaymentStatus = canToggleCommissionPaymentStatus(access, implementerName);
  const [payoutFactDraft, setPayoutFactDraft] = useState<FactDraft | null>(null);
  const [payoutFactOpen, setPayoutFactOpen] = useState(false);
  const [payoutEditMode, setPayoutEditMode] = useState(false);
  const [expandedDealKey, setExpandedDealKey] = useState<string | null>(null);
  const [deletePayoutTarget, setDeletePayoutTarget] = useState<{
    transaction: PayoutTransaction;
    dealTitle: string;
  } | null>(null);
  const [deletingPayout, setDeletingPayout] = useState(false);

  const openPayoutDraft = (draft: FactDraft | null, edit = false) => {
    if (!draft) return;
    setPayoutEditMode(edit);
    setPayoutFactDraft(draft);
    setPayoutFactOpen(true);
  };

  const { rentalDeals, legacyDeals } = useMemo(
    () =>
      buildRentalCommissionDeals({
        implementerName,
        year,
        websites,
        commissions,
        payoutRecords,
        yearStats,
      }),
    [implementerName, year, websites, commissions, payoutRecords, yearStats],
  );

  const rentalTotals = useMemo(() => summarizeRentalCommissionDeals(rentalDeals), [rentalDeals]);
  const legacyTotals = useMemo(() => summarizeRentalCommissionDeals(legacyDeals), [legacyDeals]);

  const saveRentalRow = async (
    websiteId: string,
    impIndex: number,
    patch: {
      payment_form?: PaymentFormValue | "";
      note?: string;
    },
  ) => {
    const w = websites.find((x) => x.id === websiteId);
    if (!w) return;
    const next = [...(w.implementers || [])];
    next[impIndex] = { ...next[impIndex], ...patch };
    const { error } = await supabase
      .from("rental_websites")
      .update({ implementers: next.map(serializeRentalImplementerForSave) })
      .eq("id", websiteId);
    if (error) {
      toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uložené" });
    onSaved();
  };

  const saveCommissionRow = async (
    id: string,
    patch: { payment_form?: PaymentFormValue | ""; note?: string; payment_status?: "paid" | "unpaid" },
  ) => {
    const { error } = await supabase
      .from("commissions")
      .update({
        ...(patch.payment_form !== undefined ? { payment_form: patch.payment_form || null } : {}),
        ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
        ...(patch.payment_status !== undefined ? { payment_status: patch.payment_status } : {}),
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uložené" });
    onSaved();
  };

  const recordDealPayout = async (deal: RentalCommissionDeal) => {
    if (!canTogglePaymentStatus) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    if (deal.remainingAmount <= 0) {
      toast({ title: "Nič na výplatu", description: "Zákazka je už plne vyplatená.", variant: "destructive" });
      return;
    }

    try {
      let commissionId = deal.commissionId;
      let bridgeCommission = commissionId ? commissions.find((c) => c.id === commissionId) : undefined;

      if (!commissionId && deal.websiteId != null && deal.impIndex != null) {
        const customerEmail = deal.clientName
          ? clientEmailMap.get(deal.clientName.trim().toLowerCase()) ?? null
          : null;
        const materialized = await ensureRentalCommissionMaterialized(
          {
            websiteId: deal.websiteId,
            websiteName: deal.title,
            implementer: implementerName,
            year,
            amount: deal.potentialCommission,
            customerEmail,
            note: deal.note || null,
          },
          commissions,
        );
        if (!materialized) {
          toast({ title: "Chyba", description: "Nepodarilo sa pripraviť provízny záznam.", variant: "destructive" });
          return;
        }
        commissionId = materialized.commissionId;
        bridgeCommission = {
          id: materialized.commissionId,
          title: deal.title,
          amount: deal.potentialCommission,
          date: `${year}-12-31`,
          implementer: implementerName,
          note: deal.note,
          payment_status: "unpaid",
          payment_form: deal.paymentForm,
          source_type: "rental",
          source_id: deal.websiteId,
          customer_email: customerEmail,
        } as CommissionRow;
      }

      if (!bridgeCommission || !commissionId) {
        toast({ title: "Chyba", description: "Chýba provízny záznam pre výplatu.", variant: "destructive" });
        return;
      }

      const draft = buildPartialCommissionPayoutDraft(
        {
          id: commissionId,
          title: bridgeCommission.title,
          amount: deal.potentialCommission,
          date: bridgeCommission.date,
          implementer: bridgeCommission.implementer,
          note: bridgeCommission.note,
        },
        deal.paidAmount,
        { potentialAmount: deal.potentialCommission },
      );
      if (!draft) {
        toast({ title: "Nič na výplatu", description: "Zostávajúca suma je 0.", variant: "destructive" });
        return;
      }
      openPayoutDraft(draft, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Neočakávaná chyba";
      toast({ title: "Chyba výplaty", description: msg, variant: "destructive" });
    }
  };

  const openEditPayout = (deal: RentalCommissionDeal, transaction: PayoutTransaction) => {
    if (!canTogglePaymentStatus) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    if (!canMutatePayoutRecord(transaction.truth_level)) {
      toast({
        title: "Legacy výplata",
        description: "Historický import upravte v Finance → Diagnostika → Záznamy.",
        variant: "destructive",
      });
      return;
    }
    const row = payoutRecords.find((r) => r.id === transaction.id);
    if (!row?.id) {
      toast({ title: "Chyba", description: "Záznam výplaty sa nenašiel.", variant: "destructive" });
      return;
    }
    openPayoutDraft(buildPayoutEditDraft({ ...row, id: row.id }), true);
  };

  const requestDeletePayout = (deal: RentalCommissionDeal, transaction: PayoutTransaction) => {
    if (!canTogglePaymentStatus) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    if (!canMutatePayoutRecord(transaction.truth_level)) {
      toast({
        title: "Legacy výplata",
        description: "Historický import nemožno zmazať odtiaľto.",
        variant: "destructive",
      });
      return;
    }
    setDeletePayoutTarget({ transaction, dealTitle: deal.title });
  };

  const confirmDeletePayout = async () => {
    if (!deletePayoutTarget) return;
    setDeletingPayout(true);
    try {
      await deletePayoutRecord(deletePayoutTarget.transaction.id);
      toast({ title: "Výplata zmazaná" });
      setDeletePayoutTarget(null);
      void (onPayoutSaved ?? onSaved)();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba pri mazaní";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setDeletingPayout(false);
    }
  };

  const toggleDealExpanded = (dealKey: string) => {
    setExpandedDealKey((prev) => (prev === dealKey ? null : dealKey));
  };

  const stopRowToggle = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
  };

  const renderDealRow = (deal: RentalCommissionDeal, isLegacy = false) => {
    const expanded = expandedDealKey === deal.dealKey;
    return (
      <div
        key={deal.dealKey}
        className={`rounded-lg border border-border/70 bg-card overflow-hidden ${
          isLegacy ? "border-amber-500/25" : ""
        } ${expanded ? "ring-1 ring-border/80" : ""}`}
      >
        <button
          type="button"
          className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            expanded ? "bg-muted/25" : ""
          }`}
          aria-expanded={expanded}
          onClick={() => toggleDealExpanded(deal.dealKey)}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0 w-full">
            <ChevronDown
              className={`w-4 h-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Badge
                  variant={isLegacy ? "outline" : "secondary"}
                  className={`text-[10px] shrink-0 ${isLegacy ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : ""}`}
                >
                  {isLegacy ? "Legacy" : "Prenájom"}
                </Badge>
                <span className="text-sm font-medium truncate">{deal.title}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${dealPayoutStatusClass(deal.payoutStatus)}`}
                >
                  {DEAL_PAYOUT_STATUS_LABELS[deal.payoutStatus]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                {deal.clientName && !isLegacy ? (
                  customerHrefByClientName(deal.clientName, clientEmailMap) ? (
                    <Link
                      to={customerHrefByClientName(deal.clientName, clientEmailMap)!}
                      className="text-primary hover:underline truncate max-w-[200px]"
                      onClick={stopRowToggle}
                    >
                      {deal.clientName}
                    </Link>
                  ) : (
                    <span className="truncate max-w-[200px]">{deal.clientName}</span>
                  )
                ) : (
                  <span>—</span>
                )}
                {deal.percentage != null && <span>{deal.percentage}%</span>}
                {deal.clientPaidShare != null && (
                  <span className="text-green-600">Z klienta {fmtEur(deal.clientPaidShare)}</span>
                )}
                {deal.workflowPaidUnaudited && (
                  <span className="text-[10px]">{COMMISSION_PAYOUT_STATUS_LABELS.paid_workflow_unaudited}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-right text-xs tabular-nums sm:shrink-0 w-full sm:w-auto">
              <div>
                <div className="text-[10px] text-muted-foreground">Potenciál</div>
                <div className="font-medium">{fmtEur(deal.potentialCommission)}</div>
              </div>
              <div>
                <div className="text-[10px] text-green-600">Vyplatené</div>
                <div className="font-medium text-green-600">{fmtEur(deal.paidAmount)}</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-600">Ostáva</div>
                <div className="font-medium text-amber-600">{fmtEur(deal.remainingAmount)}</div>
              </div>
            </div>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border/60 bg-muted/15 px-3 py-3 space-y-3" onClick={stopRowToggle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Posledná výplata</div>
                <div>
                  {deal.lastPayoutAt
                    ? new Date(deal.lastPayoutAt).toLocaleDateString("sk-SK")
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-1">Forma výplaty</div>
                {deal.dealType === "rental" && deal.impIndex != null && deal.websiteId ? (
                  <select
                    className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
                    value={deal.paymentForm}
                    onClick={stopRowToggle}
                    onChange={(e) =>
                      void saveRentalRow(deal.websiteId!, deal.impIndex!, {
                        payment_form: e.target.value as PaymentFormValue,
                      })
                    }
                  >
                    <option value="">—</option>
                    {PAYMENT_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : deal.commissionId ? (
                  <select
                    className="h-8 w-full max-w-xs rounded-md border border-input bg-background px-2 text-xs"
                    value={deal.paymentForm}
                    onClick={stopRowToggle}
                    onChange={(e) =>
                      void saveCommissionRow(deal.commissionId!, {
                        payment_form: e.target.value as PaymentFormValue,
                      })
                    }
                  >
                    <option value="">—</option>
                    {PAYMENT_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{paymentFormLabel(deal.paymentForm) || "—"}</span>
                )}
              </div>
              <div className="sm:col-span-2">
                <div className="text-[10px] text-muted-foreground mb-1">Poznámka</div>
                {deal.dealType === "rental" && deal.impIndex != null && deal.websiteId ? (
                  <Input
                    className="h-8 text-xs max-w-md"
                    defaultValue={deal.note}
                    placeholder="Poznámka k zákazke"
                    onClick={stopRowToggle}
                    onBlur={(e) => {
                      if (e.target.value !== deal.note) {
                        void saveRentalRow(deal.websiteId!, deal.impIndex!, { note: e.target.value });
                      }
                    }}
                  />
                ) : deal.commissionId ? (
                  <Input
                    className="h-8 text-xs max-w-md"
                    defaultValue={deal.note}
                    placeholder="Poznámka k zákazke"
                    onClick={stopRowToggle}
                    onBlur={(e) => {
                      if (e.target.value !== deal.note) {
                        void saveCommissionRow(deal.commissionId!, { note: e.target.value });
                      }
                    }}
                  />
                ) : (
                  <span className="text-muted-foreground">{deal.note || "—"}</span>
                )}
              </div>
            </div>

            {canTogglePaymentStatus && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={deal.remainingAmount <= 0}
                onClick={(e) => {
                  stopRowToggle(e);
                  void recordDealPayout(deal);
                }}
              >
                Zaznamenať výplatu
              </Button>
            )}

            <div>
              <div className="text-xs font-medium mb-2">História výplat</div>
              {deal.payoutTransactions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Zatiaľ žiadne auditované výplaty.</p>
              ) : (
                <div className="rounded-md border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dátum</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Forma / ref.</TableHead>
                        <TableHead>Truth</TableHead>
                        <TableHead>Poznámka</TableHead>
                        {canTogglePaymentStatus && <TableHead className="text-right">Akcie</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deal.payoutTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(t.paid_at).toLocaleString("sk-SK")}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{fmtEur(t.amount)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                            {t.reference || "—"}
                          </TableCell>
                          <TableCell>
                            {t.truth_level === "payout_fact" || t.truth_level === "legacy_import" ? (
                              <TruthLevelBadge level={t.truth_level} />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                            {t.note || "—"}
                          </TableCell>
                          {canTogglePaymentStatus && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px]"
                                  disabled={!canMutatePayoutRecord(t.truth_level)}
                                  onClick={() => openEditPayout(deal, t)}
                                >
                                  Upraviť
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] text-destructive hover:text-destructive"
                                  disabled={!canMutatePayoutRecord(t.truth_level)}
                                  onClick={() => requestDeletePayout(deal, t)}
                                >
                                  Zmazať
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {deal.hadDualSource && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-2">
                  Pred zlúčením existoval JSON podiel aj materializovaná provízia — zobrazené ako jedna zákazka.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provízie — {implementerName} ({year})</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Jedna zákazka = jeden riadok. Kliknite na riadok pre detail, históriu výplat a úpravy.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Zákazky</div>
            <div className="font-semibold">{rentalTotals.count}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Potenciál</div>
            <div className="font-semibold text-primary">{fmtEur(rentalTotals.potential)}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Vyplatené</div>
            <div className="font-semibold text-green-600">{fmtEur(rentalTotals.paid)}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Ostáva vyplatiť</div>
            <div className="font-semibold text-amber-600">{fmtEur(rentalTotals.remaining)}</div>
          </div>
        </div>

        {rentalDeals.length === 0 && legacyDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žiadne záznamy pre tohto realizátora.</p>
        ) : (
          <div className="space-y-2">
            {rentalDeals.map((d) => renderDealRow(d))}
            {legacyDeals.length > 0 && (
              <p className="text-[10px] font-medium text-muted-foreground px-1 pt-2">
                Legacy / bez prepojenia na prenájom
              </p>
            )}
            {legacyDeals.map((d) => renderDealRow(d, true))}
          </div>
        )}
        {legacyDeals.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Legacy súhrn: potenciál {fmtEur(legacyTotals.potential)} · vyplatené {fmtEur(legacyTotals.paid)} ·
            ostáva {fmtEur(legacyTotals.remaining)}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavrieť</Button>
        </div>
      </DialogContent>
    </Dialog>

    <FactConfirmDialog
      open={payoutFactOpen}
      onOpenChange={(o) => {
        setPayoutFactOpen(o);
        if (!o) {
          setPayoutFactDraft(null);
          setPayoutEditMode(false);
        }
      }}
      draft={payoutFactDraft}
      mode={payoutEditMode ? "edit" : "workflow"}
      onSaved={() => {
        setPayoutFactOpen(false);
        setPayoutFactDraft(null);
        setPayoutEditMode(false);
        void (onPayoutSaved ?? onSaved)();
      }}
    />

    <AlertDialog open={!!deletePayoutTarget} onOpenChange={(o) => !o && setDeletePayoutTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zmazať výplatu?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Odstránite auditovanú výplatu pre realizátora <strong>{implementerName}</strong>
                {deletePayoutTarget ? (
                  <>
                    {" "}
                    — provízia <strong>{deletePayoutTarget.dealTitle}</strong>, suma{" "}
                    <strong>{fmtEur(deletePayoutTarget.transaction.amount)}</strong>.
                  </>
                ) : null}
              </p>
              <p>Stav zákazky (vyplatené / ostáva) sa prepočíta zostávajúcich payout záznamov.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingPayout}>Zrušiť</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={deletingPayout}
            onClick={() => void confirmDeletePayout()}
          >
            Zmazať výplatu
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
