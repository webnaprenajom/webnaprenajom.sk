import { useMemo, useState } from "react";
import { fmtEur } from "@/lib/money/formatMoney";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { PaymentCompletenessBadge } from "@/components/admin/PaymentCompletenessBadge";
import type { EntityPaymentRow } from "@/lib/finance/entityPaymentBridge";
import {
  entityPaymentAddHint,
  entityPaymentRemainingAmount,
  formatEntityPaymentRemainingHint,
  sumConfirmedPayments,
} from "@/lib/finance/entityPaymentBridge";
import { toast } from "@/hooks/use-toast";
import { useAccessContext } from "@/hooks/useAccessContext";
import { canMutateFinanceRecords, writeDeniedMessage } from "@/lib/rbac/writePermissions";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import {
  deleteEntityPaymentFact,
  insertEntityPaymentFact,
  updateEntityPaymentFact,
  type EntityPaymentSourceTable,
} from "@/lib/finance/entityPaymentMutations";
import { evaluateEntityPaymentDelete } from "@/lib/finance/entityPaymentDelete";
import { toLocalInput } from "@/lib/finance/factDrafts";
import { parseMoneyInput } from "@/lib/money/formatMoney";
import { ENTITY_PAYMENTS_TAB_NOTE } from "@/components/admin/AgreedPriceField";

export type EntityPaymentContext = {
  sourceTable: EntityPaymentSourceTable;
  sourceId: string;
  agreedPrice: number | null | undefined;
  clientName: string | null;
  customerEmail: string | null;
  defaultNote: string;
};

type PaymentFormState = {
  id: string;
  amount: string;
  paid_at: string;
  note: string;
};

const todayLocal = () => new Date().toISOString().slice(0, 16);

function emptyForm(remaining: number): PaymentFormState {
  return {
    id: "",
    amount: remaining > 0 ? String(remaining) : "",
    paid_at: todayLocal(),
    note: "",
  };
}

type Props = {
  payments: EntityPaymentRow[];
  entity: EntityPaymentContext;
  loading?: boolean;
  footerNote?: string;
  onSaved: () => void;
};

export function EntityPaymentRecordsPanel({
  payments,
  entity,
  loading,
  footerNote,
  onSaved,
}: Props) {
  const access = useAccessContext();
  const canMutate = canMutateFinanceRecords(access);
  const confirmedPaid = useMemo(() => sumConfirmedPayments(payments), [payments]);
  const remaining = entityPaymentRemainingAmount(entity.agreedPrice, confirmedPaid);
  const addHint = entityPaymentAddHint(entity.agreedPrice, confirmedPaid);
  const remainingHint = formatEntityPaymentRemainingHint(entity.agreedPrice, confirmedPaid);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(() => emptyForm(remaining));

  const openNew = () => {
    if (!canMutate) {
      toast({ title: writeDeniedMessage("Pridanie platby"), variant: "destructive" });
      return;
    }
    if (addHint) {
      toast({ title: "Nemožno pridať platbu", description: addHint, variant: "destructive" });
      return;
    }
    setForm(emptyForm(remaining));
    setDialogOpen(true);
  };

  const openEdit = (row: EntityPaymentRow) => {
    if (!canMutate) {
      toast({ title: writeDeniedMessage("Úpravu platby"), variant: "destructive" });
      return;
    }
    setForm({
      id: row.id,
      amount: String(row.amount ?? ""),
      paid_at: toLocalInput(row.paid_at),
      note: row.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async (): Promise<boolean> => {
    if (!canMutate) return false;
    const amount = parseMoneyInput(form.amount);
    if (amount <= 0) {
      toast({ title: "Zadajte sumu väčšiu ako 0", variant: "destructive" });
      return false;
    }
    if (!form.paid_at.trim()) {
      toast({ title: "Zadajte dátum platby", variant: "destructive" });
      return false;
    }

    const otherPaid = form.id
      ? payments
          .filter((p) => p.id !== form.id && p.truth_level === "payment_fact")
          .reduce((s, p) => s + Number(p.amount || 0), 0)
      : confirmedPaid;
    const agreed = Number(entity.agreedPrice ?? 0);
    if (agreed > 0 && otherPaid + amount > agreed) {
      const ok = confirm(
        `Suma ${fmtEur(amount)} prekročí dohodnutú cenu (${fmtEur(agreed)}). Pokračovať s preplatkom?`,
      );
      if (!ok) return false;
    }

    setSaving(true);
    try {
      const note = form.note.trim() || entity.defaultNote;
      if (form.id) {
        await updateEntityPaymentFact(form.id, {
          amount: form.amount,
          paid_at: form.paid_at,
          note,
        });
        toast({ title: "Platba upravená" });
      } else {
        await insertEntityPaymentFact({
          amount: form.amount,
          paid_at: form.paid_at,
          note,
          client_name: entity.clientName,
          customer_email: entity.customerEmail,
          source_table: entity.sourceTable,
          source_id: entity.sourceId,
        });
        toast({ title: "Platba zaznamenaná", description: "Okamžite platí ako potvrdená platba (payment_fact)." });
      }
      setDialogOpen(false);
      onSaved();
      return true;
    } catch (err: unknown) {
      toast({
        title: "Chyba uloženia",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: EntityPaymentRow) => {
    if (!canMutate) {
      toast({ title: writeDeniedMessage("Zmazanie platby"), variant: "destructive" });
      return;
    }
    const gate = await evaluateEntityPaymentDelete(entity.sourceTable, entity.sourceId);
    if (!gate.canDelete) {
      toast({ title: "Zmazanie zablokované", description: gate.blockReason ?? undefined, variant: "destructive" });
      return;
    }
    if (!confirm(`Naozaj zmazať platbu ${fmtEur(Number(row.amount || 0))}?`)) return;
    try {
      await deleteEntityPaymentFact(row.id);
      toast({ title: "Platba zmazaná" });
      onSaved();
    } catch (err: unknown) {
      toast({
        title: "Chyba zmazania",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const closeDialog = () => setDialogOpen(false);
  const closeGuard = useAdminCloseGuard({
    isOpen: dialogOpen,
    current: form,
    onSave: save,
    saving,
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{footerNote ?? ENTITY_PAYMENTS_TAB_NOTE}</p>

      <div className="flex flex-wrap items-center gap-3">
        <PaymentCompletenessBadge agreedPrice={entity.agreedPrice} confirmedPaid={confirmedPaid} />
        {remainingHint && (
          <span className="text-xs text-muted-foreground">{remainingHint}</span>
        )}
        <Button size="sm" variant="outline" disabled={!canMutate || !!addHint} onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Pridať platbu
        </Button>
        {addHint && <p className="text-[10px] text-muted-foreground">{addHint}</p>}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
          Žiadne platby. Prvá úhrada sa zapíše priamo ako payment_fact — bez kroku v Zladení.
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Suma</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Poznámka</TableHead>
                {canMutate && <TableHead className="text-right w-[88px]">Akcie</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("sk-SK") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{fmtEur(Number(p.amount || 0))}</TableCell>
                  <TableCell>
                    <TruthLevelBadge level={p.truth_level as "payment_fact"} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                    {p.note || "—"}
                  </TableCell>
                  {canMutate && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void remove(p)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {closeGuard.closeGuardDialog}
      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) closeGuard.handleOpenChange(o, closeDialog);
        }}
        title={form.id ? "Upraviť platbu" : "Nová platba"}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => closeGuard.requestClose(closeDialog)} disabled={saving}>
              Zrušiť
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uložiť
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {!form.id && remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              Zostáva uhradiť: <strong>{fmtEur(remaining)}</strong>
            </p>
          )}
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Suma (€)</label>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Dátum úhrady</label>
            <Input
              type="datetime-local"
              value={form.paid_at}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Poznámka</label>
            <Textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={entity.defaultNote}
            />
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
