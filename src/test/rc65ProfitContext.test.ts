import { describe, expect, it } from "vitest";
import { resolveProfitDisplayContext } from "@/lib/profit/profitContext";

describe("rc6.5 profit context", () => {
  it("does not show profit when project revenue is unknown", () => {
    const ctx = resolveProfitDisplayContext({
      entityKind: "project",
      revenueKnown: false,
      revenue: 0,
      operatingCost: 50,
    });
    expect(ctx.canShowProfit).toBe(false);
    expect(ctx.status).toBe("cost_without_revenue");
    expect(ctx.profit).toBeNull();
  });

  it("shows complete profit when revenue and cost are known", () => {
    const ctx = resolveProfitDisplayContext({
      entityKind: "hosting",
      revenueKnown: true,
      revenue: 100,
      operatingCost: 30,
    });
    expect(ctx.canShowProfit).toBe(true);
    expect(ctx.profit).toBe(70);
  });

  it("handles zero revenue with zero cost as no data yet", () => {
    const ctx = resolveProfitDisplayContext({
      entityKind: "project",
      revenueKnown: true,
      revenue: 0,
      operatingCost: 0,
      paymentRecordCount: 0,
    });
    expect(ctx.canShowProfit).toBe(false);
    expect(ctx.status).toBe("no_revenue_yet");
  });
});
