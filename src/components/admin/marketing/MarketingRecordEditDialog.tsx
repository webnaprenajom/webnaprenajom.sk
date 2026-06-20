import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { Label } from "@/components/ui/label";
import { AdminDialog } from "@/components/admin/AdminDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { AGREED_PRICE_HELPER } from "@/components/admin/AgreedPriceField";
import {
  type MarketingChannel,
  type MarketingRecord,
  type MarketingStatus,
  MARKETING_CHANNELS,
  MARKETING_STATUSES,
} from "./shared";

export function MarketingRecordEditDialog({
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
  editing: Partial<MarketingRecord> | null;
  setEditing: (v: Partial<MarketingRecord> | null) => void;
  onSave: () => void;
  customerFieldError: string | null;
  onClearCustomerFieldError: () => void;
}) {
  if (!editing) return null;

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing.id ? "Upraviť kampaň" : "Nová kampaň"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Zrušiť
          </Button>
          <Button onClick={onSave} className="w-full sm:w-auto">
            Uložiť
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Názov kampane *</Label>
          <Input
            value={editing.title || ""}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="napr. Google Ads Q2 2026"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kanál</Label>
            <Select
              value={editing.channel || "other"}
              onValueChange={(v) => setEditing({ ...editing, channel: v as MarketingChannel })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stav</Label>
            <Select
              value={editing.status || "active"}
              onValueChange={(v) => setEditing({ ...editing, status: v as MarketingStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>URL (voliteľné)</Label>
          <Input
            value={editing.url || ""}
            onChange={(e) => setEditing({ ...editing, url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1.5">
          <Label>Dohodnutá cena (€)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={editing.agreed_fee ?? ""}
            onChange={(e) =>
              setEditing({
                ...editing,
                agreed_fee: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Voliteľné"
          />
          <p className="text-[10px] text-muted-foreground">{AGREED_PRICE_HELPER}</p>
        </div>

        <div className="space-y-1.5">
          <Label>Klient</Label>
          <ClientPicker
            clientName={editing.client_name || ""}
            customerEmail={editing.customer_email}
            customerId={editing.customer_id}
            leadId={editing.lead_id}
            onChange={({ client_name, customer_email, lead_id, customer_id }) => {
              onClearCustomerFieldError();
              setEditing({ ...editing, client_name, customer_email, lead_id, customer_id });
            }}
          />
          {customerFieldError && (
            <p className="text-destructive text-xs mt-1">{customerFieldError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Poznámky</Label>
          <NoteTextarea
            rows={4}
            placeholder="Kontext kampane, ciele, interné poznámky…"
            value={editing.notes || ""}
            onChange={(v) => setEditing({ ...editing, notes: v })}
          />
        </div>
      </div>
    </AdminDialog>
  );
}
