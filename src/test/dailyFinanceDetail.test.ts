import { describe, expect, it } from "vitest";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildDailyCommissionDetailRows,
  buildDailyCostDetailRows,
  groupDailyFinanceDetailRows,
  summarizeDailyCommissionRows,
  summarizeDailyCostRows,
} from "@/lib/finance/dailyFinanceDetail";

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

describe("dailyFinanceDetail", () => {
  it("builds commission rows without duplicates across rental JSON + commission", () => {
    const rows = buildDailyCommissionDetailRows({
      year: 2026,
      scopeImplementer: null,
      commissions: [
        baseCommission({
          id: "c-rental",
          source_type: "rental",
          source_id: "w1",
          amount: 300,
          date: "2026-12-31",
        }),
      ],
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
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceLabel).toMatch(/Prenájom/i);
    expect(rows[0].amount).toBe(1200);
    expect(rows[0].counterpartyName).toBe("Peter");
  });

  it("summary totals match row sums for commissions", () => {
    const rows = buildDailyCommissionDetailRows({
      year: 2026,
      scopeImplementer: null,
      commissions: [
        baseCommission({ id: "c-h", source_type: "hosting", source_id: "h1", amount: 50 }),
        baseCommission({ id: "c-m", source_type: "marketing", source_id: "m1", amount: 80, implementer: "Anna" }),
      ],
      payoutRecords: [{ id: "p1", source_table: "commissions", source_id: "c-h", amount: 50, paid_at: "2026-06-15", truth_level: "payout_fact", implementer: "Peter" }],
      websites: [],
      payments: [],
    });
    const summary = summarizeDailyCommissionRows(rows);
    const potential = rows.reduce((s, r) => s + r.amount, 0);
    const paid = rows.reduce((s, r) => s + r.paidAmount, 0);
    const remaining = rows.reduce((s, r) => s + r.remainingAmount, 0);
    expect(summary.rowCount).toBe(rows.length);
    expect(summary.potential).toBe(potential);
    expect(summary.paid).toBe(paid);
    expect(summary.remaining).toBe(remaining);
  });

  it("filters cost records by year and summarizes fact vs legacy", () => {
    const rows = buildDailyCostDetailRows(
      [
        {
          id: "cr1",
          amount: 100,
          paid_at: "2026-03-01",
          category: "Hosting",
          truth_level: "cost_fact",
          source_table: "expenses",
          source_id: "e1",
        },
        {
          id: "cr2",
          amount: 40,
          incurred_at: "2025-12-31",
          category: "Staré",
          truth_level: "legacy_import",
        },
        {
          id: "cr3",
          amount: 25,
          paid_at: "2026-08-01",
          vendor: "Dodávateľ",
          truth_level: "legacy_import",
        },
      ],
      2026,
    );
    expect(rows).toHaveLength(2);
    const summary = summarizeDailyCostRows(rows);
    expect(summary.total).toBe(125);
    expect(summary.confirmed).toBe(100);
    expect(summary.legacy).toBe(25);
  });

  it("maps cost source labels from linked entity table", () => {
    const rows = buildDailyCostDetailRows(
      [
        {
          id: "cr-h",
          amount: 30,
          paid_at: "2026-01-10",
          truth_level: "cost_fact",
          source_table: "hosting_records",
          source_id: "h1",
          category: "Hosting mesačne",
        },
      ],
      2026,
    );
    expect(rows[0].sourceLabel).toBe("Hosting");
    expect(rows[0].sourceType).toBe("hosting");
  });

  it("groups rows by sourceLabel for drilldown sections", () => {
    const groups = groupDailyFinanceDetailRows([
      {
        id: "1",
        kind: "cost",
        sourceType: "hosting",
        sourceLabel: "Hosting",
        sourceTitle: "A",
        customerName: null,
        counterpartyName: null,
        amount: 10,
        paidAmount: 10,
        remainingAmount: 0,
        status: "ok",
        occurredAt: "2026-01-01",
        linkedSourceTable: null,
        linkedSourceId: null,
        note: null,
        reference: null,
        truthLevel: "cost_fact",
      },
      {
        id: "2",
        kind: "cost",
        sourceType: "project",
        sourceLabel: "Projekty",
        sourceTitle: "B",
        customerName: null,
        counterpartyName: null,
        amount: 20,
        paidAmount: 20,
        remainingAmount: 0,
        status: "ok",
        occurredAt: "2026-02-01",
        linkedSourceTable: null,
        linkedSourceId: null,
        note: null,
        reference: null,
        truthLevel: "cost_fact",
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.sourceLabel).sort()).toEqual(["Hosting", "Projekty"]);
  });
});
