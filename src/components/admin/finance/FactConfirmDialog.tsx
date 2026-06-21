import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  type FactDraft,
  type FactKind,
  saveFactDraft,
} from "@/lib/finance/factDrafts";

interface FactConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: FactDraft | null;
  mode?: "create" | "promote" | "workflow";
  onSaved: () => void;
}

export function FactConfirmDialog({
  open,
  onOpenChange,
  draft,
  mode = "create",
  onSaved,
}: FactConfirmDialogProps) {
  const [form, setForm] = useState<FactDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft) setForm({ ...draft });
  }, [draft]);

  const closeDialog = () => onOpenChange(false);

  const persist = async (): Promise<boolean> => {
    if (!form) return false;
    setSaving(true);
    try {
      await saveFactDraft(form);
      toast({ title: "Potvrdený záznam vytvorený" });
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
    isOpen: open && !!form,
    current: form ?? {},
    onSave: persist,
    onDiscard: () => setForm(null),
    saving,
  });

  if (!form) return null;

  const title =
    mode === "promote"
      ? "Potvrdiť legacy ako nový fact"
      : mode === "workflow"
        ? "Vytvoriť potvrdený záznam"
        : form.kind === "payment"
          ? "Nová potvrdená platba"
          : form.kind === "payout"
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
              Potvrdiť a uložiť
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
          {mode === "promote"
            ? "Vytvorí sa nový *_fact záznam. Legacy import zostáva nezmenený."
            : "Human-in-the-loop: skontrolujte údaje pred uložením. Žiadny auto-sync."}
        </p>
        <FormFields kind={form.kind} form={form} setForm={setForm} />
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
          <Field label="Implementér">
            <Input value={form.implementer ?? ""} onChange={(e) => setForm({ ...form, implementer: e.target.value })} />
          </Field>
          <Field label="Referencia">
            <Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
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
