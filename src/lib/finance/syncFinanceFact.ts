import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const RENTAL_PAYMENT_SYNC_IMPORTED_FROM = "app_sync:rental_payments";

type PaymentRecordInsert = Database["public"]["Tables"]["payment_records"]["Insert"];
type PaymentRecordRow = Database["public"]["Tables"]["payment_records"]["Row"];

export type RentalPaymentForSync = {
  id: string;
  website_id: string;
  year: number;
  month: number;
  amount: number;
  status?: string;
  paid_at: string | null;
};

export type RentalWebsiteForSync = {
  id: string;
  name: string;
  client_name: string | null;
  customer_email?: string | null;
};

export type SyncSourceRef = {
  source_table: string;
  source_id: string;
};

export type SyncResult =
  | { ok: true; action: "inserted" | "updated" | "noop"; recordId: string }
  | { ok: false; error: string };

export type ReverseResult =
  | {
      ok: true;
      action: "deleted" | "skipped_no_link" | "skipped_legacy_import" | "noop";
    }
  | { ok: false; error: string };

export type LinkedPaymentFactReverseAction = "delete" | "skip_legacy" | "noop";

export function classifyLinkedPaymentFactReverse(
  row: Pick<PaymentRecordRow, "truth_level"> | null | undefined,
): LinkedPaymentFactReverseAction {
  if (!row) return "noop";
  if (row.truth_level === "legacy_import") return "skip_legacy";
  if (row.truth_level === "payment_fact") return "delete";
  return "skip_legacy";
}

export function buildPaymentFactPayloadFromRentalPayment(
  payment: RentalPaymentForSync,
  website: RentalWebsiteForSync,
): PaymentRecordInsert | null {
  const amount = Number(payment.amount ?? 0);
  if (!amount || amount <= 0) return null;

  const paidAt = payment.paid_at || new Date().toISOString();
  const note = website.name
    ? `Prenájom ${website.name} · ${payment.month}/${payment.year}`
    : `Prenájom · ${payment.month}/${payment.year}`;

  return {
    source_table: "rental_payments",
    source_id: payment.id,
    rental_website_id: payment.website_id,
    amount,
    paid_at: paidAt,
    client_name: website.client_name ?? null,
    customer_email: website.customer_email ?? null,
    currency: "EUR",
    truth_level: "payment_fact",
    imported_from: RENTAL_PAYMENT_SYNC_IMPORTED_FROM,
    note,
    method: null,
    reference: null,
  };
}

function paymentFactUpdateFields(
  payload: PaymentRecordInsert,
): Database["public"]["Tables"]["payment_records"]["Update"] {
  return {
    amount: payload.amount,
    paid_at: payload.paid_at,
    client_name: payload.client_name,
    customer_email: payload.customer_email,
    rental_website_id: payload.rental_website_id,
    note: payload.note,
    currency: payload.currency ?? "EUR",
    truth_level: "payment_fact",
    imported_from: payload.imported_from ?? RENTAL_PAYMENT_SYNC_IMPORTED_FROM,
    method: payload.method ?? null,
    reference: payload.reference ?? null,
  };
}

async function selectLinkedPaymentRecord(
  ref: SyncSourceRef,
): Promise<{ row: Pick<PaymentRecordRow, "id" | "truth_level"> | null; error: string | null }> {
  const { data, error } = await supabase
    .from("payment_records")
    .select("id, truth_level")
    .eq("source_table", ref.source_table)
    .eq("source_id", ref.source_id)
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  return { row: data, error: null };
}

async function updateLinkedPaymentFact(
  existingId: string,
  payload: PaymentRecordInsert,
): Promise<SyncResult> {
  const { data: updated, error: updateError } = await supabase
    .from("payment_records")
    .update(paymentFactUpdateFields(payload))
    .eq("id", existingId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, action: "updated", recordId: updated?.id ?? existingId };
}

export async function upsertPaymentFactForSource(
  payload: PaymentRecordInsert & { source_table: string; source_id: string },
): Promise<SyncResult> {
  const amount = Number(payload.amount ?? 0);
  if (!amount || amount <= 0) {
    return { ok: false, error: "Neplatná suma" };
  }

  const ref: SyncSourceRef = {
    source_table: payload.source_table,
    source_id: payload.source_id,
  };

  const { row: existing, error: selectError } = await selectLinkedPaymentRecord(ref);
  if (selectError) return { ok: false, error: selectError };
  if (existing) return updateLinkedPaymentFact(existing.id, payload);

  const { data: inserted, error: insertError } = await supabase
    .from("payment_records")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    const { row: raced, error: raceSelectError } = await selectLinkedPaymentRecord(ref);
    if (raceSelectError) return { ok: false, error: raceSelectError };
    if (raced) return updateLinkedPaymentFact(raced.id, payload);
    return { ok: false, error: insertError.message };
  }

  if (insertError) return { ok: false, error: insertError.message };
  if (!inserted?.id) {
    return { ok: false, error: "Payment fact sa nepodarilo vytvoriť" };
  }

  return { ok: true, action: "inserted", recordId: inserted.id };
}

export async function reversePaymentFactForSource(ref: SyncSourceRef): Promise<ReverseResult> {
  const { row: existing, error: selectError } = await selectLinkedPaymentRecord(ref);
  if (selectError) return { ok: false, error: selectError };

  const decision = classifyLinkedPaymentFactReverse(existing);
  if (decision === "noop") return { ok: true, action: "skipped_no_link" };
  if (decision === "skip_legacy") return { ok: true, action: "skipped_legacy_import" };

  const { error: deleteError } = await supabase
    .from("payment_records")
    .delete()
    .eq("id", existing!.id);

  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true, action: "deleted" };
}

export async function syncRentalPaymentToFinance(
  payment: RentalPaymentForSync,
  website: RentalWebsiteForSync,
): Promise<SyncResult> {
  const payload = buildPaymentFactPayloadFromRentalPayment(payment, website);
  if (!payload?.source_table || !payload.source_id) {
    return { ok: false, error: "Neplatná suma pre payment fact" };
  }
  return upsertPaymentFactForSource({
    ...payload,
    source_table: payload.source_table,
    source_id: payload.source_id,
  });
}

export async function unsyncRentalPaymentFromFinance(rentalPaymentId: string): Promise<ReverseResult> {
  return reversePaymentFactForSource({
    source_table: "rental_payments",
    source_id: rentalPaymentId,
  });
}

export const RENTAL_CREDITS_SYNC_IMPORTED_FROM = "app_sync:rental_credits";
export const RENTAL_CREDITS_SOURCE_TABLE = "rental_credits";
/** ponytail: same rate as AdminRentals CREDIT_COST — extract shared constant if a third caller appears */
export const RENTAL_AI_CREDIT_EUR = 30 / 100;

type CostRecordInsert = Database["public"]["Tables"]["cost_records"]["Insert"];
type CostRecordRow = Database["public"]["Tables"]["cost_records"]["Row"];

export type RentalCreditsForSync = {
  websiteId: string;
  websiteName: string;
  clientName: string | null;
  year: number;
  creditsUsed: number;
};

export function rentalCreditsCostSourceId(websiteId: string, year: number): string {
  return `${websiteId}:${year}`;
}

export function rentalCreditsCostSourceRef(websiteId: string, year: number): SyncSourceRef {
  return {
    source_table: RENTAL_CREDITS_SOURCE_TABLE,
    source_id: rentalCreditsCostSourceId(websiteId, year),
  };
}

export type LinkedCostFactReverseAction = "delete" | "skip_legacy" | "noop";

export function classifyLinkedCostFactReverse(
  row: Pick<CostRecordRow, "truth_level"> | null | undefined,
): LinkedCostFactReverseAction {
  if (!row) return "noop";
  if (row.truth_level === "legacy_import") return "skip_legacy";
  if (row.truth_level === "cost_fact") return "delete";
  return "skip_legacy";
}

export function buildCostFactPayloadFromRentalCredits(
  ctx: RentalCreditsForSync,
): CostRecordInsert | null {
  const creditsUsed = Number(ctx.creditsUsed ?? 0);
  if (!creditsUsed || creditsUsed <= 0) return null;

  const amount = creditsUsed * RENTAL_AI_CREDIT_EUR;
  const incurredAt = `${ctx.year}-12-31T00:00:00.000Z`;
  const note = `Kredity AI · ${ctx.websiteName} · ${ctx.year}`;

  return {
    source_table: RENTAL_CREDITS_SOURCE_TABLE,
    source_id: rentalCreditsCostSourceId(ctx.websiteId, ctx.year),
    rental_website_id: ctx.websiteId,
    amount,
    currency: "EUR",
    truth_level: "cost_fact",
    imported_from: RENTAL_CREDITS_SYNC_IMPORTED_FROM,
    note,
    category: "AI kredity",
    client_name: ctx.clientName ?? null,
    incurred_at: incurredAt,
    paid_at: incurredAt,
    vendor: null,
    reference: null,
  };
}

function costFactUpdateFields(
  payload: CostRecordInsert,
): Database["public"]["Tables"]["cost_records"]["Update"] {
  return {
    amount: payload.amount,
    incurred_at: payload.incurred_at,
    paid_at: payload.paid_at,
    client_name: payload.client_name,
    rental_website_id: payload.rental_website_id,
    note: payload.note,
    category: payload.category ?? null,
    currency: payload.currency ?? "EUR",
    truth_level: "cost_fact",
    imported_from: payload.imported_from ?? RENTAL_CREDITS_SYNC_IMPORTED_FROM,
    vendor: payload.vendor ?? null,
    reference: payload.reference ?? null,
  };
}

async function selectLinkedCostRecord(
  ref: SyncSourceRef,
): Promise<{ row: Pick<CostRecordRow, "id" | "truth_level"> | null; error: string | null }> {
  const { data, error } = await supabase
    .from("cost_records")
    .select("id, truth_level")
    .eq("source_table", ref.source_table)
    .eq("source_id", ref.source_id)
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  return { row: data, error: null };
}

async function updateLinkedCostFact(
  existingId: string,
  payload: CostRecordInsert,
): Promise<SyncResult> {
  const { data: updated, error: updateError } = await supabase
    .from("cost_records")
    .update(costFactUpdateFields(payload))
    .eq("id", existingId)
    .select("id")
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, action: "updated", recordId: updated?.id ?? existingId };
}

export async function upsertCostFactForSource(
  payload: CostRecordInsert & { source_table: string; source_id: string },
): Promise<SyncResult> {
  const amount = Number(payload.amount ?? 0);
  if (!amount || amount <= 0) {
    return { ok: false, error: "Neplatná suma" };
  }

  const ref: SyncSourceRef = {
    source_table: payload.source_table,
    source_id: payload.source_id,
  };

  const { row: existing, error: selectError } = await selectLinkedCostRecord(ref);
  if (selectError) return { ok: false, error: selectError };
  if (existing) return updateLinkedCostFact(existing.id, payload);

  const { data: inserted, error: insertError } = await supabase
    .from("cost_records")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    const { row: raced, error: raceSelectError } = await selectLinkedCostRecord(ref);
    if (raceSelectError) return { ok: false, error: raceSelectError };
    if (raced) return updateLinkedCostFact(raced.id, payload);
    return { ok: false, error: insertError.message };
  }

  if (insertError) return { ok: false, error: insertError.message };
  if (!inserted?.id) {
    return { ok: false, error: "Cost fact sa nepodarilo vytvoriť" };
  }

  return { ok: true, action: "inserted", recordId: inserted.id };
}

export async function reverseCostFactForSource(ref: SyncSourceRef): Promise<ReverseResult> {
  const { row: existing, error: selectError } = await selectLinkedCostRecord(ref);
  if (selectError) return { ok: false, error: selectError };

  const decision = classifyLinkedCostFactReverse(existing);
  if (decision === "noop") return { ok: true, action: "skipped_no_link" };
  if (decision === "skip_legacy") return { ok: true, action: "skipped_legacy_import" };

  const { error: deleteError } = await supabase.from("cost_records").delete().eq("id", existing!.id);

  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true, action: "deleted" };
}

export async function syncRentalCreditsToFinance(
  website: RentalWebsiteForSync,
  year: number,
  creditsUsed: number,
): Promise<SyncResult> {
  const payload = buildCostFactPayloadFromRentalCredits({
    websiteId: website.id,
    websiteName: website.name,
    clientName: website.client_name,
    year,
    creditsUsed,
  });
  if (!payload?.source_table || !payload.source_id) {
    return { ok: false, error: "Neplatná suma pre cost fact" };
  }
  return upsertCostFactForSource({
    ...payload,
    source_table: payload.source_table,
    source_id: payload.source_id,
  });
}

export async function unsyncRentalCreditsFromFinance(
  websiteId: string,
  year: number,
): Promise<ReverseResult> {
  return reverseCostFactForSource(rentalCreditsCostSourceRef(websiteId, year));
}
