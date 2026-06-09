/** Commission rules foundation — read/resolve layer, no payout recalculation engine. */

export type RevenueStreamKind = "rental" | "project" | "hosting" | "other_fee";

export interface CommissionRule {
  id: string;
  name: string;
  revenue_stream_kind: RevenueStreamKind;
  default_rate: number;
  implementer: string | null;
  active: boolean;
  note: string | null;
}

export interface CommissionRuleOverride {
  id: string;
  rule_id: string | null;
  customer_email: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  revenue_stream_kind: RevenueStreamKind | null;
  override_rate: number;
  reason: string | null;
  active: boolean;
}

export type RateOverrideKind = "rental_website" | "customer_email" | "client_name" | "stream";

export interface ResolvedCommissionRate {
  rate: number;
  source: "override" | "rule" | "fallback";
  ruleName?: string;
  overrideReason?: string;
  overrideKind?: RateOverrideKind;
  revenueStreamKind: RevenueStreamKind;
}

const FALLBACK_RATES: Record<RevenueStreamKind, number> = {
  rental: 30,
  project: 30,
  hosting: 0,
  other_fee: 0,
};

export function resolveCommissionRate(input: {
  revenueStreamKind: RevenueStreamKind;
  rules: CommissionRule[];
  overrides: CommissionRuleOverride[];
  customerEmail?: string | null;
  clientName?: string | null;
  rentalWebsiteId?: string | null;
}): ResolvedCommissionRate {
  const { revenueStreamKind, rules, overrides } = input;
  const activeOverrides = overrides.filter((o) => o.active);

  const byWebsite = input.rentalWebsiteId
    ? activeOverrides.find((o) => o.rental_website_id === input.rentalWebsiteId)
    : undefined;
  if (byWebsite) {
    return {
      rate: Number(byWebsite.override_rate),
      source: "override",
      overrideKind: "rental_website",
      overrideReason: byWebsite.reason ?? undefined,
      revenueStreamKind,
    };
  }

  const byEmail = input.customerEmail
    ? activeOverrides.find(
        (o) => o.customer_email && o.customer_email.toLowerCase() === input.customerEmail!.toLowerCase(),
      )
    : undefined;
  if (byEmail) {
    return {
      rate: Number(byEmail.override_rate),
      source: "override",
      overrideKind: "customer_email",
      overrideReason: byEmail.reason ?? undefined,
      revenueStreamKind,
    };
  }

  const byClient = input.clientName
    ? activeOverrides.find(
        (o) => o.client_name && o.client_name.toLowerCase() === input.clientName!.toLowerCase(),
      )
    : undefined;
  if (byClient) {
    return {
      rate: Number(byClient.override_rate),
      source: "override",
      overrideKind: "client_name",
      overrideReason: byClient.reason ?? undefined,
      revenueStreamKind,
    };
  }

  const byStream = activeOverrides.find(
    (o) =>
      o.revenue_stream_kind === revenueStreamKind &&
      !o.customer_email &&
      !o.client_name &&
      !o.rental_website_id,
  );
  if (byStream) {
    return {
      rate: Number(byStream.override_rate),
      source: "override",
      overrideKind: "stream",
      overrideReason: byStream.reason ?? undefined,
      revenueStreamKind,
    };
  }

  const rule = rules.find((r) => r.active && r.revenue_stream_kind === revenueStreamKind);
  if (rule) {
    return {
      rate: Number(rule.default_rate),
      source: "rule",
      ruleName: rule.name,
      revenueStreamKind,
    };
  }

  return {
    rate: FALLBACK_RATES[revenueStreamKind],
    source: "fallback",
    revenueStreamKind,
  };
}

export const REVENUE_STREAM_LABELS: Record<RevenueStreamKind, string> = {
  rental: "Prenájom",
  project: "Projekt",
  hosting: "Hosting",
  other_fee: "Ostatný poplatok",
};

const OVERRIDE_KIND_LABELS: Record<RateOverrideKind, string> = {
  rental_website: "Override: rental_website",
  customer_email: "Override: customer_email",
  client_name: "Override: client_name",
  stream: "Override: revenue stream",
};

export function formatRateSourceLabel(resolved: ResolvedCommissionRate): string {
  if (resolved.source === "override" && resolved.overrideKind) {
    return OVERRIDE_KIND_LABELS[resolved.overrideKind];
  }
  if (resolved.source === "rule") {
    return `Default rule: ${resolved.ruleName ?? "—"}`;
  }
  if (resolved.source === "fallback") {
    return "Fallback";
  }
  return resolved.source;
}
