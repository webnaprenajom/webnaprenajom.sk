import { describe, expect, it } from "vitest";
import {
  canConfirmCommissionPayoutReceipt,
  isReconciliationIssueActionableForUser,
  reconciliationIssueBlockedHint,
  resolveCommissionImplementerFromIssue,
} from "@/lib/finance/commissionPayoutReceipt";
import { emptyFinanceRawContext } from "@/lib/finance/factDrafts";

const owner = { role: "owner" as const, userId: "o1", implementerName: null };
const peter = { role: "administrator" as const, userId: "u1", implementerName: "Peter" };

describe("commission payout receipt permissions", () => {
  it("owner cannot confirm receipt", () => {
    expect(canConfirmCommissionPayoutReceipt(owner, "Peter")).toBe(false);
  });

  it("assigned realizator can confirm own commission", () => {
    expect(canConfirmCommissionPayoutReceipt(peter, "Peter")).toBe(true);
    expect(canConfirmCommissionPayoutReceipt(peter, "Maroš")).toBe(false);
  });

  it("blocks Zladenie commission payout for owner with hint", () => {
    const ctx = {
      ...emptyFinanceRawContext(),
      commissions: [{ id: "c-1", implementer: "Peter", amount: 100, payment_status: "paid" }],
    };
    const issue = {
      kind: "workflow_outgoing_commission" as const,
      title: "Provízia",
      detail: "test",
      sourceId: "c-1",
      severity: "warn" as const,
    };
    expect(isReconciliationIssueActionableForUser(issue, ctx, owner)).toBe(false);
    expect(reconciliationIssueBlockedHint(issue, ctx, owner)).toMatch(/realizátora/i);
    expect(resolveCommissionImplementerFromIssue(issue, ctx)).toBe("Peter");
  });

  it("allows realizator to act on own commission payout issue", () => {
    const ctx = {
      ...emptyFinanceRawContext(),
      commissions: [{ id: "c-1", implementer: "Peter", amount: 100, payment_status: "paid" }],
    };
    const issue = {
      kind: "workflow_outgoing_commission" as const,
      title: "Provízia",
      detail: "test",
      sourceId: "c-1",
      severity: "warn" as const,
    };
    expect(isReconciliationIssueActionableForUser(issue, ctx, peter)).toBe(true);
  });

  it("entity payment issues are not actionable in Zladenie", () => {
    const issue = {
      kind: "entity_missing_payment_fact" as const,
      title: "Projekt",
      detail: "missing",
      sourceId: "p-1",
      severity: "warn" as const,
    };
    expect(isReconciliationIssueActionableForUser(issue, emptyFinanceRawContext(), owner)).toBe(
      false,
    );
  });
});
