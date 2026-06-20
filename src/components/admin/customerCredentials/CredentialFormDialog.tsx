import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { CredentialItemsEditor } from "@/components/admin/customerCredentials/CredentialItemsEditor";
import {
  LINKED_ENTITY_TYPES,
  type CredentialFormState,
  type LinkedEntityType,
  filledCredentialItems,
} from "@/lib/customerCredentials";
import { Link2 } from "lucide-react";

export type EntityOption = { id: string; label: string };
export type EntityOptions = Partial<Record<LinkedEntityType, EntityOption[]>>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: CredentialFormState | null;
  setForm: (v: CredentialFormState | null) => void;
  removedDbIds: string[];
  onRemoveItem: (dbId: string | undefined) => void;
  entityOptions: EntityOptions;
  onCustomerChange: (fields: {
    client_name: string;
    customer_email: string | null;
    lead_id: string | null;
    customer_id: string | null;
  }) => void | Promise<void>;
  onSave: () => boolean | Promise<boolean>;
  customerFieldError: string | null;
  onClearCustomerFieldError: () => void;
  lockCustomer?: boolean;
};

export function CredentialFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  removedDbIds,
  onRemoveItem,
  entityOptions,
  onCustomerChange,
  onSave,
  customerFieldError,
  onClearCustomerFieldError,
  lockCustomer = false,
}: Props) {
  const closeDialog = () => onOpenChange(false);

  const closeGuard = useAdminCloseGuard({
    isOpen: open && !!form,
    current: { form: form ?? {}, removedDbIds },
    onSave,
    onDiscard: () => setForm(null),
  });

  if (!form) return null;

  const linkedType = form.linked_entity_type;
  const linkedOptions = linkedType ? entityOptions[linkedType] || [] : [];
  const isEdit = form.items.some((i) => i.dbId);
  const filledCount = filledCredentialItems(form.items).length;

  return (
    <>
      {closeGuard.closeGuardDialog}
      <AdminDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) closeGuard.handleOpenChange(o, closeDialog);
        }}
        size="lg"
        title={isEdit ? "Upraviť prístupy" : "Nový prístup"}
        footer={
          <>
            <Button variant="outline" onClick={() => closeGuard.requestClose(closeDialog)} className="w-full sm:w-auto">
              Zrušiť
            </Button>
            <Button onClick={() => void onSave()} className="w-full sm:w-auto">
              Uložiť{filledCount > 1 ? ` (${filledCount})` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Klient *</Label>
            {lockCustomer ? (
              <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">
                {form.client_name || "—"}
                {form.customer_email ? ` · ${form.customer_email}` : ""}
              </p>
            ) : (
              <ClientPicker
                clientName={form.client_name || ""}
                customerEmail={form.customer_email}
                customerId={form.customer_id}
                leadId={form.lead_id}
                onChange={onCustomerChange}
              />
            )}
            {customerFieldError && <p className="text-destructive text-xs mt-1">{customerFieldError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-dashed p-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                Prepojenie na entitu (voliteľné)
              </Label>
              <Select
                value={linkedType || "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    linked_entity_type: v === "none" ? null : (v as LinkedEntityType),
                    linked_entity_id: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Bez prepojenia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez prepojenia</SelectItem>
                  {LINKED_ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Konkrétna entita</Label>
              <Select
                value={form.linked_entity_id || "none"}
                disabled={!linkedType || linkedOptions.length === 0}
                onValueChange={(v) =>
                  setForm({ ...form, linked_entity_id: v === "none" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !linkedType
                        ? "Najprv vyber typ"
                        : linkedOptions.length === 0
                          ? "Žiadne entity u klienta"
                          : "Vyber entitu"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {linkedOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CredentialItemsEditor
            items={form.items}
            onChange={(items) => setForm({ ...form, items })}
            onRemoveItem={(item, index) => {
              if (item.dbId) onRemoveItem(item.dbId);
              setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
            }}
          />
        </div>
      </AdminDialog>
    </>
  );
}
