import type { ReconciliationIssue } from "./types";

/** Stable key for dismissal matching — does not mutate source data. */
export function buildIssueKey(issue: ReconciliationIssue): string {
  const parts: string[] = [issue.kind];
  if (issue.sourceTable && issue.sourceId) {
    parts.push(issue.sourceTable, issue.sourceId);
  }
  if (issue.recordId) {
    parts.push(issue.recordId);
  }
  if (issue.kind === "potential_duplicate") {
    parts.push(issue.title, issue.detail);
  } else if (!issue.sourceId && !issue.recordId) {
    parts.push(issue.title, String(issue.amount ?? ""));
  }
  return parts.join("|");
}

export function withIssueKeys<T extends ReconciliationIssue>(issues: T[]): (T & { issueKey: string })[] {
  return issues.map((issue) => ({ ...issue, issueKey: buildIssueKey(issue) }));
}

export function filterActiveIssues<T extends ReconciliationIssue & { issueKey?: string }>(
  issues: T[],
  dismissedKeys: Set<string>,
): T[] {
  return issues.filter((issue) => {
    const key = issue.issueKey ?? buildIssueKey(issue);
    return !dismissedKeys.has(key);
  });
}

export type DismissalType = "dismissed" | "false_positive";

export const DISMISSABLE_ISSUE_KINDS = new Set([
  "potential_duplicate",
  "missing_counterparty",
  "legacy_no_reference",
  "legacy_imprecise_paid_at",
]);

export function isIssueDismissable(issue: ReconciliationIssue): boolean {
  return DISMISSABLE_ISSUE_KINDS.has(issue.kind);
}
