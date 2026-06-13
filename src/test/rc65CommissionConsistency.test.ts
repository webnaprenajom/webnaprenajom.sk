import { describe, expect, it } from "vitest";
import {
  classifyCommissionSource,
  detectRentalDualModelWarning,
  paidTotal,
  unpaidTotal,
} from "@/lib/finance/commissionConsistency";

describe("rc6.5 commission consistency", () => {
  it("classifies normalized vs legacy", () => {
    expect(classifyCommissionSource({ source_type: "rental", source_id: "x" })).toBe("normalized");
    expect(classifyCommissionSource({})).toBe("legacy");
  });

  it("warns on rental dual model", () => {
    const w = detectRentalDualModelWarning("Peter", 2, 3);
    expect(w).toContain("Peter");
    expect(w).toContain("JSON");
  });

  it("totals respect payment_status", () => {
    const rows = [
      { amount: 10, payment_status: "paid" },
      { amount: 5, payment_status: "unpaid" },
    ];
    expect(paidTotal(rows)).toBe(10);
    expect(unpaidTotal(rows)).toBe(5);
  });
});
