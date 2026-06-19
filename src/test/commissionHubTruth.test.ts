import { describe, it, expect } from "vitest";
import {
  commissionHubStatusLabel,
  commissionHubStatusTone,
  hasConfirmedPayout,
  payoutRecordByCommissionId,
} from "@/lib/customerWorkbench/commissionHubTruth";
import type { PayoutRecord } from "@/lib/customerWorkbench/types";

const payout = (overrides: Partial<PayoutRecord> = {}): PayoutRecord => ({
  id: "po1",
  source_table: "commissions",
  source_id: "comm1",
  implementer: "A",
  amount: 10,
  currency: "EUR",
  paid_at: "2026-01-01",
  reference: null,
  note: null,
  truth_level: "payout_fact",
  ...overrides,
});

describe("commissionHubTruth", () => {
  it("labels workflow paid without payout fact explicitly", () => {
    expect(commissionHubStatusLabel("paid", false)).toContain("workflow");
    expect(commissionHubStatusTone("paid", false)).toBe("warning");
  });

  it("labels workflow paid with payout fact as confirmed", () => {
    expect(commissionHubStatusLabel("paid", true)).toContain("payout_records");
    expect(commissionHubStatusTone("paid", true)).toBe("success");
  });

  it("detects confirmed payout by commission id", () => {
    const payouts = [payout(), payout({ id: "po2", source_id: "comm2", truth_level: "legacy_import" })];
    expect(hasConfirmedPayout("comm1", payouts)).toBe(true);
    expect(hasConfirmedPayout("comm2", payouts)).toBe(true);
    expect(hasConfirmedPayout("comm9", payouts)).toBe(false);
  });

  it("maps payouts by commission source_id", () => {
    const map = payoutRecordByCommissionId([payout()]);
    expect(map.get("comm1")?.id).toBe("po1");
  });
});
