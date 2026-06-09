import type { SettlementDraft } from "./types";
import {
  type CommissionRule,
  type CommissionRuleOverride,
  formatRateSourceLabel,
  resolveCommissionRate,
} from "./commissionRules";
import { buildRentalImplementerSyncHints, streamLabelForCommissionTitle } from "./syncHints";

function inPeriod(dateStr: string | null | undefined, year: number, month: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

function commissionInPeriod(c: { date: string }, year: number, month: number): boolean {
  const parts = c.date?.slice(0, 10).split("-");
  if (parts.length < 2) return false;
  return Number(parts[0]) === year && Number(parts[1]) === month;
}

function sourceKey(table: string | null, id: string | null): string | null {
  if (!table || !id) return null;
  return `${table}:${id}`;
}

type RentalWebsite = {
  id: string;
  name: string;
  client_name: string | null;
  implementers?: Array<{ name: string; percentage: number }>;
};

export function buildSettlementDrafts(input: {
  commissions: Array<{
    id: string;
    date: string;
    title: string;
    implementer: string;
    amount: number;
    payment_status: string;
  }>;
  payoutRecords: Array<{
    id: string;
    source_table: string | null;
    source_id: string | null;
    implementer: string | null;
    amount: number;
    paid_at: string;
    reference: string | null;
    truth_level: string;
    imported_from: string | null;
  }>;
  year: number;
  month: number;
  rules?: CommissionRule[];
  overrides?: CommissionRuleOverride[];
  websites?: RentalWebsite[];
}): SettlementDraft[] {
  const { commissions, payoutRecords, year, month } = input;
  const rules = input.rules ?? [];
  const overrides = input.overrides ?? [];
  const websites = input.websites ?? [];
  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  const implementers = new Set<string>();
  commissions.filter((c) => commissionInPeriod(c, year, month)).forEach((c) => implementers.add(c.implementer));
  payoutRecords.filter((p) => inPeriod(p.paid_at, year, month) && p.implementer).forEach((p) => {
    if (p.implementer) implementers.add(p.implementer);
  });

  const payoutBySource = new Set(
    payoutRecords.map((r) => sourceKey(r.source_table, r.source_id)).filter(Boolean) as string[],
  );

  const drafts: SettlementDraft[] = [];

  for (const implementer of [...implementers].sort()) {
    const periodCommissions = commissions.filter(
      (c) => c.implementer === implementer && commissionInPeriod(c, year, month),
    );
    const periodPayouts = payoutRecords.filter(
      (p) => p.implementer === implementer && inPeriod(p.paid_at, year, month),
    );

    const legacyImportAmount = periodPayouts
      .filter((p) => p.truth_level === "legacy_import")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const confirmedPayoutAmount = periodPayouts
      .filter((p) => p.truth_level === "payout_fact")
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const workflowOnlyItems = periodCommissions.filter(
      (c) => c.payment_status === "paid" && !payoutBySource.has(sourceKey("commissions", c.id) ?? ""),
    );
    const workflowOnlyAmount = workflowOnlyItems.reduce((s, c) => s + Number(c.amount || 0), 0);

    const warnings: string[] = [];
    if (workflowOnlyItems.length > 0) {
      warnings.push(`${workflowOnlyItems.length} provízií iba workflow flag`);
    }
    const legacyNoRef = periodPayouts.filter((p) => p.truth_level === "legacy_import" && !p.reference);
    if (legacyNoRef.length > 0) warnings.push(`${legacyNoRef.length} legacy výplat bez referencie`);
    const legacyImprecise = periodPayouts.filter((p) => p.truth_level === "legacy_import" && p.imported_from);
    if (legacyImprecise.length > 0) warnings.push(`${legacyImprecise.length} legacy s odhadovaným dátumom`);

    const dupCandidates = new Map<string, number>();
    for (const p of periodPayouts) {
      const k = `${p.paid_at.slice(0, 10)}|${Number(p.amount).toFixed(2)}`;
      dupCandidates.set(k, (dupCandidates.get(k) ?? 0) + 1);
    }
    const dupCount = [...dupCandidates.values()].filter((n) => n > 1).length;
    if (dupCount > 0) warnings.push(`${dupCount} možných duplicitných skupín`);

    const totalMarkedPaid = periodCommissions
      .filter((c) => c.payment_status === "paid")
      .reduce((s, c) => s + Number(c.amount || 0), 0);
    const suggestedGap = Math.max(0, totalMarkedPaid - confirmedPayoutAmount);

    const draftRate = resolveCommissionRate({
      revenueStreamKind: "project",
      rules,
      overrides,
    });
    const syncHints = buildRentalImplementerSyncHints({ implementer, websites, rules, overrides });

    drafts.push({
      implementer,
      periodLabel,
      year,
      month,
      commissionCount: periodCommissions.length,
      payoutFactCount: periodPayouts.filter((p) => p.truth_level === "payout_fact").length,
      legacyImportAmount,
      confirmedPayoutAmount,
      workflowOnlyAmount,
      suggestedGap,
      warnings,
      effectiveRatePreview: draftRate.rate,
      rateSourceLabel: formatRateSourceLabel(draftRate),
      syncHints: syncHints.length > 0 ? syncHints : undefined,
      pendingCommissions: workflowOnlyItems.map((c) => {
        const stream = streamLabelForCommissionTitle(c.title);
        const resolved = resolveCommissionRate({
          revenueStreamKind: stream,
          rules,
          overrides,
        });
        return {
          id: c.id,
          title: c.title,
          amount: Number(c.amount || 0),
          date: c.date,
          effectiveRate: resolved.rate,
          rateSourceLabel: formatRateSourceLabel(resolved),
        };
      }),
    });
  }

  return drafts.sort((a, b) => a.implementer.localeCompare(b.implementer));
}
