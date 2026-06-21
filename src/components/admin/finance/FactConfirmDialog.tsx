import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/hooks/use-toast";
import {
  canConfirmCommissionPayoutReceipt,
  commissionPayoutReceiptDeniedMessage,
} from "@/lib/rbac/writePermissions";
import { Loader2 } from "lucide-react";
import { PAYMENT_FORM_OPTIONS } from "@/lib/paymentForm";
import {
  type FactDraft,
  type FactKind,
  saveFactDraft,
} from "@/lib/finance/factDrafts";
import { updatePayoutRecord } from "@/lib/finance/commissionPayoutMutations";

interface FactConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: FactDraft | null;
  mode?: "create" | "promote" | "workflow" | "edit";
  onSaved: () => void;
}

export function FactConfirmDialog({
  open,
  onOpenChange,
  draft,
  mode = "create",
  onSaved,
}: FactConfirmDialogProps) {
  const access = useAdminAccess();
  const [form, setForm] = useState<FactDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && draft) {
      setForm({ ...draft });
      return;
    }
    if (!open) setForm(null);
  }, [open, draft]);

  const displayForm = form ?? (open && draft ? draft : null);

  const closeDialog = () => onOpenChange(false);

  const persist = async (): Promise<boolean> => {
    const active = form ?? displayForm;
    if (!active) return false;
    if (active.kind !== "cost" && !active.paid_at?.trim()) {
      toast({ title: "Chýba dátum", description: "Zadajte dátum platby/výplaty.", variant: "destructive" });
      return false;
    }
    setSaving(true);
    try {
      if (
        active.kind === "payout" &&
        active.source_table === "commissions" &&
        !canConfirmCommissionPayoutReceipt(
          { role: access.role, userId: access.userId, implementerName: access.implementerName },
          active.implementer,
        )
      ) {
        toast({
          title: "Potvrdenie zablokované",
          description: commissionPayoutReceiptDeniedMessage(),
          variant: "destructive",
        });
        return false;
      }
      if (active.recordId && active.kind === "payout") {
        await updatePayoutRecord(active.recordId, active);
        toast({ title: "Výplata upravená" });
      } else {
        await saveFactDraft(active, { actorUserId: access.userId ?? undefined });
        toast({ title: "Potvrdený záznam vytvorený" });
      }
      closeDialog();
      onSaved();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba pri ukladaní";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const closeGuard = useAdminCloseGuard({
    isOpen: open && !!displayForm,
    current: displayForm ?? {},
    onSave: persist,
    onDiscard: () => setForm(null),
    saving,
  });

  if (!open || !displayForm) return null;

  const title =
    mode === "edit" || displayForm.recordId
      ? "Upraviť výplatu"
      : mode === "promote"
        ? "Potvrdiť legacy ako nový fact"
        : mode === "workflow"
          ? "Vytvoriť potvrdený záznam"
          : displayForm.kind === "payment"
            ? "Nová potvrdená platba"
            : displayForm.kind === "payout"
              ? "Nová potvrdená výplata"
              : "Nový potvrdený náklad";

  return (
    <>
      {closeGuard.closeGuardDialog}
      <AdminDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) closeGuard.handleOpenChange(o, closeDialog);
        }}
        size="md"
        title={title}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => closeGuard.requestClose(closeDialog)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Zrušiť
            </Button>
            <Button onClick={() => void persist()} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {displayForm.recordId ? "Uložiť" : "Potvrdiť a uložiť"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
          {mode === "promote"
            ? "Vytvorí sa nový *_fact záznam. Legacy import zostáva nezmenený."
            : "Human-in-the-loop: skontrolujte údaje pred uložením. Žiadny auto-sync."}
        </p>
        <FormFields kind={displayForm.kind} form={displayForm} setForm={setForm} />
      </AdminDialog>
    </>
  );
}

function FormFields({
  kind,
  form,
  setForm,
}: {
  kind: FactKind;
  form: FactDraft;
  setForm: (f: FactDraft) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Suma (€)">
        <Input
          type="number"
          step="0.1"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
      </Field>
      {kind === "payment" && (
        <>
          <Field label="Dátum platby">
            <Input
              type="datetime-local"
              value={form.paid_at}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </Field>
          <Field label="Metóda">
            <Input value={form.method ?? ""} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          </Field>
          <Field label="Referencia">
            <Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
          <Field label="Email zákazníka">
            <Input
              value={form.customer_email ?? ""}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
            />
          </Field>
          <Field label="Klient">
            <Input value={form.client_name ?? ""} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
        </>
      )}
      {kind === "payout" && (
        <>
          <Field label="Dátum výplaty">
            <Input
              type="datetime-local"
              value={form.paid_at}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </Field>
          <Field label="Forma výplaty">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.reference ?? ""}
              onChange={(e) => setForm({ ...form, reference: e.target.value || undefined })}
            >
              <option value="">—</option>
              {PAYMENT_FORM_OPTIONS.map((o) => (
                <option key={o.value} value={o.label}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Implementér">
            <Input value={form.implementer ?? ""} onChange={(e) => setForm({ ...form, implementer: e.target.value })} />
          </Field>
          <Field label="Banková referencia (voliteľné)">
            <Input
              value={form.method ?? ""}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              placeholder="VS / IBAN / hash"
            />
          </Field>
        </>
      )}
      {kind === "cost" && (
        <>
          <Field label="Dátum úhrady">
            <Input
              type="datetime-local"
              value={form.paid_at}
              onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
            />
          </Field>
          <Field label="Dátum vzniku">
            <Input
              type="datetime-local"
              value={form.incurred_at ?? ""}
              onChange={(e) => setForm({ ...form, incurred_at: e.target.value })}
            />
          </Field>
          <Field label="Kategória">
            <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Dodávateľ">
            <Input value={form.vendor ?? ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <Field label="Referencia">
            <Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Poznámka">
        <Textarea rows={2} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
