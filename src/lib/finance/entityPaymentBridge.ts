import { supabase } from "@/integrations/supabase/client";

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

export function projectPaymentCreateHint(
  project: { agreed_fee?: number | null },
  linked: boolean,
): string | null {
  if (linked) return "Pre tento projekt už existuje potvrdená platba.";
  const fee = Number(project.agreed_fee ?? 0);
  if (!fee || fee <= 0) return "Vyplňte dohodnutú cenu v prehľade.";
  return null;
}

export function marketingPaymentCreateHint(
  record: { agreed_fee?: number | null },
  linked: boolean,
): string | null {
  if (linked) return "Pre túto kampaň už existuje potvrdená platba.";
  const fee = Number(record.agreed_fee ?? 0);
  if (!fee || fee <= 0) return "Vyplňte dohodnutú cenu v prehľade.";
  return null;
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

export function canOfferProjectPaymentCreate(
  project: { agreed_fee?: number | null },
  linked: boolean,
): boolean {
  return projectPaymentCreateHint(project, linked) == null;
}

export function canOfferMarketingPaymentCreate(
  record: { agreed_fee?: number | null },
  linked: boolean,
): boolean {
  return marketingPaymentCreateHint(record, linked) == null;
}

export function canOfferTaskPaymentCreate(
  task: { amount: number; deposit: number },
  variant: TaskPaymentVariant,
  linked: boolean,
  depositLinked: boolean,
): boolean {
  return taskPaymentCreateHint(task, variant, linked, depositLinked) == null;
}
