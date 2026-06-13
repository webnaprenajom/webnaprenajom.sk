import type { IssueDismissalRow } from "./dismissals";
import type { CommissionRuleOverride } from "./commissionRules";
import type { SettlementDraft } from "./types";
import {
  computeDueStatus,
  defaultDueAtForItem,
  type DueStatus,
} from "./reviewGovernance";
import { resolveCustomerIdentity, customerDisplayLabel } from "./customerBridge";
import { buildHostingCommissionableHint } from "./syncHints";
import type { CommissionRule } from "./commissionRules";

export type ReviewItemType =
  | "dismissed_issue"
  | "commission_override"
  | "hosting_commissionable"
  | "settlement_warning";

export type ReviewItemStatus = "pending" | "reviewed" | "still_valid" | "reopened";

export interface ReviewQueueItem {
  itemKey: string;
  itemType: ReviewItemType;
  title: string;
  detail: string;
  reason: string | null;
  createdAt: string;
  status: ReviewItemStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewDueAt: string | null;
  reviewCadenceDays: number;
  snoozedUntil: string | null;
  dueStatus: DueStatus | null;
  customerLabel: string | null;
}

export interface HostingRecordRow {
  id: string;
  customer_email: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  provider: string | null;
  domains_count: number | null;
  monthly_price: number | null;
  yearly_price: number | null;
  acquired_by: string | null;
  commissionable: boolean;
  note: string | null;
  active: boolean;
  created_at: string;
  operating_cost?: number;
}

export interface FinanceReviewStatusRow {
  item_key: string;
  item_type: string;
  status: ReviewItemStatus;
  review_note: string | null;
  reviewed_at: string | null;
  review_due_at?: string | null;
  review_cadence_days?: number | null;
  snoozed_until?: string | null;
}

export function buildReviewQueue(input: {
  dismissals: IssueDismissalRow[];
  overrides: CommissionRuleOverride[];
  hostingRecords: HostingRecordRow[];
  settlementDrafts: SettlementDraft[];
  reviewStatuses: FinanceReviewStatusRow[];
  rules?: CommissionRule[];
}): ReviewQueueItem[] {
  const statusMap = new Map(input.reviewStatuses.map((r) => [r.item_key, r]));
  const items: ReviewQueueItem[] = [];
  const rules = input.rules ?? [];

  const enrich = (
    base: Omit<
      ReviewQueueItem,
      "reviewDueAt" | "reviewCadenceDays" | "snoozedUntil" | "dueStatus" | "customerLabel"
    >,
  ): ReviewQueueItem => {
    const st = statusMap.get(base.itemKey);
    const cadence = st?.review_cadence_days ?? defaultCadenceForType(base.itemType);
    const dueAt =
      st?.review_due_at ??
      (base.createdAt ? defaultDueAtForItem(base.itemType, base.createdAt) : defaultDueAtForItem(base.itemType, new Date().toISOString()));
    const snoozedUntil = st?.snoozed_until ?? null;
    const dueStatus = computeDueStatus({
      dueAt,
      snoozedUntil,
      status: base.status,
    });
    return {
      ...base,
      reviewDueAt: dueAt,
      reviewCadenceDays: cadence,
      snoozedUntil,
      dueStatus,
      customerLabel: base.customerLabel,
    };
  };

  for (const d of input.dismissals) {
    const key = `dismissed:${d.issue_key}`;
    const st = statusMap.get(key);
    items.push(
      enrich({
        itemKey: key,
        itemType: "dismissed_issue",
        title: `Dismissed: ${d.issue_type}`,
        detail: d.issue_key,
        reason: d.reason,
        createdAt: d.created_at,
        status: st?.status ?? "pending",
        reviewNote: st?.review_note ?? null,
        reviewedAt: st?.reviewed_at ?? null,
        customerLabel: null,
      }),
    );
  }

  for (const o of input.overrides.filter((x) => x.active)) {
    const key = `override:${o.id}`;
    const st = statusMap.get(key);
    const target = o.client_name ?? o.customer_email ?? o.rental_website_id ?? o.revenue_stream_kind ?? "—";
    const identity = resolveCustomerIdentity({
      customerEmail: o.customer_email,
      clientName: o.client_name,
      rentalWebsiteId: o.rental_website_id,
    });
    items.push(
      enrich({
        itemKey: key,
        itemType: "commission_override",
        title: `Override ${o.override_rate}% · ${target}`,
        detail: o.reason ?? "Bez dôvodu",
        reason: o.reason,
        createdAt: "",
        status: st?.status ?? "pending",
        reviewNote: st?.review_note ?? null,
        reviewedAt: st?.reviewed_at ?? null,
        customerLabel: customerDisplayLabel(identity),
      }),
    );
  }

  for (const h of input.hostingRecords.filter((x) => x.active && x.commissionable)) {
    const key = `hosting:${h.id}`;
    const st = statusMap.get(key);
    const identity = resolveCustomerIdentity({
      customerEmail: h.customer_email,
      clientName: h.client_name,
      rentalWebsiteId: h.rental_website_id,
    });
    const hostingHint = buildHostingCommissionableHint({ commissionable: h.commissionable, rules });
    const detail = [h.note ?? `${h.provider ?? "—"} · ${h.monthly_price ?? "—"}€/mes`, hostingHint]
      .filter(Boolean)
      .join(" · ");
    items.push(
      enrich({
        itemKey: key,
        itemType: "hosting_commissionable",
        title: `Hosting commissionable: ${customerDisplayLabel(identity)}`,
        detail,
        reason: "Hosting marked commissionable — requires review",
        createdAt: h.created_at,
        status: st?.status ?? "pending",
        reviewNote: st?.review_note ?? null,
        reviewedAt: st?.reviewed_at ?? null,
        customerLabel: customerDisplayLabel(identity),
      }),
    );
  }

  for (const d of input.settlementDrafts) {
    for (const w of d.warnings) {
      const key = `settlement:${d.implementer}:${d.periodLabel}:${w.slice(0, 40)}`;
      const st = statusMap.get(key);
      items.push(
        enrich({
          itemKey: key,
          itemType: "settlement_warning",
          title: `${d.implementer} · ${d.periodLabel}`,
          detail: w,
          reason: w,
          createdAt: "",
          status: st?.status ?? "pending",
          reviewNote: st?.review_note ?? null,
          reviewedAt: st?.reviewed_at ?? null,
          customerLabel: null,
        }),
      );
    }
    for (const hint of d.syncHints ?? []) {
      const key = `settlement-hint:${d.implementer}:${d.periodLabel}:${hint.slice(0, 40)}`;
      const st = statusMap.get(key);
      items.push(
        enrich({
          itemKey: key,
          itemType: "settlement_warning",
          title: `Sync hint: ${d.implementer}`,
          detail: hint,
          reason: hint,
          createdAt: "",
          status: st?.status ?? "pending",
          reviewNote: st?.review_note ?? null,
          reviewedAt: st?.reviewed_at ?? null,
          customerLabel: null,
        }),
      );
    }
  }

  return items.sort((a, b) => {
    const dueRank = (item: ReviewQueueItem) => {
      if (item.dueStatus === "overdue") return 0;
      if (item.dueStatus === "due_soon") return 1;
      if (item.status === "pending" || item.status === "reopened") return 2;
      return 3;
    };
    const dr = dueRank(a) - dueRank(b);
    if (dr !== 0) return dr;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function defaultCadenceForType(type: ReviewItemType): number {
  const map: Record<ReviewItemType, number> = {
    dismissed_issue: 90,
    commission_override: 180,
    hosting_commissionable: 90,
    settlement_warning: 30,
  };
  return map[type];
}
