import { sumConfirmedPaymentsForSource } from "@/lib/finance/entityPaymentBridge";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";

export type PaymentCompletenessStatus =
  | "no_agreed_price"
  | "unpaid"
  | "partial"
  | "paid";

export type PaymentCompleteness = {
  status: PaymentCompletenessStatus;
  agreedPrice: number;
  confirmedPaid: number;
  remaining: number;
  overpaid: number;
};

export const PAYMENT_COMPLETENESS_LABELS: Record<PaymentCompletenessStatus, string> = {
  no_agreed_price: "Bez dohodnutej ceny",
  unpaid: "Bez platby",
  partial: "Čiastočne uhradené",
  paid: "Plne uhradené",
};

export const PAYMENT_COMPLETENESS_BADGE_CLASS: Record<PaymentCompletenessStatus, string> = {
  no_agreed_price: "bg-muted text-muted-foreground border-border",
  unpaid: "bg-red-500/15 text-red-500 border-red-500/30",
  partial: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  paid: "bg-green-500/15 text-green-500 border-green-500/30",
};

export function remainingToPay(agreedPrice: number, confirmedPaid: number): number {
  const agreed = Math.max(0, Number(agreedPrice) || 0);
  const confirmed = Math.max(0, Number(confirmedPaid) || 0);
  return Math.max(0, agreed - confirmed);
}

export function resolvePaymentCompleteness(
  agreedPrice: number | null | undefined,
  confirmedPaid: number,
): PaymentCompleteness {
  const agreed = Math.max(0, Number(agreedPrice ?? 0));
  const confirmed = Math.max(0, Number(confirmedPaid) || 0);

  if (agreed <= 0) {
    return { status: "no_agreed_price", agreedPrice: 0, confirmedPaid: confirmed, remaining: 0, overpaid: 0 };
  }
  if (confirmed <= 0) {
    return { status: "unpaid", agreedPrice: agreed, confirmedPaid: 0, remaining: agreed, overpaid: 0 };
  }
  if (confirmed < agreed) {
    return {
      status: "partial",
      agreedPrice: agreed,
      confirmedPaid: confirmed,
      remaining: agreed - confirmed,
      overpaid: 0,
    };
  }
  return {
    status: "paid",
    agreedPrice: agreed,
    confirmedPaid: confirmed,
    remaining: 0,
    overpaid: Math.max(0, confirmed - agreed),
  };
}

export function paymentCompletenessDetail(pc: PaymentCompleteness): string | null {
  if (pc.status === "partial") return `Zostáva ${fmtEur(pc.remaining)}`;
  if (pc.status === "paid" && pc.overpaid > 0) return `Preplatené o ${fmtEur(pc.overpaid)}`;
  if (pc.status === "paid") return `${fmtEur(pc.confirmedPaid)} potvrdených`;
  if (pc.status === "unpaid") return `Dohodnutá cena ${fmtEur(pc.agreedPrice)}`;
  return null;
}

export function reconciliationAgreedPriceDetail(
  entityLabel: string,
  pc: PaymentCompleteness,
): string | null {
  if (pc.status === "unpaid") {
    return `${entityLabel} má dohodnutú cenu ${fmtEur(pc.agreedPrice)} bez potvrdenej platby (payment_fact)`;
  }
  if (pc.status === "partial") {
    return `${entityLabel}: potvrdené ${fmtEur(pc.confirmedPaid)} z ${fmtEur(pc.agreedPrice)} — nedoplatok ${fmtEur(pc.remaining)}`;
  }
  return null;
}

export function buildConfirmedPaymentTotalsBySource(
  rows: Array<{
    source_table?: string | null;
    source_id?: string | null;
    amount: number;
    truth_level: string;
  }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.truth_level !== "payment_fact" || !row.source_table || !row.source_id) continue;
    const key = `${row.source_table}:${row.source_id}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.amount || 0));
  }
  return totals;
}

export function confirmedPaidForEntity(
  totalsBySource: Map<string, number>,
  sourceTable: string,
  sourceId: string,
): number {
  return totalsBySource.get(`${sourceTable}:${sourceId}`) ?? 0;
}

export type DealPaymentEnrichment = PaymentCompleteness;

export function enrichDealPayment(
  agreedFee: number | null | undefined,
  paymentRecords: Array<{
    source_table?: string | null;
    source_id?: string | null;
    amount: number;
    truth_level: string;
  }>,
  sourceTable: string,
  sourceId: string,
): DealPaymentEnrichment {
  const confirmed = sumConfirmedPaymentsForSource(paymentRecords, sourceTable, sourceId);
  return resolvePaymentCompleteness(agreedFee, confirmed);
}
