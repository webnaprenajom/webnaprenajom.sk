/**
 * Owner-entered entity payments — immediate payment_fact truth (no Finance reconciliation step).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fromLocalInput } from "@/lib/finance/factDrafts";
import { parseMoneyInput } from "@/lib/money/formatMoney";

type PaymentInsert = Database["public"]["Tables"]["payment_records"]["Insert"];
type PaymentUpdate = Database["public"]["Tables"]["payment_records"]["Update"];

export type EntityPaymentSourceTable = "project_notes" | "hosting_records" | "marketing_records";

export type EntityPaymentWriteInput = {
  amount: string | number;
  paid_at: string;
  note?: string | null;
  client_name?: string | null;
  customer_email?: string | null;
  source_table: EntityPaymentSourceTable;
  source_id: string;
};

function normalizeAmount(raw: string | number): number {
  const amount = typeof raw === "number" ? raw : parseMoneyInput(raw);
  if (!amount || amount <= 0) throw new Error("Zadajte sumu väčšiu ako 0.");
  return amount;
}

export function buildEntityPaymentFactPayload(input: EntityPaymentWriteInput): PaymentInsert {
  return {
    amount: normalizeAmount(input.amount),
    paid_at: fromLocalInput(input.paid_at),
    note: input.note?.trim() || null,
    client_name: input.client_name ?? null,
    customer_email: input.customer_email ?? null,
    source_table: input.source_table,
    source_id: input.source_id,
    currency: "EUR",
    truth_level: "payment_fact",
    method: null,
    reference: null,
  };
}

/** Insert payment_fact — ponytail: always insert; partial payments share entity source_id. */
export async function insertEntityPaymentFact(
  input: EntityPaymentWriteInput,
): Promise<{ id: string }> {
  const payload = buildEntityPaymentFactPayload(input);
  const { data, error } = await supabase
    .from("payment_records")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Platbu sa nepodarilo uložiť.");
  return { id: data.id };
}

export async function updateEntityPaymentFact(
  paymentId: string,
  input: Pick<EntityPaymentWriteInput, "amount" | "paid_at" | "note">,
): Promise<void> {
  const patch: PaymentUpdate = {
    amount: normalizeAmount(input.amount),
    paid_at: fromLocalInput(input.paid_at),
    note: input.note?.trim() || null,
    truth_level: "payment_fact",
  };
  const { error } = await supabase.from("payment_records").update(patch).eq("id", paymentId);
  if (error) throw new Error(error.message);
}

export async function deleteEntityPaymentFact(paymentId: string): Promise<void> {
  const { error } = await supabase.from("payment_records").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
}
