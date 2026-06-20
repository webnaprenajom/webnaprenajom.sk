import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { useImplementerSelectOptions } from "@/hooks/useImplementerSelectOptions";
import { PAYMENT_FORM_OPTIONS, type PaymentFormValue } from "@/lib/paymentForm";
import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";

export type CommissionFormState = {
  date: string;
  title: string;
  implementer: string;
  amount: string;
  payment_status: "paid" | "unpaid";
  payment_form: PaymentFormValue | "";
  note: string;
};

interface Props {
  form: CommissionFormState;
  onChange: (patch: Partial<CommissionFormState>) => void;
  showTitle?: boolean;
}

export function CommissionFormFields({ form, onChange, showTitle = true }: Props) {
  const { options: implementerOptions, isKnown } = useImplementerSelectOptions(form.implementer);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Dátum</label>
          <Input type="date" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Suma (€)</label>
          <Input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
        </div>
      </div>
      {showTitle && (
        <div>
          <label className="text-xs text-muted-foreground">Názov</label>
          <Input value={form.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Realizátor</label>
          <Select
            value={form.implementer || "__none__"}
            onValueChange={(v) => onChange({ implementer: v === "__none__" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="— vyber —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— vyber —</SelectItem>
              {implementerOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                  {!isKnown(name) ? " (legacy)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Stav vyplatenia</label>
          <Select
            value={form.payment_status}
            onValueChange={(v) => onChange({ payment_status: v as "paid" | "unpaid" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">{COMMISSION_STATUS_LABELS.unpaid}</SelectItem>
              <SelectItem value="paid">{COMMISSION_STATUS_LABELS.paid}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Forma úhrady</label>
        <Select
          value={form.payment_form || "none"}
          onValueChange={(v) => onChange({ payment_form: v === "none" ? "" : (v as PaymentFormValue) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {PAYMENT_FORM_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Poznámka</label>
        <NoteTextarea value={form.note} onChange={(v) => onChange({ note: v })} rows={2} />
      </div>
    </div>
  );
}
