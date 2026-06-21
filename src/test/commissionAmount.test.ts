import { describe, expect, it } from "vitest";
import { resolveCommissionPersistedAmount } from "@/lib/commissionAmount";

describe("resolveCommissionPersistedAmount", () => {
  it("persists fixed amount", () => {
    const r = resolveCommissionPersistedAmount({
      amount_mode: "fixed",
      amount: "150,5",
      rate_percent: null,
      revenue: 1000,
      operatingCost: 200,
    });
    expect(r).toEqual({ ok: true, amount: 150.5, rate_percent: null });
  });

  it("computes percent from profit base", () => {
    const r = resolveCommissionPersistedAmount({
      amount_mode: "percent",
      amount: "",
      rate_percent: "30",
      revenue: 1000,
      operatingCost: 200,
    });
    expect(r).toEqual({ ok: true, amount: 240, rate_percent: 30 });
  });

  it("rejects percent when profit is zero", () => {
    const r = resolveCommissionPersistedAmount({
      amount_mode: "percent",
      amount: "",
      rate_percent: "10",
      revenue: 0,
      operatingCost: 0,
    });
    expect(r.ok).toBe(false);
  });
});
