import { describe, expect, it } from "vitest";
import {
  canCreateTaskCommissions,
  canCreateTaskPaymentFacts,
  isTaskFinanceReconciliationCandidate,
  isTaskFinanceReconciliationIssueKind,
} from "@/lib/tasks/taskFinanceCleanup";
import { buildReconciliation } from "@/lib/finance/buildReconciliation";
import { isIssueActionable } from "@/lib/finance/factDrafts";
import { emptyFinanceRawContext } from "@/lib/finance/factDrafts";

describe("taskFinanceCleanup", () => {
  it("blocks new task finance writes", () => {
    expect(canCreateTaskPaymentFacts()).toBe(false);
    expect(canCreateTaskCommissions()).toBe(false);
  });

  it("reconciliation candidate only for legacy finance tasks", () => {
    expect(
      isTaskFinanceReconciliationCandidate({
        amount: 100,
        deposit: 0,
        status: "todo",
      }),
    ).toBe(true);
    expect(
      isTaskFinanceReconciliationCandidate({
        amount: 0,
        deposit: 0,
        status: "in_progress",
      }),
    ).toBe(false);
  });

  it("task reconciliation issues are not actionable in finance UI", () => {
    expect(isTaskFinanceReconciliationIssueKind("task_missing_payment_deposit")).toBe(true);
    const issue = {
      kind: "task_missing_payment_deposit" as const,
      severity: "warn" as const,
      title: "x",
      detail: "y",
      sourceTable: "tasks",
      sourceId: "t-1:deposit",
    };
    expect(isIssueActionable(issue, emptyFinanceRawContext())).toBe(false);
  });

  it("non-legacy task does not generate task payment gap issues", () => {
    const { issues } = buildReconciliation({
      commissions: [],
      expenses: [],
      websites: [],
      payments: [],
      paymentRecords: [],
      payoutRecords: [],
      costRecords: [],
      tasks: [
        {
          id: "t-new",
          title: "Workflow",
          client_name: "K",
          amount: 0,
          deposit: 0,
          status: "paid",
        },
      ],
    });
    expect(issues.some((i) => isTaskFinanceReconciliationIssueKind(i.kind))).toBe(false);
  });
});
