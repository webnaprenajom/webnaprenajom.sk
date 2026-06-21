import { describe, expect, it } from "vitest";
import {
  evaluateEntityPaymentDeleteFromData,
} from "@/lib/finance/entityPaymentDelete";

describe("evaluateEntityPaymentDeleteFromData", () => {
  it("allows delete when no commissions", () => {
    const r = evaluateEntityPaymentDeleteFromData("project_notes", "p-1", [], []);
    expect(r.canDelete).toBe(true);
    expect(r.blockReason).toBeNull();
  });

  it("allows delete when commissions exist but no payout_records", () => {
    const r = evaluateEntityPaymentDeleteFromData(
      "hosting_records",
      "h-1",
      [{ id: "c-1" }],
      [],
    );
    expect(r.canDelete).toBe(true);
  });

  it("blocks delete when audited payout exists on entity commission", () => {
    const r = evaluateEntityPaymentDeleteFromData(
      "marketing_records",
      "m-1",
      [{ id: "c-1" }],
      [
        {
          source_table: "commissions",
          source_id: "c-1",
          amount: 50,
          paid_at: "2026-01-01",
          truth_level: "payout_fact",
        },
      ],
    );
    expect(r.canDelete).toBe(false);
    expect(r.blockReason).toMatch(/auditovaná výplata provízie/i);
  });

  it("allows delete when payout belongs to unrelated commission", () => {
    const r = evaluateEntityPaymentDeleteFromData(
      "project_notes",
      "p-1",
      [{ id: "c-1" }],
      [
        {
          source_table: "commissions",
          source_id: "c-other",
          amount: 50,
          paid_at: "2026-01-01",
          truth_level: "payout_fact",
        },
      ],
    );
    expect(r.canDelete).toBe(true);
  });
});
