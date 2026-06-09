import { supabase } from "@/integrations/supabase/client";
import type { FinanceRawContext } from "./factDrafts";
import type { SettlementDraft } from "./types";

export interface BatchPayoutPlanItem {
  commissionId: string;
  title: string;
  implementer: string;
  amount: number;
  date: string;
  skipped: boolean;
  skipReason?: string;
  effectiveRate?: number;
  rateSourceLabel?: string;
}

function sourceKey(table: string, id: string): string {
  return `${table}:${id}`;
}

function hasPayoutForCommission(ctx: FinanceRawContext, commissionId: string): boolean {
  return ctx.payoutRecords.some(
    (r) => r.source_table === "commissions" && r.source_id === commissionId,
  );
}

/** Per-commission payout facts for workflow-only items — auditable, source-linked. */
export function buildBatchPayoutPlan(
  drafts: SettlementDraft[],
  ctx: FinanceRawContext,
): BatchPayoutPlanItem[] {
  const items: BatchPayoutPlanItem[] = [];
  const seen = new Set<string>();

  for (const draft of drafts) {
    for (const c of draft.pendingCommissions) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);

      if (hasPayoutForCommission(ctx, c.id)) {
      items.push({
        commissionId: c.id,
        title: c.title,
        implementer: draft.implementer,
        amount: c.amount,
        date: c.date,
        skipped: true,
        skipReason: "Už existuje payout záznam pre túto províziu",
        effectiveRate: c.effectiveRate,
        rateSourceLabel: c.rateSourceLabel,
      });
        continue;
      }

      const confirmedDuplicate = ctx.payoutRecords.some(
        (r) =>
          r.truth_level === "payout_fact" &&
          r.implementer === draft.implementer &&
          Number(r.amount) === c.amount &&
          r.paid_at?.slice(0, 10) === c.date.slice(0, 10),
      );
      if (confirmedDuplicate) {
        items.push({
          commissionId: c.id,
          title: c.title,
          implementer: draft.implementer,
          amount: c.amount,
          date: c.date,
          skipped: true,
          skipReason: "Podobný payout_fact už existuje (implementér/dátum/suma)",
          effectiveRate: c.effectiveRate,
          rateSourceLabel: c.rateSourceLabel,
        });
        continue;
      }

      items.push({
        commissionId: c.id,
        title: c.title,
        implementer: draft.implementer,
        amount: c.amount,
        date: c.date,
        skipped: false,
        effectiveRate: c.effectiveRate,
        rateSourceLabel: c.rateSourceLabel,
      });
    }
  }

  return items;
}

export async function saveBatchPayoutFacts(
  items: BatchPayoutPlanItem[],
  periodLabel: string,
): Promise<{ created: number; skipped: number }> {
  const toCreate = items.filter((i) => !i.skipped);
  let created = 0;

  for (const item of toCreate) {
    const paidAt = item.date.includes("T") ? item.date : `${item.date}T12:00:00.000Z`;
    const { error } = await supabase.from("payout_records").insert({
      amount: item.amount,
      paid_at: paidAt,
      implementer: item.implementer,
      note: `Batch settlement ${periodLabel}: ${item.title}`,
      currency: "EUR",
      truth_level: "payout_fact",
      source_table: "commissions",
      source_id: item.commissionId,
    });
    if (error) throw error;
    created++;
  }

  return { created, skipped: items.length - created };
}
