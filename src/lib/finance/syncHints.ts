import {
  type CommissionRule,
  type CommissionRuleOverride,
  resolveCommissionRate,
  type RevenueStreamKind,
} from "./commissionRules";

type RentalWebsite = {
  id: string;
  name: string;
  client_name: string | null;
  implementers?: Array<{ name: string; percentage: number }>;
};

/** Advisory hints — no auto-sync. */
export function buildRentalImplementerSyncHints(input: {
  implementer: string;
  websites: RentalWebsite[];
  rules: CommissionRule[];
  overrides: CommissionRuleOverride[];
}): string[] {
  const hints: string[] = [];
  const { implementer, websites, rules, overrides } = input;

  for (const w of websites) {
    const imp = (w.implementers ?? []).find(
      (i) => i.name.trim().toLowerCase() === implementer.trim().toLowerCase(),
    );
    if (!imp) continue;

    const jsonPct = Number(imp.percentage) || 0;
    const resolved = resolveCommissionRate({
      revenueStreamKind: "rental",
      rules,
      overrides,
      clientName: w.client_name,
      rentalWebsiteId: w.id,
    });

    if (Math.abs(jsonPct - resolved.rate) > 0.01) {
      hints.push(
        `${w.name}: rental JSON ${jsonPct}% vs rule ${resolved.rate}% (${resolved.source})`,
      );
    }
  }

  return hints;
}

export function buildHostingCommissionableHint(input: {
  commissionable: boolean;
  rules: CommissionRule[];
}): string | null {
  const hostingRule = input.rules.find((r) => r.active && r.revenue_stream_kind === "hosting");
  const defaultRate = hostingRule ? Number(hostingRule.default_rate) : 0;

  if (input.commissionable && defaultRate === 0) {
    return "Hosting commissionable=true, ale default hosting rule má 0% — skontrolujte override";
  }
  if (!input.commissionable && defaultRate > 0) {
    return "Hosting nie je commissionable, default rule však umožňuje províziu — advisory only";
  }
  return null;
}

export function streamLabelForCommissionTitle(title: string): RevenueStreamKind {
  const t = title.toLowerCase();
  if (t.includes("hosting")) return "hosting";
  if (t.includes("prenájom") || t.includes("rental")) return "rental";
  return "project";
}
