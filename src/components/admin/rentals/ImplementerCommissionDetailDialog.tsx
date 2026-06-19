import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { PAYMENT_FORM_OPTIONS, type PaymentFormValue } from "@/lib/paymentForm";
import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";
import { customerHrefByClientName } from "@/lib/adminNav";
import { bucketCommissionsBySection } from "@/lib/commissionFilters";
import { detectRentalDualModelWarning } from "@/lib/finance/commissionConsistency";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import type { FactDraft } from "@/lib/finance/factDrafts";
import { resolveCommissionPayoutBridgeAfterMarkPaid } from "@/lib/finance/commissionPayoutBridge";
import { resolveRentalJsonPayoutBridgeAfterMarkPaid } from "@/lib/finance/rentalCommissionPayoutBridge";
import { useAccessContext } from "@/hooks/useAccessContext";
import {
  canToggleCommissionPaymentStatus,
  commissionPaymentStatusDeniedMessage,
} from "@/lib/rbac/writePermissions";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import type { CommissionRow as SourceCommissionRow } from "@/lib/commissionSource";
import {
  type RentalImplementer,
  type RentalImplementerPaymentStatus,
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
  clientEmailMap: Map<string, string>;
  yearStats: (w: RentalWebsite) => { paid: number; potential: number };
  onSaved: () => void;
}

export function ImplementerCommissionDetailDialog({
  open,
  onOpenChange,
  implementerName,
  year,
  websites,
  commissions,
  clientEmailMap,
  yearStats,
  onSaved,
}: Props) {
  const access = useAccessContext();
  const canTogglePaymentStatus = canToggleCommissionPaymentStatus(access, implementerName);
  const [payoutFactDraft, setPayoutFactDraft] = useState<FactDraft | null>(null);
  const [payoutFactOpen, setPayoutFactOpen] = useState(false);

  const openPayoutBridge = (bridge: Awaited<ReturnType<typeof resolveCommissionPayoutBridgeAfterMarkPaid>>) => {
    if (bridge.action === "open_dialog") {
      setPayoutFactDraft(bridge.draft);
      setPayoutFactOpen(true);
    }
  };

  const rentalRows = useMemo(() => {
    const rows: Array<{
      websiteId: string;
      title: string;
      clientName: string | null;
      percentage: number;
      paid: number;
      potential: number;
      payment_status: RentalImplementerPaymentStatus;
      payment_form: PaymentFormValue | "";
      note: string;
      impIndex: number;
    }> = [];

    for (const w of websites) {
      const idx = (w.implementers || []).findIndex(
        (i) => i.name.trim().toLowerCase() === implementerName.trim().toLowerCase(),
      );
      if (idx < 0) continue;
      const imp = w.implementers[idx];
      const pct = Number(imp.percentage) || 0;
      if (pct <= 0) continue;
      const stats = yearStats(w);
      rows.push({
        websiteId: w.id,
        title: w.name,
        clientName: w.client_name,
        percentage: pct,
        paid: (stats.paid * pct) / 100,
        potential: (stats.potential * pct) / 100,
        payment_status: imp.payment_status,
        payment_form: (imp.payment_form as PaymentFormValue) || "",
        note: imp.note || "",
        impIndex: idx,
      });
    }
    return rows.sort((a, b) => b.potential - a.potential);
  }, [websites, implementerName, yearStats]);

  const { section: rentalCommissionRows, legacy: legacyCommissionRows } = useMemo(() => {
    const yearFiltered = commissions.filter(
      (c) =>
        c.implementer.trim().toLowerCase() === implementerName.trim().toLowerCase() &&
        c.date.startsWith(String(year)),
    );
    return bucketCommissionsBySection(yearFiltered, "rental");
  }, [commissions, implementerName, year]);

  const commissionRows = useMemo(() => {
    return rentalCommissionRows
      .map((c) => ({
        id: c.id,
        title: c.title,
        date: c.date,
        amount: Number(c.amount),
        paid: c.payment_status === "paid" ? Number(c.amount) : 0,
        potential: Number(c.amount),
        payment_form: (c.payment_form as PaymentFormValue) || "",
        note: c.note || "",
        payment_status: c.payment_status,
        isLegacy: false,
      }))
      .sort((a, b) => b.potential - a.potential);
  }, [rentalCommissionRows]);

  const legacyRows = useMemo(() => {
    return legacyCommissionRows
      .map((c) => ({
        id: c.id,
        title: c.title,
        date: c.date,
        amount: Number(c.amount),
        paid: c.payment_status === "paid" ? Number(c.amount) : 0,
        potential: Number(c.amount),
        payment_form: (c.payment_form as PaymentFormValue) || "",
        note: c.note || "",
        payment_status: c.payment_status,
        isLegacy: true,
      }))
      .sort((a, b) => b.potential - a.potential);
  }, [legacyCommissionRows]);

  const saveRentalRow = async (
    websiteId: string,
    impIndex: number,
    patch: {
      payment_form?: PaymentFormValue | "";
      note?: string;
      payment_status?: RentalImplementerPaymentStatus;
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

  const toggleCommissionPaid = async (id: string, current: string) => {
    if (!canTogglePaymentStatus) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    const next = current === "paid" ? "unpaid" : "paid";
    const row = [...commissionRows, ...legacyRows].find((c) => c.id === id);
    await saveCommissionRow(id, { payment_status: next });
    if (access.userId) {
      void logAdminAuditEvent({
        actorUserId: access.userId,
        actionType: AUDIT_ACTION_TYPES.commission_status_changed,
        targetType: "commission",
        targetId: id,
        summary: `Provízia ${implementerName}: ${current} → ${next}`,
        before: { payment_status: current },
        after: { payment_status: next },
      });
    }
    if (next === "paid" && row) {
      const full = commissions.find((c) => c.id === id);
      if (full) {
        const bridge = await resolveCommissionPayoutBridgeAfterMarkPaid(full);
        openPayoutBridge(bridge);
      }
    }
  };

  const toggleRentalPaid = async (
    websiteId: string,
    impIndex: number,
    current: RentalImplementerPaymentStatus,
    row: (typeof rentalRows)[number],
  ) => {
    if (!canTogglePaymentStatus) {
      toast({ title: commissionPaymentStatusDeniedMessage(), variant: "destructive" });
      return;
    }
    const next: RentalImplementerPaymentStatus = current === "paid" ? "unpaid" : "paid";
    await saveRentalRow(websiteId, impIndex, { payment_status: next });
    if (access.userId) {
      void logAdminAuditEvent({
        actorUserId: access.userId,
        actionType: AUDIT_ACTION_TYPES.commission_status_changed,
        targetType: "rental_website",
        targetId: websiteId,
        summary: `Prenájom provízia ${implementerName}: ${current} → ${next}`,
        before: { payment_status: current },
        after: { payment_status: next },
      });
    }
    if (next === "paid") {
      const customerEmail = row.clientName
        ? clientEmailMap.get(row.clientName.trim().toLowerCase()) ?? null
        : null;
      const bridge = await resolveRentalJsonPayoutBridgeAfterMarkPaid(
        {
          websiteId,
          websiteName: row.title,
          implementer: implementerName,
          year,
          amount: row.paid,
          customerEmail,
          note: row.note || null,
        },
        commissions,
      );
      openPayoutBridge(bridge);
      if (bridge.commissionId) {
        onSaved();
      }
    }
  };

  const paymentStatusButtonClass = (status: string) =>
    status === "paid"
      ? "border-green-500/40 text-green-600"
      : "border-amber-500/40 text-amber-600";

  const dualModelWarning = useMemo(
    () => detectRentalDualModelWarning(implementerName, commissionRows.length, rentalRows.length),
    [implementerName, commissionRows.length, rentalRows.length],
  );

  const totals = useMemo(() => {
    const rentalPaid = rentalRows.reduce((s, r) => s + r.paid, 0);
    const rentalPot = rentalRows.reduce((s, r) => s + r.potential, 0);
    const commPaid = commissionRows.reduce((s, r) => s + r.paid, 0);
    const commPot = commissionRows.reduce((s, r) => s + r.potential, 0);
    return {
      paid: rentalPaid + commPaid,
      potential: rentalPot + commPot,
      rentalCount: rentalRows.length,
      commissionCount: commissionRows.length,
    };
  }, [rentalRows, commissionRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provízie — {implementerName} ({year})</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Prenájmy: stĺpec „Z klienta“ = podiel z uhradených mesiacov klienta; „Stav úhrady provízie“ = manuálny
          workflow výplaty realizátorovi.
        </p>
        {dualModelWarning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            {dualModelWarning}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Weby</div>
            <div className="font-semibold">{totals.rentalCount}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Zákazky</div>
            <div className="font-semibold">{totals.commissionCount}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Vyplatené</div>
            <div className="font-semibold text-green-600">{totals.paid.toFixed(2)} €</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Potenciál</div>
            <div className="font-semibold text-primary">{totals.potential.toFixed(2)} €</div>
          </div>
        </div>

        {rentalRows.length === 0 && commissionRows.length === 0 && legacyRows.length === 0 ? (
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
                  <TableHead className="text-right" title="Podiel z mesiacov, kde klient uhradil prenájom">
                    Z klienta
                  </TableHead>
                  <TableHead className="text-right">Potenc.</TableHead>
                  <TableHead title="Manuálny stav výplaty provízie realizátorovi">Stav úhrady provízie</TableHead>
                  <TableHead>Forma úhrady</TableHead>
                  <TableHead>Poznámka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalRows.map((r) => (
                  <TableRow key={`rental-${r.websiteId}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">Prenájom</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[140px] truncate">{r.title}</TableCell>
                    <TableCell className="text-xs">
                      {r.clientName ? (
                        customerHrefByClientName(r.clientName, clientEmailMap) ? (
                          <Link
                            to={customerHrefByClientName(r.clientName, clientEmailMap)!}
                            className="text-primary hover:underline"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          r.clientName
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">{r.percentage}%</TableCell>
                    <TableCell className="text-right text-xs text-green-600">{r.paid.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-xs">{r.potential.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canTogglePaymentStatus}
                        className={`h-7 text-[10px] ${paymentStatusButtonClass(r.payment_status)}`}
                        onClick={() => void toggleRentalPaid(r.websiteId, r.impIndex, r.payment_status, r)}
                      >
                        {r.payment_status === "paid"
                          ? COMMISSION_STATUS_LABELS.paid
                          : COMMISSION_STATUS_LABELS.unpaid}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                        value={r.payment_form}
                        onChange={(e) =>
                          void saveRentalRow(r.websiteId, r.impIndex, {
                            payment_form: e.target.value as PaymentFormValue,
                          })
                        }
                      >
                        <option value="">—</option>
                        {PAYMENT_FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs min-w-[120px]"
                        defaultValue={r.note}
                        placeholder="Poznámka"
                        onBlur={(e) => {
                          if (e.target.value !== r.note) {
                            void saveRentalRow(r.websiteId, r.impIndex, { note: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {commissionRows.map((c) => (
                  <TableRow key={`comm-${c.id}`}>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">Provízia · prenájom</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[140px] truncate" title={c.title}>
                      {c.title}
                      <div className="text-[10px] text-muted-foreground">{c.date}</div>
                    </TableCell>
                    <TableCell className="text-xs">—</TableCell>
                    <TableCell className="text-right text-xs">—</TableCell>
                    <TableCell className="text-right text-xs text-green-600">{c.paid.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-xs">{c.potential.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canTogglePaymentStatus}
                        className={`h-7 text-[10px] ${paymentStatusButtonClass(c.payment_status)}`}
                        onClick={() => void toggleCommissionPaid(c.id, c.payment_status)}
                      >
                        {c.payment_status === "paid"
                          ? COMMISSION_STATUS_LABELS.paid
                          : COMMISSION_STATUS_LABELS.unpaid}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                        value={c.payment_form}
                        onChange={(e) =>
                          void saveCommissionRow(c.id, {
                            payment_form: e.target.value as PaymentFormValue,
                          })
                        }
                      >
                        <option value="">—</option>
                        {PAYMENT_FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs min-w-[120px]"
                        defaultValue={c.note}
                        placeholder="Poznámka"
                        onBlur={(e) => {
                          if (e.target.value !== c.note) {
                            void saveCommissionRow(c.id, { note: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {legacyRows.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-muted/40 text-[10px] font-medium text-muted-foreground py-2">
                      Legacy / bez prepojenia na prenájom (nezapočítava sa do prenájmového zoznamu)
                    </TableCell>
                  </TableRow>
                )}
                {legacyRows.map((c) => (
                  <TableRow key={`legacy-${c.id}`} className="bg-muted/20">
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                        Legacy
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[140px] truncate" title={c.title}>
                      {c.title}
                      <div className="text-[10px] text-muted-foreground">{c.date}</div>
                    </TableCell>
                    <TableCell className="text-xs">—</TableCell>
                    <TableCell className="text-right text-xs">—</TableCell>
                    <TableCell className="text-right text-xs text-green-600">{c.paid.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-xs">{c.potential.toFixed(2)} €</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canTogglePaymentStatus}
                        className={`h-7 text-[10px] ${paymentStatusButtonClass(c.payment_status)}`}
                        onClick={() => void toggleCommissionPaid(c.id, c.payment_status)}
                      >
                        {c.payment_status === "paid"
                          ? COMMISSION_STATUS_LABELS.paid
                          : COMMISSION_STATUS_LABELS.unpaid}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 w-full min-w-[90px] rounded-md border border-input bg-background px-2 text-xs"
                        value={c.payment_form}
                        onChange={(e) =>
                          void saveCommissionRow(c.id, {
                            payment_form: e.target.value as PaymentFormValue,
                          })
                        }
                      >
                        <option value="">—</option>
                        {PAYMENT_FORM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs min-w-[120px]"
                        defaultValue={c.note}
                        placeholder="Poznámka"
                        onBlur={(e) => {
                          if (e.target.value !== c.note) {
                            void saveCommissionRow(c.id, { note: e.target.value });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zavrieť</Button>
        </div>

        <FactConfirmDialog
          open={payoutFactOpen}
          onOpenChange={setPayoutFactOpen}
          draft={payoutFactDraft}
          mode="workflow"
          onSaved={() => {
            setPayoutFactOpen(false);
            setPayoutFactDraft(null);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
