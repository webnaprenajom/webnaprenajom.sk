import { describe, expect, it } from "vitest";
import {
  implementerPaidDisplayTotal,
  implementerTotalsFromCommissionPayouts,
  resolveImplementerFinanceTruthLevel,
} from "@/lib/finance/commissionPayoutStatus";

describe("implementerTotalsFromCommissionPayouts", () => {
  it("uses audited payout amount without double-counting workflow paid commission", () => {
    const totals = implementerTotalsFromCommissionPayouts(
      [{ id: "c1", implementer: "Jan", amount: 100, payment_status: "paid" }],
      [
        {
          source_table: "commissions",
          source_id: "c1",
          amount: 95,
          paid_at: "2026-06-01",
          truth_level: "payout_fact",
          implementer: "Jan",
        },
      ],
    );
    const jan = totals.get("Jan");
    expect(jan?.paidAudited).toBe(95);
    expect(jan?.paidWorkflowUnaudited).toBe(0);
    expect(implementerPaidDisplayTotal(jan!)).toBe(95);
    expect(resolveImplementerFinanceTruthLevel(jan!)).toBe("payout_fact");
  });

  it("counts workflow paid when no linked payout exists", () => {
    const totals = implementerTotalsFromCommissionPayouts(
      [{ id: "c2", implementer: "Eva", amount: 50, payment_status: "paid" }],
      [],
    );
    const eva = totals.get("Eva");
    expect(eva?.paidWorkflowUnaudited).toBe(50);
    expect(eva?.paidAudited).toBe(0);
    expect(resolveImplementerFinanceTruthLevel(eva!)).toBe("workflow_only");
  });

  it("includes orphan rental payout by implementer when commission row is missing", () => {
    const totals = implementerTotalsFromCommissionPayouts(
      [],
      [
        {
          source_table: "commissions",
          source_id: "missing",
          amount: 80,
          paid_at: "2026-06-15",
          truth_level: "payout_fact",
          implementer: "Peter",
        },
      ],
    );
    expect(totals.get("Peter")?.paidAudited).toBe(80);
    expect(totals.get("Peter")?.lineCount).toBe(1);
  });

  it("counts rental-linked commission with audited payout for implementer", () => {
    const totals = implementerTotalsFromCommissionPayouts(
      [
        {
          id: "rental-c",
          implementer: "Maroš",
          amount: 120,
          payment_status: "paid",
        },
      ],
      [
        {
          source_table: "commissions",
          source_id: "rental-c",
          amount: 120,
          paid_at: "2026-06-19",
          truth_level: "payout_fact",
          implementer: "Maroš",
        },
      ],
    );
    const row = totals.get("Maroš");
    expect(row?.paidAudited).toBe(120);
    expect(row?.unpaid).toBe(0);
    expect(implementerPaidDisplayTotal(row!)).toBe(120);
  });
});
