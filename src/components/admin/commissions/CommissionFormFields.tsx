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
import {
  COMMISSION_AMOUNT_MODE_LABELS,
  type CommissionAmountMode,
  resolveCommissionPersistedAmount,
} from "@/lib/commissionAmount";
import { missingCommissionPaidPayoutFields, requiresCommissionPaidPayoutDetails } from "@/lib/commissionPayoutValidation";
import { computeProfit, formatProfitSummary } from "@/lib/profit/profitCalculator";
import { fmtEur } from "@/lib/money/formatMoney";

export type CommissionFormState = {
  date: string;
  title: string;
  implementer: string;
  amount_mode: CommissionAmountMode;
  amount: string;
  rate_percent: string;
  payment_status: "paid" | "unpaid";
  payment_form: PaymentFormValue | "";
  note: string;
};

interface Props {
  form: CommissionFormState;
  onChange: (patch: Partial<CommissionFormState>) => void;
  showTitle?: boolean;
  /** Project commissions only — enables % zo zisku mode. */
  allowPercentMode?: boolean;
  revenueAmount?: number;
  operatingCost?: number;
  revenueKnown?: boolean;
  sourceType?: string | null;
}

export function CommissionFormFields({
  form,
  onChange,
  showTitle = true,
  allowPercentMode = false,
  revenueAmount = 0,
  operatingCost = 0,
  revenueKnown = true,
  sourceType,
}: Props) {
  const { options: implementerOptions, isKnown } = useImplementerSelectOptions(form.implementer);
  const paidMissing = missingCommissionPaidPayoutFields({
    payment_status: form.payment_status,
    payment_form: form.payment_form,
    note: form.note,
    source_type: sourceType,
  });
  const showPaidFieldMarkers =
    form.payment_status === "paid" && requiresCommissionPaidPayoutDetails(sourceType);

  const percentPreview =
    allowPercentMode && form.amount_mode === "percent"
      ? resolveCommissionPersistedAmount({
          amount_mode: "percent",
          amount: form.amount,
          rate_percent: form.rate_percent,
          revenue: revenueAmount,
          operatingCost,
        })
      : null;
  const profitCtx =
    allowPercentMode && form.amount_mode === "percent"
      ? computeProfit({ revenue: revenueAmount, operatingCost })
      : null;

  return (
    <div className="grid gap-3">
      {allowPercentMode && (
        <div>
          <label className="text-xs text-muted-foreground">Typ provízie</label>
          <Select
            value={form.amount_mode}
            onValueChange={(v) =>
              onChange({
                amount_mode: v as CommissionAmountMode,
                ...(v === "fixed" ? { rate_percent: "" } : { amount: "" }),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">{COMMISSION_AMOUNT_MODE_LABELS.fixed}</SelectItem>
              <SelectItem value="percent">{COMMISSION_AMOUNT_MODE_LABELS.percent}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Dátum</label>
          <Input type="date" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
        </div>
        {form.amount_mode === "percent" && allowPercentMode ? (
          <div>
            <label className="text-xs text-muted-foreground">Percento (%)</label>
            <Input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={form.rate_percent}
              onChange={(e) => onChange({ rate_percent: e.target.value })}
            />
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground">Suma (€)</label>
            <Input
              type="number"
              step="0.1"
              value={form.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
            />
          </div>
        )}
      </div>

      {form.amount_mode === "percent" && allowPercentMode && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-1">
          <p className="text-muted-foreground">
            {revenueKnown
              ? formatProfitSummary(profitCtx!)
              : "Zisk nie je známy — pridajte potvrdené platby projektu."}
          </p>
          {percentPreview?.ok ? (
            <p className="font-medium text-foreground">
              Vypočítaná provízia: {fmtEur(percentPreview.amount)} ({form.rate_percent || "0"} % zo zisku)
            </p>
          ) : percentPreview && !percentPreview.ok ? (
            <p className="text-amber-600">{percentPreview.error}</p>
          ) : null}
        </div>
      )}

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

      {paidMissing.length > 0 && (
        <p className="text-xs text-amber-600 border border-amber-500/30 rounded-lg px-3 py-2 bg-amber-500/5">
          Pre stav „vyplatené“ sú povinné:{" "}
          {paidMissing.map((f) => (f === "payment_form" ? "forma úhrady" : "poznámka")).join(" a ")}.
        </p>
      )}

      <div>
        <label className="text-xs text-muted-foreground">
          Forma úhrady
          {showPaidFieldMarkers ? " *" : ""}
        </label>
        <Select
          value={form.payment_form || "none"}
          onValueChange={(v) => onChange({ payment_form: v === "none" ? "" : (v as PaymentFormValue) })}
        >
          <SelectTrigger className={paidMissing.includes("payment_form") ? "border-amber-500" : undefined}>
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
        <label className="text-xs text-muted-foreground">
          Poznámka
          {showPaidFieldMarkers ? " *" : ""}
        </label>
        <NoteTextarea
          value={form.note}
          onChange={(v) => onChange({ note: v })}
          rows={2}
          className={paidMissing.includes("note") ? "border-amber-500" : undefined}
        />
      </div>
    </div>
  );
}
