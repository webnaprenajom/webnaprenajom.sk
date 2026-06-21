import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { Label } from "@/components/ui/label";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { AGREED_PRICE_HELPER } from "@/components/admin/AgreedPriceField";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";

export type HostingRecordEditDraft = Partial<HostingRecordRow> & {
  customer_id?: string | null;
  lead_id?: string | null;
};

export function HostingRecordEditDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  onSave,
  customerFieldError,
  onClearCustomerFieldError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: HostingRecordEditDraft | null;
  setEditing: (v: HostingRecordEditDraft | null) => void;
  onSave: () => boolean | Promise<boolean>;
  customerFieldError: string | null;
  onClearCustomerFieldError: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const closeDialog = () => onOpenChange(false);

  const persist = async () => {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    return ok;
  };

  const closeGuard = useAdminCloseGuard({
    isOpen: open && !!editing,
    current: editing ?? {},
    onSave: persist,
    saving,
  });

  if (!editing) return null;

  return (
    <>
      {closeGuard.closeGuardDialog}
      <AdminDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) closeGuard.handleOpenChange(o, closeDialog);
        }}
        title="Upraviť hosting"
        size="md"
        stickyFooter
        footer={
          <>
            <Button variant="outline" onClick={() => closeGuard.requestClose(closeDialog)} disabled={saving}>
              Zrušiť
            </Button>
            <Button onClick={() => void persist()} disabled={saving}>
              Uložiť
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Klient</Label>
            <ClientPicker
              clientName={editing.client_name ?? ""}
              customerEmail={editing.customer_email ?? ""}
              customerId={editing.customer_id ?? null}
              leadId={editing.lead_id ?? null}
              onChange={({ client_name, customer_email, customer_id, lead_id }) => {
                onClearCustomerFieldError();
                setEditing({
                  ...editing,
                  client_name,
                  customer_email: customer_email || null,
                  customer_id,
                  lead_id,
                });
              }}
            />
            {customerFieldError && (
              <p className="text-destructive text-xs mt-1">{customerFieldError}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Poskytovateľ</Label>
            <Input
              value={editing.provider ?? ""}
              onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Dohodnutá cena (€)</Label>
            <Input
              type="number"
              step="0.1"
              min={0}
              value={editing.agreed_fee != null ? String(editing.agreed_fee) : ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  agreed_fee: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <p className="text-[10px] text-muted-foreground mt-1">{AGREED_PRICE_HELPER}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Mesačná cena (€)</Label>
              <Input
                type="number"
                step="0.1"
                value={editing.monthly_price != null ? String(editing.monthly_price) : ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    monthly_price: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Ročná cena (€)</Label>
              <Input
                type="number"
                step="0.1"
                value={editing.yearly_price != null ? String(editing.yearly_price) : ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    yearly_price: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Počet domén</Label>
            <Input
              type="number"
              value={editing.domains_count != null ? String(editing.domains_count) : ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  domains_count: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Získal</Label>
            <Input
              value={editing.acquired_by ?? ""}
              onChange={(e) => setEditing({ ...editing, acquired_by: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Poznámka</Label>
            <NoteTextarea
              value={editing.note ?? ""}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
            />
          </div>
        </div>
      </AdminDialog>
    </>
  );
}
