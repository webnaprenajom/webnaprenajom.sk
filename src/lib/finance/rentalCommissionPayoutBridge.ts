/**
 * Rental JSON implementers → canonical commission row → payout fact bridge.
 * ponytail: one materialized commission per rental+implementer+year; payout dedup via commission id.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildCommissionInsertPayload } from "@/lib/commissionCreateHelpers";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  type CommissionForPayoutBridge,
  type CommissionPayoutBridgeResult,
  buildCommissionPayoutDraft,
  resolveCommissionPayoutBridgeAfterMarkPaid,
} from "@/lib/finance/commissionPayoutBridge";
import { toLocalInput } from "@/lib/finance/factDrafts";

export type RentalCommissionMaterializeInput = {
  websiteId: string;
  websiteName: string;
  implementer: string;
  year: number;
  amount: number;
  customerEmail?: string | null;
  note?: string | null;
};

export function findRentalWorkflowCommission(
  commissions: CommissionRow[],
  input: Pick<RentalCommissionMaterializeInput, "websiteId" | "implementer" | "year">,
): CommissionRow | null {
  const name = input.implementer.trim().toLowerCase();
  const yearStr = String(input.year);
  return (
    commissions.find(
      (c) =>
        c.source_type === "rental" &&
        c.source_id === input.websiteId &&
        (c.implementer || "").trim().toLowerCase() === name &&
        (c.date || "").startsWith(yearStr),
    ) ?? null
  );
}

export function toPayoutBridgeCommission(
  row: Pick<CommissionRow, "id" | "title" | "amount" | "date" | "implementer" | "note">,
): CommissionForPayoutBridge {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    date: row.date,
    implementer: row.implementer,
    note: row.note,
  };
}

/** Upsert workflow commission row for JSON rental share, then offer payout fact dialog. */
export async function resolveRentalJsonPayoutBridgeAfterMarkPaid(
  input: RentalCommissionMaterializeInput,
  commissions: CommissionRow[],
): Promise<CommissionPayoutBridgeResult & { commissionId?: string }> {
  const amount = Number(input.amount) || 0;
  if (amount <= 0) {
    return { action: "no_draft" };
  }

  const existing = findRentalWorkflowCommission(commissions, input);
  let bridgeTarget: CommissionForPayoutBridge | null = null;

  if (existing) {
    const { data, error } = await supabase
      .from("commissions")
      .update({
        payment_status: "paid",
        amount,
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      })
      .eq("id", existing.id)
      .select("id,title,amount,date,implementer,note")
      .single();
    if (error || !data) return { action: "no_draft" };
    bridgeTarget = toPayoutBridgeCommission(data as CommissionRow);
  } else {
    const built = buildCommissionInsertPayload({
      title: `${input.websiteName} · prenájom ${input.year}`,
      amount,
      date: `${input.year}-12-31`,
      implementer: input.implementer,
      payment_status: "paid",
      source_type: "rental",
      source_id: input.websiteId,
      customer_email: input.customerEmail ?? null,
      note: input.note ?? null,
    });
    if (!built.ok) return { action: "no_draft" };
    const { data, error } = await supabase
      .from("commissions")
      .insert(built.payload)
      .select("id,title,amount,date,implementer,note")
      .single();
    if (error || !data) return { action: "no_draft" };
    bridgeTarget = toPayoutBridgeCommission(data as CommissionRow);
  }

  const bridge = await resolveCommissionPayoutBridgeAfterMarkPaid(bridgeTarget);
  return { ...bridge, commissionId: bridgeTarget.id };
}

/** Ensure materialized commission row exists before recording a payout (partial or full). */
export async function ensureRentalCommissionMaterialized(
  input: RentalCommissionMaterializeInput,
  commissions: CommissionRow[],
): Promise<{ commissionId: string; commission: CommissionForPayoutBridge } | null> {
  const amount = Number(input.amount) || 0;
  if (amount <= 0) return null;

  const existing = findRentalWorkflowCommission(commissions, input);
  if (existing) {
    const { data, error } = await supabase
      .from("commissions")
      .update({
        amount,
        ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      })
      .eq("id", existing.id)
      .select("id,title,amount,date,implementer,note")
      .single();
    if (error || !data) return null;
    const row = data as CommissionRow;
    return { commissionId: row.id, commission: toPayoutBridgeCommission(row) };
  }

  const built = buildCommissionInsertPayload({
    title: `${input.websiteName} · prenájom ${input.year}`,
    amount,
    date: `${input.year}-12-31`,
    implementer: input.implementer,
    payment_status: "unpaid",
    source_type: "rental",
    source_id: input.websiteId,
    customer_email: input.customerEmail ?? null,
    note: input.note ?? null,
  });
  if (!built.ok) return null;
  const { data, error } = await supabase
    .from("commissions")
    .insert(built.payload)
    .select("id,title,amount,date,implementer,note")
    .single();
  if (error || !data) return null;
  const row = data as CommissionRow;
  return { commissionId: row.id, commission: toPayoutBridgeCommission(row) };
}
