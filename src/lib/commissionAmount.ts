import { commissionFromProfit, computeProfit } from "@/lib/profit/profitCalculator";
import { parseMoneyInput, roundTo1Decimal } from "@/lib/money/formatMoney";

export type CommissionAmountMode = "fixed" | "percent";

export const COMMISSION_AMOUNT_MODE_LABELS: Record<CommissionAmountMode, string> = {
  fixed: "Pevná suma",
  percent: "Percento zo zisku",
};

export function resolveCommissionPersistedAmount(input: {
  amount_mode: CommissionAmountMode;
  amount: string | number;
  rate_percent: string | number | null | undefined;
  revenue: number;
  operatingCost: number;
}):
  | { ok: true; amount: number; rate_percent: number | null }
  | { ok: false; error: string } {
  if (input.amount_mode === "fixed") {
    const amount = typeof input.amount === "number" ? roundTo1Decimal(input.amount) : parseMoneyInput(input.amount);
    if (amount <= 0) {
      return { ok: false, error: "Zadajte sumu provízie väčšiu ako 0." };
    }
    return { ok: true, amount, rate_percent: null };
  }

  const rate = roundTo1Decimal(Number(String(input.rate_percent ?? "").replace(",", ".")) || 0);
  if (rate <= 0 || rate > 100) {
    return { ok: false, error: "Zadajte percento provízie medzi 0 a 100." };
  }

  const profit = computeProfit({ revenue: input.revenue, operatingCost: input.operatingCost }).profit;
  if (profit <= 0) {
    return {
      ok: false,
      error: "Percentuálna provízia vyžaduje kladný zisk (tržby mínus prevádzkové náklady).",
    };
  }

  return {
    ok: true,
    amount: roundTo1Decimal(commissionFromProfit(profit, rate)),
    rate_percent: rate,
  };
}

export function formatCommissionAmountHint(input: {
  amount_mode: CommissionAmountMode;
  rate_percent?: number | null;
  amount: number;
}): string | null {
  if (input.amount_mode !== "percent" || input.rate_percent == null) return null;
  return `${input.rate_percent}% → ${input.amount.toFixed(1)} €`;
}
