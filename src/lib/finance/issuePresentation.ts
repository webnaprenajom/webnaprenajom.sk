/**
 * Finance reconciliation UI tiers — presentation only, no engine changes.
 */
import type { ReconciliationIssue } from "./types";
import { buildIssueKey, filterActiveIssues } from "./issueKeys";
import { isIssueActionable, type FinanceRawContext } from "./factDrafts";
import { isTaskFinanceReconciliationIssueKind } from "@/lib/tasks/taskFinanceCleanup";

/** Legacy / info-only kinds — hidden from primary owner reconciliation flow. */
export const FINANCE_PRIMARY_HIDDEN_ISSUE_KINDS = new Set<ReconciliationIssue["kind"]>([
  "task_missing_payment_deposit",
  "task_missing_payment_full",
  "entity_payment_ahead_of_workflow",
]);

export function isFinancePrimaryHiddenIssue(issue: ReconciliationIssue): boolean {
  return FINANCE_PRIMARY_HIDDEN_ISSUE_KINDS.has(issue.kind);
}

export function filterPrimaryReconciliationIssues<T extends ReconciliationIssue>(issues: T[]): T[] {
  return issues.filter((i) => !isFinancePrimaryHiddenIssue(i));
}

export type ReconciliationIssueSummary = {
  /** All non-dismissed issues (raw). */
  activeTotal: number;
  /** Active issues visible in primary owner UI (no legacy task noise). */
  primaryActiveCount: number;
  /** Primary active issues with a reconciliation CTA. */
  actionableCount: number;
  /** Primary active issues without CTA (dismiss-only / info). */
  advisoryCount: number;
  /** Active legacy task/info issues (collapsed debug). */
  hiddenLegacyCount: number;
};

export function summarizeReconciliationIssueCounts(
  issues: ReconciliationIssue[],
  dismissedKeys: Set<string>,
  ctx: FinanceRawContext,
): ReconciliationIssueSummary {
  const active = filterActiveIssues(
    issues.map((i) => ({ ...i, issueKey: buildIssueKey(i) })),
    dismissedKeys,
  );
  const primaryActive = filterPrimaryReconciliationIssues(active);
  const actionable = primaryActive.filter((i) => isIssueActionable(i, ctx));
  const advisory = primaryActive.filter((i) => !isIssueActionable(i, ctx));
  const hiddenLegacy = active.filter((i) => isFinancePrimaryHiddenIssue(i));

  return {
    activeTotal: active.length,
    primaryActiveCount: primaryActive.length,
    actionableCount: actionable.length,
    advisoryCount: advisory.length,
    hiddenLegacyCount: hiddenLegacy.length,
  };
}

export function isFinanceLegacyTaskIssueKind(kind: string): boolean {
  return isTaskFinanceReconciliationIssueKind(kind);
}
