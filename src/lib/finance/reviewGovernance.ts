import { supabase } from "@/integrations/supabase/client";
import type { ReviewItemStatus, ReviewItemType } from "./buildReviewQueue";

export const REVIEW_CADENCE_DAYS: Record<ReviewItemType, number> = {
  dismissed_issue: 90,
  commission_override: 180,
  hosting_commissionable: 90,
  settlement_warning: 30,
};

export type DueStatus = "due_soon" | "overdue" | "snoozed" | "ok";

export async function loadReviewStatuses(): Promise<
  Array<{
    item_key: string;
    item_type: string;
    status: ReviewItemStatus;
    review_note: string | null;
    reviewed_at: string | null;
    review_due_at: string | null;
    review_cadence_days: number | null;
    snoozed_until: string | null;
  }>
> {
  const { data, error } = await supabase.from("finance_review_items").select("*");
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as Array<{
    item_key: string;
    item_type: string;
    status: ReviewItemStatus;
    review_note: string | null;
    reviewed_at: string | null;
    review_due_at: string | null;
    review_cadence_days: number | null;
    snoozed_until: string | null;
  }>;
}

export function computeNextDueAt(cadenceDays: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + cadenceDays);
  return d.toISOString();
}

export function defaultDueAtForItem(itemType: ReviewItemType, createdAt: string): string {
  const cadence = REVIEW_CADENCE_DAYS[itemType];
  const base = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(base.getTime())) return computeNextDueAt(cadence);
  return computeNextDueAt(cadence, base);
}

export function computeDueStatus(input: {
  dueAt: string | null;
  snoozedUntil: string | null;
  status: ReviewItemStatus;
  now?: Date;
}): DueStatus | null {
  const now = input.now ?? new Date();
  if (input.status === "reviewed" || input.status === "still_valid") return null;

  if (input.snoozedUntil) {
    const snoozeEnd = new Date(input.snoozedUntil);
    if (!Number.isNaN(snoozeEnd.getTime()) && snoozeEnd > now) return "snoozed";
  }

  if (!input.dueAt) return "ok";

  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) return "ok";

  const msDay = 86400000;
  const daysUntil = (due.getTime() - now.getTime()) / msDay;

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "due_soon";
  return "ok";
}

export async function upsertReviewStatus(input: {
  itemKey: string;
  itemType: ReviewItemType;
  status: ReviewItemStatus;
  reviewNote?: string;
}): Promise<void> {
  const { data: existing } = await supabase
    .from("finance_review_items")
    .select("id, review_cadence_days")
    .eq("item_key", input.itemKey)
    .maybeSingle();

  const cadence =
    (existing as { review_cadence_days?: number } | null)?.review_cadence_days ??
    REVIEW_CADENCE_DAYS[input.itemType];

  const now = new Date();
  const reviewed = input.status === "reviewed" || input.status === "still_valid";

  const payload: Record<string, unknown> = {
    item_key: input.itemKey,
    item_type: input.itemType,
    status: input.status,
    review_note: input.reviewNote ?? null,
    reviewed_at: reviewed ? now.toISOString() : null,
    review_cadence_days: cadence,
  };

  if (reviewed || input.status === "reopened") {
    payload.snoozed_until = null;
  }

  if (reviewed) {
    payload.review_due_at = computeNextDueAt(cadence, now);
  }

  if (existing?.id) {
    const { error } = await supabase.from("finance_review_items").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const insertPayload = {
      ...payload,
      review_due_at: reviewed
        ? computeNextDueAt(cadence, now)
        : computeNextDueAt(cadence),
      snoozed_until: null,
    };
    const { error } = await supabase.from("finance_review_items").insert(insertPayload);
    if (error) throw error;
  }
}

export async function snoozeReviewItem(input: {
  itemKey: string;
  itemType: ReviewItemType;
  days?: number;
}): Promise<void> {
  const days = input.days ?? 7;
  const snoozedUntil = computeNextDueAt(days);

  const { data: existing } = await supabase
    .from("finance_review_items")
    .select("id")
    .eq("item_key", input.itemKey)
    .maybeSingle();

  const payload = {
    item_key: input.itemKey,
    item_type: input.itemType,
    status: "pending" as ReviewItemStatus,
    snoozed_until: snoozedUntil,
    review_cadence_days: REVIEW_CADENCE_DAYS[input.itemType],
  };

  if (existing?.id) {
    const { error } = await supabase.from("finance_review_items").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("finance_review_items").insert({
      ...payload,
      review_due_at: computeNextDueAt(REVIEW_CADENCE_DAYS[input.itemType]),
    });
    if (error) throw error;
  }
}

export async function reopenReviewItem(input: {
  itemKey: string;
  itemType: ReviewItemType;
}): Promise<void> {
  await upsertReviewStatus({
    itemKey: input.itemKey,
    itemType: input.itemType,
    status: "reopened",
  });
}
