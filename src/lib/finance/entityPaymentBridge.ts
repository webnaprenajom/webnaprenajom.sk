import { supabase } from "@/integrations/supabase/client";
import {
  paymentCompletenessDetail,
  resolvePaymentCompleteness,
} from "@/lib/finance/paymentCompleteness";

export type TaskPaymentVariant = "deposit" | "full";

export function taskPaymentSourceId(taskId: string, variant: TaskPaymentVariant): string {
  return `${taskId}:${variant}`;
}

export type EntityPaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  truth_level: string;
  source_table?: string | null;
  source_id?: string | null;
};

/** Confirmed cash — source of truth for commissions and finance totals. */
export function isConfirmedPayment(row: { truth_level: string }): boolean {
  return row.truth_level === "payment_fact";
}

export function sumConfirmedPayments(
  rows: Array<{ amount: number; truth_level: string }>,
): number {
  return rows
    .filter(isConfirmedPayment)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

export function countConfirmedPayments(
  rows: Array<{ truth_level: string }>,
): number {
  return rows.filter(isConfirmedPayment).length;
}

export function sumConfirmedPaymentsForSource(
  rows: Array<{
    amount: number;
    truth_level: string;
    source_table?: string | null;
    source_id?: string | null;
  }>,
  sourceTable: string,
  sourceId: string,
): number {
  return rows
    .filter(
      (r) =>
        r.source_table === sourceTable &&
        r.source_id === sourceId &&
        isConfirmedPayment(r),
    )
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

export function entityHasConfirmedPaymentInRows(
  sourceTable: string,
  sourceId: string,
  rows: Array<{
    truth_level: string;
    source_table?: string | null;
    source_id?: string | null;
  }>,
): boolean {
  return rows.some(
    (r) =>
      r.source_table === sourceTable &&
      r.source_id === sourceId &&
      isConfirmedPayment(r),
  );
}

export function entityHasLinkedPaymentInRows(
  sourceTable: string,
  sourceId: string,
  rows: Array<{ source_table?: string | null; source_id?: string | null }>,
): boolean {
  return rows.some((r) => r.source_table === sourceTable && r.source_id === sourceId);
}

export async function entityHasLinkedPayment(
  sourceTable: string,
  sourceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("payment_records")
    .select("id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

/** ponytail: task payments use source_id `${uuid}:deposit|full` — one fact per variant */
export async function loadTaskPaymentRecords(taskId: string): Promise<EntityPaymentRow[]> {
  const { data, error } = await supabase
    .from("payment_records")
    .select("id,amount,paid_at,note,truth_level,source_table,source_id")
    .eq("source_table", "tasks")
    .or(`source_id.eq.${taskId},source_id.like.${taskId}:%`)
    .order("paid_at", { ascending: false });
  if (error) return [];
  return (data || []) as EntityPaymentRow[];
}

export function taskPaymentVariantLabel(sourceId: string, taskId: string): string | null {
  if (sourceId === taskPaymentSourceId(taskId, "deposit")) return "Záloha";
  if (sourceId === taskPaymentSourceId(taskId, "full")) return "Úhrada / doplatok";
  if (sourceId === taskId) return "Platba";
  return null;
}

export function projectPaymentCreateHint(project: { agreed_fee?: number | null }): string | null {
  const fee = Number(project.agreed_fee ?? 0);
  if (!fee || fee <= 0) return "Vyplňte dohodnutú cenu v prehľade.";
  return null;
}

export function marketingPaymentCreateHint(record: { agreed_fee?: number | null }): string | null {
  const fee = Number(record.agreed_fee ?? 0);
  if (!fee || fee <= 0) return "Vyplňte dohodnutú cenu v prehľade.";
  return null;
}

/** Contract amount for payment completeness — hosting falls back to monthly/yearly until agreed_fee is set. */
export function resolveEntityAgreedPrice(entity: {
  agreed_fee?: number | null;
  monthly_price?: number | null;
  yearly_price?: number | null;
}): number {
  const agreed = Number(entity.agreed_fee ?? 0);
  if (agreed > 0) return agreed;
  const monthly = Number(entity.monthly_price ?? 0);
  if (monthly > 0) return monthly;
  return Number(entity.yearly_price ?? 0);
}

export function hostingPaymentCreateHint(record: {
  agreed_fee?: number | null;
  monthly_price?: number | null;
  yearly_price?: number | null;
}): string | null {
  if (resolveEntityAgreedPrice(record) <= 0) return "Vyplňte dohodnutú cenu v prehľade.";
  return null;
}

/** When add-payment should be disabled (missing agreed price or fully paid). */
export function entityPaymentAddHint(
  agreedPrice: number | null | undefined,
  confirmedPaid: number,
): string | null {
  const base =
    Number(agreedPrice ?? 0) > 0
      ? null
      : "Vyplňte dohodnutú cenu v prehľade.";
  if (base) return base;
  const pc = resolvePaymentCompleteness(agreedPrice, confirmedPaid);
  if (pc.status === "paid" && pc.overpaid <= 0) {
    return "Dohodnutá suma je plne uhradená.";
  }
  return null;
}

export function entityPaymentRemainingAmount(
  agreedPrice: number | null | undefined,
  confirmedPaid: number,
): number {
  return resolvePaymentCompleteness(agreedPrice, confirmedPaid).remaining;
}

export function formatEntityPaymentRemainingHint(
  agreedPrice: number | null | undefined,
  confirmedPaid: number,
): string | null {
  return paymentCompletenessDetail(resolvePaymentCompleteness(agreedPrice, confirmedPaid));
}

export function taskPaymentCreateHint(
  task: { amount: number; deposit: number },
  variant: TaskPaymentVariant,
  linked: boolean,
  depositLinked: boolean,
): string | null {
  if (linked) {
    return variant === "deposit"
      ? "Záloha už bola potvrdená do financií."
      : "Úhrada už bola potvrdená do financií.";
  }
  if (variant === "deposit") {
    const dep = Number(task.deposit ?? 0);
    if (!dep || dep <= 0) return "Úloha nemá vyplnenú zálohu.";
    return null;
  }
  const total = Number(task.amount ?? 0);
  const dep = Number(task.deposit ?? 0);
  if (dep > 0 && depositLinked) {
    const remaining = total - dep;
    if (!remaining || remaining <= 0) return "Doplatok nie je potrebný — záloha pokrýva celú sumu.";
  } else if (!total || total <= 0) {
    return "Úloha nemá vyplnenú sumu.";
  }
  return null;
}

export function canOfferProjectPaymentCreate(project: { agreed_fee?: number | null }): boolean {
  return projectPaymentCreateHint(project) == null;
}

export function canOfferMarketingPaymentCreate(record: { agreed_fee?: number | null }): boolean {
  return marketingPaymentCreateHint(record) == null;
}

export function canOfferTaskPaymentCreate(
  task: { amount: number; deposit: number },
  variant: TaskPaymentVariant,
  linked: boolean,
  depositLinked: boolean,
): boolean {
  return taskPaymentCreateHint(task, variant, linked, depositLinked) == null;
}
