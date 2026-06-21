import { communicationEventsToTimeline } from "@/lib/communication/events";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import type { TimelineEvent } from "@/components/admin/CustomerTimeline";
import { RENTAL_MONTH_STATUS_LABELS } from "@/lib/finance/labels";
import {
  commissionHubStatusLabel,
  hasConfirmedPayout,
} from "./commissionHubTruth";
import {
  DESIGN_STATUS_LABEL,
  NOTE_STATUS_LABEL,
  logSummary,
} from "./constants";
import type { CustomerWorkbenchData } from "./types";

export function buildCustomerTimelineEvents(data: CustomerWorkbenchData): TimelineEvent[] {
  const items: TimelineEvent[] = communicationEventsToTimeline(data.commEvents);

  const paymentFactByRentalPayment = new Set(
    data.paymentRecords
      .filter((p) => p.source_table === "rental_payments" && p.source_id)
      .map((p) => p.source_id!),
  );

  data.logs.forEach((log) => {
    items.push({
      id: `log-${log.id}`,
      at: log.created_at,
      label: logSummary(log),
      detail: log.lead_name || log.lead_email || undefined,
      href: log.lead_id ? `/admin?lead=${log.lead_id}` : undefined,
      category: "lead",
      meta: {
        lead_id: log.lead_id ?? undefined,
        log_field: log.field ?? undefined,
        log_new_value: log.new_value ?? undefined,
      },
    });
  });

  data.notes.forEach((n) => {
    items.push({
      id: `project-${n.id}`,
      at: n.updated_at || new Date().toISOString(),
      label: `Projekt · ${n.title}`,
      detail: NOTE_STATUS_LABEL[n.status] || n.status,
      href: `/admin/projects/${n.id}`,
      category: "project",
    });
  });

  data.rentals.forEach((r) => {
    items.push({
      id: `rental-${r.id}`,
      at: r.created_at || new Date(0).toISOString(),
      label: `Prenájom · ${r.name}`,
      detail: r.url || `${r.monthly_price} €/mes`,
      href: "/admin/rentals",
      category: "rental",
    });
  });

  data.commissions.forEach((c) => {
    const confirmedPayout = hasConfirmedPayout(c.id, data.payoutRecords);
    items.push({
      id: `comm-${c.id}`,
      at: c.date,
      label: `Provízia · ${c.title}`,
      detail: `${fmtEur(Number(c.amount))} · ${commissionHubStatusLabel(c.payment_status, confirmedPayout)}`,
      href: "/admin/finance?advanced=1&legacy=commissions",
      category: "finance",
      truthLevel: "workflow_only",
      meta:
        c.source_type && c.source_id
          ? { source_type: c.source_type, source_id: c.source_id }
          : undefined,
    });
  });

  data.tasks.forEach((t) => {
    items.push({
      id: `task-${t.id}`,
      at: t.updated_at,
      label: `Úloha · ${t.title}`,
      detail: t.status,
      href: "/admin/tasks",
      category: "other",
    });
  });

  data.signatures.forEach((s) => {
    items.push({
      id: `sig-${s.id}`,
      at: s.signed_at || s.created_at,
      label: `Podpis objednávky · ${s.package_name || s.plan}`,
      detail: `${Number(s.price).toLocaleString("sk-SK")} €`,
      href: "/admin/signatures",
      category: "other",
    });
  });

  data.designs.forEach((d) => {
    items.push({
      id: `design-${d.id}`,
      at: d.sent_date,
      label: `Dizajn · ${DESIGN_STATUS_LABEL[d.status] || d.status}`,
      detail: d.design_url || d.client_name,
      href: "/admin/designs",
      category: "other",
    });
  });

  data.wheels.forEach((w) => {
    items.push({
      id: `wheel-${w.id}`,
      at: w.created_at,
      label: `Koleso · ${w.prize_label}`,
      detail: w.redeemed ? "uplatnené" : "neuplatnené",
      href: "/admin/wheel-leads",
      category: "other",
    });
  });

  data.hosting.forEach((h) => {
    items.push({
      id: `hosting-${h.id}`,
      at: h.created_at,
      label: `Hosting · ${h.client_name || h.provider || "Záznam"}`,
      detail: h.provider || (h.monthly_price ? `${h.monthly_price} €/mes` : undefined),
      href: `/admin/hosting/${h.id}`,
      category: "other",
    });
  });

  data.paymentRecords.forEach((p) => {
    items.push({
      id: `payment-${p.id}`,
      at: p.paid_at,
      label: `Platba · ${fmtEur(Number(p.amount))}`,
      detail: p.method || p.reference || undefined,
      href: "/admin/finance?advanced=1&legacy=payments",
      category: "finance",
      truthLevel: p.truth_level,
      meta: p.rental_website_id ? { source_id: p.rental_website_id } : undefined,
    });
  });

  data.payoutRecords.forEach((p) => {
    items.push({
      id: `payout-${p.id}`,
      at: p.paid_at,
      label: `Výplata provízie · ${p.implementer || "Neznámy"}`,
      detail: `${fmtEur(Number(p.amount))}`,
      href: "/admin/finance?advanced=1&legacy=payouts",
      category: "finance",
      truthLevel: p.truth_level,
      meta: p.source_id ? { source_id: p.source_id, source_table: p.source_table ?? undefined } : undefined,
    });
  });

  data.costRecords.forEach((c) => {
    const at = c.paid_at || c.incurred_at || new Date(0).toISOString();
    items.push({
      id: `cost-${c.id}`,
      at,
      label: `Náklad · ${fmtEur(Number(c.amount))}`,
      detail: c.category || c.vendor || undefined,
      href: "/admin/finance?advanced=1&legacy=costs",
      category: "finance",
      truthLevel: c.truth_level,
    });
  });

  data.rentalPayments.forEach((rp) => {
    const at = rp.paid_at || `${rp.year}-${String(rp.month).padStart(2, "0")}-01`;
    const amt =formatAmount1Decimal(Number(rp.custom_price ?? rp.amount));
    const hasPaymentFact = paymentFactByRentalPayment.has(rp.id);
    const statusLabel =
      RENTAL_MONTH_STATUS_LABELS[rp.status as keyof typeof RENTAL_MONTH_STATUS_LABELS] ?? rp.status;
    items.push({
      id: `rental-pay-${rp.id}`,
      at,
      label: `Faktúra prenájmu · ${rp.month}/${rp.year}`,
      detail: hasPaymentFact
        ? `${statusLabel} · ${amt} € (aj v payment_records)`
        : `${statusLabel} · ${amt} €`,
      href: "/admin/rentals",
      category: "finance",
      truthLevel: "workflow_only",
      meta: { source_id: rp.website_id },
    });
  });

  return items;
}
