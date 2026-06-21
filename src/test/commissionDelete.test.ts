import { describe, expect, it } from "vitest";
import { evaluateCommissionDelete } from "@/lib/commissionDelete";

describe("evaluateCommissionDelete", () => {
  it("allows delete when no linked payout", () => {
    expect(evaluateCommissionDelete("c1", [])).toEqual({ canDelete: true, blockReason: null });
  });

  it("blocks delete when payout_records link exists", () => {
    const r = evaluateCommissionDelete("c1", [
      {
        source_table: "commissions",
        source_id: "c1",
        amount: 50,
        paid_at: "2026-06-01",
        truth_level: "payout_fact",
      },
    ]);
    expect(r.canDelete).toBe(false);
    expect(r.blockReason).toContain("payout_records");
  });
});
