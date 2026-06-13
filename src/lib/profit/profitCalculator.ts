/**
 * Profit calculation for commission base (Batch RC6).
 * Formula: profit = max(0, revenue - operatingCost)
 * Commission suggestion uses profit × rate (rate applied by caller).
 */

export type ProfitInput = {
  revenue: number;
  operatingCost?: number;
};

export type ProfitResult = {
  revenue: number;
  operatingCost: number;
  profit: number;
  marginPct: number | null;
};

export function computeProfit(input: ProfitInput): ProfitResult {
  const revenue = Math.max(0, Number(input.revenue) || 0);
  const operatingCost = Math.max(0, Number(input.operatingCost) || 0);
  const profit = Math.max(0, revenue - operatingCost);
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  return { revenue, operatingCost, profit, marginPct };
}

/** Commission amount from profit and percentage rate. */
export function commissionFromProfit(profit: number, ratePct: number): number {
  const p = Math.max(0, profit);
  const rate = Math.max(0, Number(ratePct) || 0);
  return (p * rate) / 100;
}

/** Rental JSON implementer row paid amount from profit workflow. */
export function rentalImplementerPaidFromWorkflow(
  monthlyPaidTotal: number,
  percentage: number,
  operatingCostShare = 0,
): number {
  const profit = computeProfit({ revenue: monthlyPaidTotal, operatingCost: operatingCostShare });
  return commissionFromProfit(profit.profit, percentage);
}

export function formatProfitSummary(result: ProfitResult): string {
  return `${result.profit.toFixed(2)} € zisk (tržby ${result.revenue.toFixed(2)} € − náklady ${result.operatingCost.toFixed(2)} €)`;
}
