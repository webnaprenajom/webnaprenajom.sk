/**
 * Task finance deprecation (Batch 1) — tasks are workflow objects; billing lives on parent entities.
 * ponytail: DB columns amount/deposit remain; UI blocks new finance usage.
 */

export const TASK_WORKFLOW_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskWorkflowStatus = (typeof TASK_WORKFLOW_STATUSES)[number];

/** Billing-oriented workflow values kept for legacy rows only. */
export const TASK_LEGACY_FINANCE_STATUSES = [
  "deposit_received",
  "send_final_invoice",
  "paid",
] as const;
export type TaskLegacyFinanceStatus = (typeof TASK_LEGACY_FINANCE_STATUSES)[number];

export const TASK_FINANCE_DEPRECATION_NOTE =
  "Úloha je operatívny workflow objekt. Financie (suma, záloha, platby) patria na nadradenú entitu — projekt, marketing, prenájom, hosting alebo klienta. " +
  "Existujúce úlohy so sumou alebo billing stavom zostávajú len na čítanie.";

export function isLegacyTaskFinance(task: {
  amount?: number | null;
  deposit?: number | null;
  status?: string | null;
}): boolean {
  if (Number(task.amount ?? 0) > 0 || Number(task.deposit ?? 0) > 0) return true;
  return TASK_LEGACY_FINANCE_STATUSES.includes(task.status as TaskLegacyFinanceStatus);
}

export function isTaskFinanceStatus(status: string): status is TaskLegacyFinanceStatus {
  return (TASK_LEGACY_FINANCE_STATUSES as readonly string[]).includes(status);
}

/** Status picker options: legacy finance states only when editing a legacy task. */
export function taskStatusOptionsForForm(
  existing?: { status: string; amount?: number | null; deposit?: number | null } | null,
): string[] {
  const base = [...TASK_WORKFLOW_STATUSES];
  if (existing && isLegacyTaskFinance(existing)) {
    return [...base, ...TASK_LEGACY_FINANCE_STATUSES];
  }
  return base;
}

export function normalizeTaskFinancePayload(
  input: {
    status: string;
    amount?: number | null;
    deposit?: number | null;
  },
  existing?: { status: string; amount?: number | null; deposit?: number | null } | null,
): { status: string; amount: number; deposit: number } {
  if (existing && isLegacyTaskFinance(existing)) {
    return {
      status: input.status,
      amount: Number(existing.amount ?? 0),
      deposit: Number(existing.deposit ?? 0),
    };
  }
  const status = isTaskFinanceStatus(input.status) ? "todo" : input.status;
  return { status, amount: 0, deposit: 0 };
}

/** Minimum parent context today: customer, lead, or client name (project/hosting FK not in schema yet). */
export function taskParentLinkError(fields: {
  customer_id?: string | null;
  lead_id?: string | null;
  client_name?: string | null;
}): string | null {
  if (fields.customer_id?.trim()) return null;
  if (fields.lead_id?.trim()) return null;
  if (fields.client_name?.trim()) return null;
  return "Úloha musí byť naviazaná na klienta (zákazník, lead alebo meno klienta). Financie zadávajte na projekte, marketingu, prenájme alebo hostingu.";
}
