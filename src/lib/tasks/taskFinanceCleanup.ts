/**
 * Task finance cleanup (Batch 3) — tasks are not a source of new finance facts.
 */
import { isLegacyTaskFinance } from "@/lib/tasks/taskFinanceModel";

export const TASK_FINANCE_ROUTING_NOTE =
  "Financie (platby, provízie) patria na nadradenú entitu. Úloha je len workflow — existujúce task záznamy vo financiách sú legacy a len na čítanie.";

export const TASK_COMMISSION_LEGACY_HINT =
  "Nové provízie vytvárajte na projekte, marketingu, prenájme, hostingu alebo u zákazníka — nie na úlohe.";

export const TASK_PAYMENT_LEGACY_HINT =
  "Nové platby potvrdzujte na nadradenej entite (záložka Platby). Task platby sú legacy.";

/** Batch 3: žiadne nové payment_records zo task UI. */
export function canCreateTaskPaymentFacts(): boolean {
  return false;
}

/** Batch 3: žiadne nové commissions so source_type=task. */
export function canCreateTaskCommissions(): boolean {
  return false;
}

/** Reconciliation task finance gaps len pre legacy billing úlohy. */
export function isTaskFinanceReconciliationCandidate(task: {
  amount?: number | null;
  deposit?: number | null;
  status?: string | null;
}): boolean {
  return isLegacyTaskFinance(task);
}

export function isTaskFinanceReconciliationIssueKind(
  kind: string,
): kind is "task_missing_payment_deposit" | "task_missing_payment_full" {
  return kind === "task_missing_payment_deposit" || kind === "task_missing_payment_full";
}
