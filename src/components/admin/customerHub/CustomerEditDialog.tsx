import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { CustomerRow } from "@/lib/crmLookup/customers";
import {
  customerProfileFromRow,
  normalizeCustomerProfileForm,
  updateCustomerProfile,
  type CustomerProfileForm,
} from "@/lib/crmLookup/customerProfile";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil } from "lucide-react";

const EMPTY_FORM: CustomerProfileForm = {
  displayName: "",
  email: "",
  phone: "",
  company: "",
  contactPerson: "",
  billingName: "",
  billingAddress: "",
  address: "",
  ico: "",
  dic: "",
  icDph: "",
  notes: "",
};

interface Props {
  customer: CustomerRow;
  fallbackPhone?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CustomerEditDialog({
  customer,
  fallbackPhone,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [form, setForm] = useState<CustomerProfileForm>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const guard = useUnsavedChangesGuard({ isOpen: open, current: form, normalize: normalizeCustomerProfileForm });

  useEffect(() => {
    if (!open) return;
    setForm(customerProfileFromRow(customer, fallbackPhone));
    setSaveError(null);
  }, [open, customer, fallbackPhone]);

  const requestClose = () => {
    if (!guard.confirmDiscard()) return;
    onOpenChange(false);
  };

  const setField = <K extends keyof CustomerProfileForm>(key: K, value: CustomerProfileForm[K]) => {
    setSaveError(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateCustomerProfile(customer.id, form);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      toast({ title: "Klient uložený", description: result.row.display_name });
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      title="Upraviť klienta"
      description="Údaje canonical zákazníka — zmeny sa uložia do databázy klientov."
      size="lg"
      stickyFooter
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          {saveError && (
            <p className="text-xs text-destructive sm:mr-auto sm:self-center">{saveError}</p>
          )}
          <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
            Zrušiť
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Uložiť"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cust-display-name">Názov / firma</Label>
          <Input
            id="cust-display-name"
            value={form.displayName}
            onChange={(e) => setField("displayName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-email">E-mail</Label>
          <Input
            id="cust-email"
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-phone">Telefón</Label>
          <Input
            id="cust-phone"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-company">Spoločnosť</Label>
          <Input
            id="cust-company"
            value={form.company}
            onChange={(e) => setField("company", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-contact">Kontaktná osoba</Label>
          <Input
            id="cust-contact"
            value={form.contactPerson}
            onChange={(e) => setField("contactPerson", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cust-address">Adresa</Label>
          <Input
            id="cust-address"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-billing-name">Fakturačný názov</Label>
          <Input
            id="cust-billing-name"
            value={form.billingName}
            onChange={(e) => setField("billingName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-ico">IČO</Label>
          <Input id="cust-ico" value={form.ico} onChange={(e) => setField("ico", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cust-billing-address">Fakturačná adresa</Label>
          <Input
            id="cust-billing-address"
            value={form.billingAddress}
            onChange={(e) => setField("billingAddress", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-dic">DIČ</Label>
          <Input id="cust-dic" value={form.dic} onChange={(e) => setField("dic", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-ic-dph">IČ DPH</Label>
          <Input
            id="cust-ic-dph"
            value={form.icDph}
            onChange={(e) => setField("icDph", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cust-notes">Poznámky</Label>
          <Textarea
            id="cust-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>
    </AdminDialog>
  );
}

interface EditButtonProps {
  customer: CustomerRow | null;
  fallbackPhone?: string | null;
  onSaved: () => void;
}

/** Header action — opens customer edit dialog when canonical record exists. */
export function CustomerEditButton({ customer, fallbackPhone, onSaved }: EditButtonProps) {
  const [open, setOpen] = useState(false);
  if (!customer) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5 mr-1" /> Upraviť
      </Button>
      <CustomerEditDialog
        customer={customer}
        fallbackPhone={fallbackPhone}
        open={open}
        onOpenChange={setOpen}
        onSaved={onSaved}
      />
    </>
  );
}
