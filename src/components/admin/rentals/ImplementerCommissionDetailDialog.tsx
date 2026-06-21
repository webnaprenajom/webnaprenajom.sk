import { Fragment, useMemo, useState } from "react";
import { fmtEur } from "@/lib/money/formatMoney";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

  const renderDealRow = (deal: RentalCommissionDeal, isLegacy = false) => {
    const expanded = expandedDealKey === deal.dealKey;
    return (
      <Fragment key={deal.dealKey}>
        <TableRow className={isLegacy ? "bg-muted/20" : undefined}>
          <TableCell>
            <Badge
              variant={isLegacy ? "outline" : "secondary"}
              className={`text-[10px] ${isLegacy ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : ""}`}
            >
              {isLegacy ? "Legacy" : "Prenájom"}
            </Badge>
          </TableCell>
          <TableCell className="text-sm font-medium max-w-[140px]">
            <Collapsible
              open={expanded}
              onOpenChange={(o) => setExpandedDealKey(o ? deal.dealKey : null)}
            >
              <CollapsibleTrigger className="text-left hover:underline truncate block max-w-full">
                {deal.title}
              </CollapsibleTrigger>
            </Collapsible>
          </TableCell>
          <TableCell className="text-xs">
            {deal.clientName && !isLegacy ? (
              customerHrefByClientName(deal.clientName, clientEmailMap) ? (
                <Link
                  to={customerHrefByClientName(deal.clientName, clientEmailMap)!}
                  className="text-primary hover:underline"
                >
                  {deal.clientName}
                </Link>
              ) : (
                deal.clientName
              )
            ) : (
              "—"
            )}
          </TableCell>
          <TableCell className="text-right text-xs">{deal.percentage != null ? `${deal.percentage}%` : "—"}</TableCell>
          <TableCell className="text-right text-xs text-green-600">
            {deal.clientPaidShare != null ? fmtEur(deal.clientPaidShare) : "—"}
          </TableCell>
          <TableCell className="text-right text-xs">{fmtEur(deal.potentialCommission)}</TableCell>
          <TableCell className="text-right text-xs text-green-600">{fmtEur(deal.paidAmount)}</TableCell>
          <TableCell className="text-right text-xs text-amber-600">{fmtEur(deal.remainingAmount)}</TableCell>
          <TableCell>
            <Badge variant="outline" className={`text-[10px] ${dealPayoutStatusClass(deal.payoutStatus)}`}>
              {DEAL_PAYOUT_STATUS_LABELS[deal.payoutStatus]}
            </Badge>
            {deal.workflowPaidUnaudited && (
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {COMMISSION_PAYOUT_STATUS_LABELS.paid_workflow_unaudited}
              </div>
            )}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
            {deal.lastPayoutAt ? new Date(deal.lastPayoutAt).toLocaleDateString("sk-SK") : "—"}
          </TableCell>
          <TableCell className="text-xs">{paymentFormLabel(deal.paymentForm) || "—"}</TableCell>
          <TableCell>
            {deal.dealType === "rental" && deal.impIndex != null && deal.websiteId ? (
              <select
                className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                value={deal.paymentForm}
                onChange={(e) =>
                  void saveRentalRow(deal.websiteId!, deal.impIndex!, {
                    payment_form: e.target.value as PaymentFormValue,
                  })
                }
              >
                <option value="">—</option>
                {PAYMENT_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : deal.commissionId ? (
              <select
                className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                value={deal.paymentForm}
                onChange={(e) =>
                  void saveCommissionRow(deal.commissionId!, {
                    payment_form: e.target.value as PaymentFormValue,
                  })
                }
              >
                <option value="">—</option>
                {PAYMENT_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              "—"
            )}
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={!canTogglePaymentStatus || deal.remainingAmount <= 0}
                onClick={() => void recordDealPayout(deal)}
              >
                Zaznamenať výplatu
              </Button>
              {deal.dealType === "rental" && deal.impIndex != null && deal.websiteId ? (
                <Input
                  className="h-8 text-xs min-w-[100px]"
                  defaultValue={deal.note}
                  placeholder="Poznámka"
                  onBlur={(e) => {
                    if (e.target.value !== deal.note) {
                      void saveRentalRow(deal.websiteId!, deal.impIndex!, { note: e.target.value });
                    }
                  }}
                />
              ) : deal.commissionId ? (
                <Input
                  className="h-8 text-xs min-w-[100px]"
                  defaultValue={deal.note}
                  placeholder="Poznámka"
                  onBlur={(e) => {
                    if (e.target.value !== deal.note) {
                      void saveCommissionRow(deal.commissionId!, { note: e.target.value });
                    }
                  }}
                />
              ) : null}
            </div>
          </TableCell>
        </TableRow>
        {expanded && (
          <TableRow className="bg-muted/30">
            <TableCell colSpan={13} className="py-3">
              <div className="text-xs font-medium mb-2">História výplat — {deal.title}</div>
              {deal.payoutTransactions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Zatiaľ žiadne auditované výplaty.</p>
              ) : (
                <div className="rounded border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dátum</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Truth</TableHead>
                        <TableHead>Poznámka</TableHead>
                        {canTogglePaymentStatus && <TableHead className="text-right">Akcie</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deal.payoutTransactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs">
                            {new Date(t.paid_at).toLocaleString("sk-SK")}
                          </TableCell>
                          <TableCell className="text-right text-xs">{fmtEur(t.amount)}</TableCell>
                          <TableCell>
                            {t.truth_level === "payout_fact" || t.truth_level === "legacy_import" ? (
                              <TruthLevelBadge level={t.truth_level} />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.note || t.reference || "—"}</TableCell>
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
            </TableCell>
          </TableRow>
        )}
      </Fragment>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provízie — {implementerName} ({year})</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Jedna zákazka = jeden riadok. Vyplatené = súčet <code className="text-[10px]">payout_records</code>;
          ostáva vyplatiť = potenciál mínus vyplatené. Kliknite na názov pre históriu výplat.
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
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Názov</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Z klienta</TableHead>
                  <TableHead className="text-right">Potenciál</TableHead>
                  <TableHead className="text-right">Vyplatené</TableHead>
                  <TableHead className="text-right">Ostáva</TableHead>
                  <TableHead>Stav výplaty</TableHead>
                  <TableHead>Posl. výplata</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalDeals.map((d) => renderDealRow(d))}
                {legacyDeals.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="bg-muted/40 text-[10px] font-medium text-muted-foreground py-2">
                      Legacy / bez prepojenia na prenájom
                    </TableCell>
                  </TableRow>
                )}
                {legacyDeals.map((d) => renderDealRow(d, true))}
              </TableBody>
            </Table>
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
