import { describe, expect, it } from "vitest";
import {
  filterPrimaryReconciliationIssues,
  summarizeReconciliationIssueCounts,
} from "@/lib/finance/issuePresentation";
import { emptyFinanceRawContext } from "@/lib/finance/factDrafts";
import type { ReconciliationIssue } from "@/lib/finance/types";

describe("issuePresentation", () => {
  const ctx = emptyFinanceRawContext();

  it("filters task and ahead-of-workflow issues from primary view", () => {
    const issues: ReconciliationIssue[] = [
      {
        kind: "workflow_incoming",
        title: "Rental",
        severity: "warn",
        sourceTable: "rental_payments",
        sourceId: "p1",
      },
      {
        kind: "task_missing_payment_deposit",
        title: "Task",
        severity: "info",
        sourceTable: "tasks",
        sourceId: "t1",
      },
      {
        kind: "entity_payment_ahead_of_workflow",
        title: "Ahead",
        severity: "info",
      },
    ];
    expect(filterPrimaryReconciliationIssues(issues)).toHaveLength(1);
    expect(filterPrimaryReconciliationIssues(issues)[0].kind).toBe("workflow_incoming");
  });

  it("tiers actionable vs advisory vs hidden legacy counts", () => {
    const issues: ReconciliationIssue[] = [
      {
        kind: "workflow_incoming",
        title: "Rental",
        severity: "warn",
        sourceTable: "rental_payments",
        sourceId: "p1",
        amount: 100,
      },
      {
        kind: "potential_duplicate",
        title: "Dup",
        severity: "warn",
        recordId: "r1",
        amount: 50,
      },
      {
        kind: "task_missing_payment_full",
        title: "Task",
        severity: "info",
        sourceTable: "tasks",
        sourceId: "t2",
      },
    ];
    const summary = summarizeReconciliationIssueCounts(issues, new Set(), ctx);
    expect(summary.activeTotal).toBe(3);
    expect(summary.primaryActiveCount).toBe(2);
    expect(summary.hiddenLegacyCount).toBe(1);
    expect(summary.actionableCount).toBe(1);
    expect(summary.advisoryCount).toBe(1);
  });
});
