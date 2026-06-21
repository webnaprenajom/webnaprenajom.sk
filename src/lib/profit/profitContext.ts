/**
 * Profit display context with safe fallbacks (Batch RC6.5).
 * Never implies profit when revenue basis is unknown.
 */

import { computeProfit } from "@/lib/profit/profitCalculator";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";

export type ProfitEntityKind = "hosting" | "project" | "marketing" | "customer";

export type ProfitRevenueBasis = "hosting_monthly" | "project_payments" | "unknown";

export type ProfitDisplayStatus =
  | "complete"
  | "no_revenue_yet"
  | "zero_revenue"
  | "cost_without_revenue";

export type ProfitDisplayContext = {
  status: ProfitDisplayStatus;
  revenue: number | null;
  operatingCost: number;
  profit: number | null;
  canShowProfit: boolean;
  headline: string;
  detail: string;
  revenueBasisLabel: string;
};

export type ResolveProfitInput = {
  entityKind: ProfitEntityKind;
  /** When false, revenue was not loaded or has no basis yet. */
  revenueKnown: boolean;
  revenue: number;
  operatingCost?: number;
  paymentRecordCount?: number;
};

export function profitRevenueBasisLabel(kind: ProfitEntityKind): string {
  if (kind === "hosting") return "mesačná cena hostingu";
  if (kind === "customer") return "súčet potvrdených platieb (payment_fact) klienta";
  if (kind === "marketing") return "súčet potvrdených platieb (payment_fact) na kampani";
  return "súčet potvrdených platieb (payment_fact) na projekte";
}

export function resolveProfitDisplayContext(input: ResolveProfitInput): ProfitDisplayContext {
  const operatingCost = Math.max(0, Number(input.operatingCost) || 0);
  const revenue = Math.max(0, Number(input.revenue) || 0);
  const basis = profitRevenueBasisLabel(input.entityKind);

  if (!input.revenueKnown) {
    return {
      status: operatingCost > 0 ? "cost_without_revenue" : "no_revenue_yet",
      revenue: null,
      operatingCost,
      profit: null,
      canShowProfit: false,
      headline: operatingCost > 0 ? "Náklady zadané, tržby nie sú známe" : "Zatiaľ bez údajov o tržbách",
      detail:
        input.entityKind === "project"
          ? "Projekt nemá potvrdené platby (payment_fact) — zisk sa nezobrazuje, aby nevznikol falošný dojem."
          : input.entityKind === "marketing"
            ? "Kampaň nemá potvrdené platby (payment_fact) — zisk sa nezobrazuje, aby nevznikol falošný dojem."
            : input.entityKind === "customer"
              ? "Klient nemá potvrdené platby — zisk sa nezobrazuje, aby nevznikol falošný dojem."
              : "Chýba mesačná cena hostingu — doplnite ju v prehľade.",
      revenueBasisLabel: basis,
    };
  }

  if (revenue === 0 && operatingCost === 0) {
    return {
      status: "no_revenue_yet",
      revenue: 0,
      operatingCost: 0,
      profit: null,
      canShowProfit: false,
      headline: "Zatiaľ bez tržieb a nákladov",
      detail: `Základ ${basis} je zatiaľ 0 €.`,
      revenueBasisLabel: basis,
    };
  }

  if (revenue === 0 && operatingCost > 0) {
    return {
      status: "cost_without_revenue",
      revenue: 0,
      operatingCost,
      profit: null,
      canShowProfit: false,
      headline: "Náklady bez tržieb",
      detail: `Máte ${fmtEur(operatingCost)} nákladov, ale ${basis} je 0 € — zisk nepočítame.`,
      revenueBasisLabel: basis,
    };
  }

  const result = computeProfit({ revenue, operatingCost });
  const status: ProfitDisplayStatus = revenue === 0 ? "zero_revenue" : "complete";

  return {
    status,
    revenue: result.revenue,
    operatingCost: result.operatingCost,
    profit: result.profit,
    canShowProfit: true,
    headline: `${fmtEur(result.profit)} odhadovaný zisk`,
    detail: `Tržby ${fmtEur(result.revenue)} (${basis}) − náklady ${fmtEur(result.operatingCost)}`,
    revenueBasisLabel: basis,
  };
}
