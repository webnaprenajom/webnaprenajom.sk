import { describe, expect, it } from "vitest";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildImplementerCommissionViewRows,
  filterImplementerCommissionRowsByTab,
  summarizeImplementerCommissionViewRows,
} from "@/lib/finance/implementerCommissionView";

const baseCommission = (over: Partial<CommissionRow>): CommissionRow =>
  ({
    id: "c1",
    title: "Test",
    implementer: "Peter",
    amount: 100,
    payment_status: "unpaid",
    note: null,
    date: "2026-06-01",
    ...over,
  }) as CommissionRow;

describe("implementerCommissionView", () => {
  it("merges rental JSON and materialized commission into one rental row", () => {
    const commissions: CommissionRow[] = [
      baseCommission({
        id: "c-rental",
        source_type: "rental",
        source_id: "w1",
        amount: 300,
        date: "2026-12-31",
      }),
    ];
    const rows = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions,
      payoutRecords: [],
      websites: [
        {
          id: "w1",
          name: "web.sk",
          monthly_price: 100,
          implementers: [{ name: "Peter", percentage: 100, payment_status: "unpaid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 1, status: "paid" }],
    });
    const rentalRows = filterImplementerCommissionRowsByTab(rows, "rental");
    expect(rentalRows).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rentalRows[0].potentialAmount).toBe(1200);
    expect(rentalRows[0].paidAmount).toBe(0);
  });

  it("partitions rows by source tab without duplicates in all", () => {
    const commissions: CommissionRow[] = [
      baseCommission({ id: "c-h", source_type: "hosting", source_id: "h1", title: "Hosting A" }),
      baseCommission({ id: "c-m", source_type: "marketing", source_id: "m1", title: "Kampaň" }),
      baseCommission({ id: "c-p", source_type: "project", source_id: "p1", title: "Projekt X" }),
    ];
    const rows = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions,
      payoutRecords: [],
      websites: [],
      payments: [],
    });
    expect(rows).toHaveLength(3);
    expect(filterImplementerCommissionRowsByTab(rows, "all")).toHaveLength(3);
    expect(filterImplementerCommissionRowsByTab(rows, "hosting")).toHaveLength(1);
    expect(filterImplementerCommissionRowsByTab(rows, "marketing")).toHaveLength(1);
    expect(filterImplementerCommissionRowsByTab(rows, "project")).toHaveLength(1);
    expect(filterImplementerCommissionRowsByTab(rows, "rental")).toHaveLength(0);
  });

  it("computes paid/remaining from payout_records", () => {
    const commissions: CommissionRow[] = [
      baseCommission({ id: "c1", source_type: "project", source_id: "p1", amount: 300 }),
    ];
    const rows = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions,
      payoutRecords: [
        {
          id: "p1",
          source_table: "commissions",
          source_id: "c1",
          amount: 100,
          paid_at: "2026-06-15T12:00:00Z",
          truth_level: "payout_fact",
        },
      ],
      websites: [],
      payments: [],
    });
    expect(rows[0].paidAmount).toBe(100);
    expect(rows[0].remainingAmount).toBe(200);
    expect(rows[0].payoutStatus).toBe("partially_paid");
    expect(rows[0].payoutHistory).toHaveLength(1);
  });

  it("tab totals match visible row set", () => {
    const commissions: CommissionRow[] = [
      baseCommission({ id: "c1", amount: 200, source_type: "hosting", source_id: "h1" }),
      baseCommission({ id: "c2", amount: 100, source_type: "marketing", source_id: "m1" }),
    ];
    const all = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions,
      payoutRecords: [],
      websites: [],
      payments: [],
    });
    const hosting = filterImplementerCommissionRowsByTab(all, "hosting");
    const allSum = summarizeImplementerCommissionViewRows(all);
    const hostingSum = summarizeImplementerCommissionViewRows(hosting);
    expect(allSum.potential).toBe(300);
    expect(hostingSum.potential).toBe(200);
    expect(hostingSum.count).toBe(1);
  });

  it("workflow paid does not inflate audited paid total", () => {
    const commissions: CommissionRow[] = [
      baseCommission({
        id: "c1",
        source_type: "project",
        source_id: "p1",
        payment_status: "paid",
        amount: 150,
      }),
    ];
    const rows = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions,
      payoutRecords: [],
      websites: [],
      payments: [],
    });
    const sum = summarizeImplementerCommissionViewRows(rows);
    expect(sum.paid).toBe(0);
    expect(rows[0].workflowPaidUnaudited).toBe(true);
  });
});
