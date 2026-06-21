import { describe, expect, it } from "vitest";
import {
  commissionFromProfit,
  computeProfit,
  formatProfitSummary,
  rentalImplementerPaidFromWorkflow,
} from "@/lib/profit/profitCalculator";

describe("rc6 profit calculator", () => {
  it("computes profit as revenue minus operating cost floored at zero", () => {
    expect(computeProfit({ revenue: 100, operatingCost: 30 }).profit).toBe(70);
    expect(computeProfit({ revenue: 50, operatingCost: 80 }).profit).toBe(0);
  });

  it("derives commission from profit and rate", () => {
    expect(commissionFromProfit(200, 10)).toBe(20);
    expect(commissionFromProfit(-10, 50)).toBe(0);
  });

  it("formats profit summary for UI", () => {
    const s = formatProfitSummary(computeProfit({ revenue: 120, operatingCost: 20 }));
    expect(s).toContain("100.0");
    expect(s).toContain("120.0");
  });

  it("applies rental workflow profit before percentage", () => {
    const paid = rentalImplementerPaidFromWorkflow(1000, 10, 200);
    expect(paid).toBe(80);
  });
});
