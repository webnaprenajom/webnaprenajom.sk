import { Badge } from "@/components/ui/badge";
import {
  PAYMENT_COMPLETENESS_BADGE_CLASS,
  PAYMENT_COMPLETENESS_LABELS,
  paymentCompletenessDetail,
  resolvePaymentCompleteness,
  type PaymentCompleteness,
} from "@/lib/finance/paymentCompleteness";

type Props = {
  agreedPrice: number | null | undefined;
  confirmedPaid: number;
  compact?: boolean;
  /** Pre-resolved value — skips recompute when parent already has it. */
  completeness?: PaymentCompleteness;
};

export function PaymentCompletenessBadge({
  agreedPrice,
  confirmedPaid,
  compact = false,
  completeness,
}: Props) {
  const pc = completeness ?? resolvePaymentCompleteness(agreedPrice, confirmedPaid);
  const detail = paymentCompletenessDetail(pc);

  return (
    <div className={compact ? "inline-flex flex-col gap-0.5" : "space-y-0.5"}>
      <Badge variant="outline" className={`text-[10px] ${PAYMENT_COMPLETENESS_BADGE_CLASS[pc.status]}`}>
        {PAYMENT_COMPLETENESS_LABELS[pc.status]}
      </Badge>
      {detail && !compact && (
        <p className="text-[10px] text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}
