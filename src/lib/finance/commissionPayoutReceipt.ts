/**
 * Commission payout receipt confirmation — Zladenie + reconciliation helpers.
 */
import type { AccessContext } from "@/lib/rbac/permissions";
import { isAdministrator, isOwner } from "@/lib/rbac/permissions";
import {
  canConfirmCommissionPayoutReceipt,
  commissionPayoutReceiptDeniedMessage,
} from "@/lib/rbac/writePermissions";
import type { FinanceRawContext } from "@/lib/finance/factDrafts";
import type { ReconciliationIssue } from "@/lib/finance/types";
import { isIssueActionable } from "@/lib/finance/factDrafts";

export { canConfirmCommissionPayoutReceipt, commissionPayoutReceiptDeniedMessage };

export function resolveCommissionImplementerFromIssue(
  issue: ReconciliationIssue,
  ctx: FinanceRawContext,
): string | null {
  if (issue.kind !== "workflow_outgoing_commission" || !issue.sourceId) return null;
  const row = ctx.commissions.find((c) => c.id === issue.sourceId);
  return row?.implementer ?? null;
}

/** Zladenie CTA — commission payout receipt is realizator-only; entity payments no longer need approval. */
export function isReconciliationIssueActionableForUser(
  issue: ReconciliationIssue,
  financeCtx: FinanceRawContext,
  access: AccessContext,
): boolean {
  if (!isIssueActionable(issue, financeCtx)) return false;
  if (issue.kind === "entity_missing_payment_fact" || issue.kind === "entity_partial_payment") {
    return false;
  }
  if (issue.kind === "workflow_outgoing_commission") {
    const implementer = resolveCommissionImplementerFromIssue(issue, financeCtx);
    return canConfirmCommissionPayoutReceipt(access, implementer);
  }
  return true;
}

export function reconciliationIssueBlockedHint(
  issue: ReconciliationIssue,
  financeCtx: FinanceRawContext,
  access: AccessContext,
): string | null {
  if (issue.kind === "entity_missing_payment_fact" || issue.kind === "entity_partial_payment") {
    return "Platby zadáva owner priamo v detaile dealu — Zladenie už nepotvrdzuje entity platby.";
  }
  if (issue.kind === "workflow_outgoing_commission" && isOwner(access.role)) {
    const implementer = resolveCommissionImplementerFromIssue(issue, financeCtx);
    return implementer
      ? `Čaká na potvrdenie realizátora (${implementer}).`
      : "Čaká na potvrdenie realizátora.";
  }
  if (
    issue.kind === "workflow_outgoing_commission" &&
    isAdministrator(access.role) &&
    !canConfirmCommissionPayoutReceipt(access, resolveCommissionImplementerFromIssue(issue, financeCtx))
  ) {
    return commissionPayoutReceiptDeniedMessage();
  }
  return null;
}
