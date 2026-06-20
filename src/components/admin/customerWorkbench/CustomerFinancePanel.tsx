import { useMemo } from "react";
import { isConfirmedPayment } from "@/lib/finance/entityPaymentBridge";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { FINANCE_TRUTH_DISCLAIMER } from "@/lib/finance/labels";
import { buildFinanceSnapshot } from "@/lib/finance/buildFinanceSnapshot";
import type { FinanceRowKind } from "@/lib/finance/types";
import type { CustomerFinanceSummary, CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

interface Props {
  data: CustomerWorkbenchData;
  finance: CustomerFinanceSummary;
}

const LEDGER_KIND_LABELS: Record<FinanceRowKind, string> = {
  commission: "Provízia",
  expense: "Náklad",
  rental_receivable: "Prenájom",
  rental_credit_cost: "Prenájom (kredit)",
  payment_in: "Platba",
  payout_out: "Výplata",
  cost_out: "Náklad",
};

function FinanceMetric({
  label,
  value,
  tone,
  breakdown,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
  breakdown?: { level: string; amount: number }[];
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "success"
        ? "border-green-500/40 bg-green-500/5"
        : "";
  return (
    <div className={`rounded-lg border border-border px-3 py-2.5 space-y-1.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {breakdown && breakdown.filter((b) => b.amount > 0).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {breakdown
            .filter((b) => b.amount > 0)
            .map((b) => (
              <span key={b.level} className="inline-flex items-center gap-1">
                <TruthLevelBadge level={b.level} />
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {b.amount.toFixed(2)} €
                </span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function FinancePartialLoadBanner({ data }: { data: CustomerWorkbenchData }) {
  const hasError =
    data.paymentRecordsError || data.costRecordsError || data.payoutRecordsError;
  if (!hasError) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-200">
        Niektoré finančné dáta sa nepodarilo načítať. Skontrolujte spojenie.
      </p>
    </div>
  );
}

const MONTH_MS = 1000 * 60 * 60 * 24 * 31;

export function CustomerFinancePanel({ data, finance }: Props) {
  const rentalIds = new Set(data.rentals.map((r) => r.id));

  const snapshot = useMemo(
    () =>
      buildFinanceSnapshot({
        commissions: data.commissions.map((c) => ({
          id: c.id,
          date: c.date,
          title: c.title,
          implementer: "—",
          amount: c.amount,
          payment_status: c.payment_status,
          note: null,
        })),
        expenses: [],
        websites: data.rentals.map((r) => ({
          id: r.id,
          name: r.name,
          client_name: r.client_name,
          monthly_price: r.monthly_price,
          credits_used: 0,
          year: new Date().getFullYear(),
        })),
        payments: data.rentalPayments.map((rp) => ({
          id: rp.id,
          website_id: rp.website_id,
          year: rp.year,
          month: rp.month,
          amount: rp.amount,
          status: rp.status,
          custom_price: rp.custom_price,
        })),
        paymentRecords: data.paymentRecords,
        costRecords: data.costRecords,
        payoutRecords: data.payoutRecords,
      }),
    [data],
  );

  // Väzby: príjmy/náklady per prenájom (Golden Path: rental_websites -> payment/cost_records)
  const serviceRows = data.rentals.map((r) => {
    const income = data.paymentRecords
      .filter((p) => p.rental_website_id === r.id && isConfirmedPayment(p))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const cost = data.costRecords
      .filter((c) => c.rental_website_id === r.id && c.truth_level === "cost_fact")
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { id: r.id, name: r.name, income, cost };
  });
  const unlinkedIncome = data.paymentRecords
    .filter((p) => (!p.rental_website_id || !rentalIds.has(p.rental_website_id)) && isConfirmedPayment(p))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const unlinkedCost = data.costRecords
    .filter((c) => (!c.rental_website_id || !rentalIds.has(c.rental_website_id)) && c.truth_level === "cost_fact")
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // História platieb — posledných ~12 mesiacov
  const cutoff = Date.now() - 12 * MONTH_MS;
  const recentPayments = data.paymentRecords.filter(
    (p) => new Date(p.paid_at).getTime() >= cutoff,
  );
  const rentalNameById = new Map(data.rentals.map((r) => [r.id, r.name]));

  const revenueKnown = finance.paymentsReceivedFactTotal > 0;
  const confirmedPaymentCount = data.paymentRecords.filter(isConfirmedPayment).length;

  return (
    <div className="space-y-4">
      <FinancePartialLoadBanner data={data} />

      {/* Finančný súhrn */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceMetric
          label="Potvrdené platby"
          value={`${finance.paymentsReceivedTotal.toFixed(2)} €`}
          tone="success"
          breakdown={[
            { level: "payment_fact", amount: finance.paymentsReceivedFactTotal },
            { level: "legacy_import", amount: finance.paymentsReceivedLegacyTotal },
          ]}
        />
        <FinanceMetric
          label="Očakávané platby"
          value={`${finance.paymentsExpectedTotal.toFixed(2)} €`}
          tone={finance.paymentsExpectedTotal > 0 ? "warning" : "default"}
          breakdown={[{ level: "workflow_only", amount: finance.paymentsExpectedTotal }]}
        />
        <FinanceMetric
          label="Potvrdené náklady"
          value={`${finance.costsTotal.toFixed(2)} €`}
          tone={finance.costsTotal > 0 ? "warning" : "default"}
          breakdown={[
            { level: "cost_fact", amount: finance.costsFactTotal },
            { level: "legacy_import", amount: finance.costsLegacyTotal },
          ]}
        />
        <FinanceMetric
          label="Vyplatené provízie"
          value={`${finance.paidCommissionsTotal.toFixed(2)} €`}
          tone={finance.paidCommissionsTotal > 0 ? "warning" : "default"}
          breakdown={[{ level: "payout_fact", amount: finance.paidCommissionsTotal }]}
        />
        <FinanceMetric
          label="Hrubý zisk"
          value={finance.grossProfit.canShowProfit ? `${finance.grossProfit.profit!.toFixed(2)} €` : "—"}
          tone={
            !finance.grossProfit.canShowProfit
              ? "default"
              : (finance.grossProfit.profit ?? 0) >= 0
                ? "success"
                : "warning"
          }
        />
        <FinanceMetric
          label="Čistý zisk (po províziách)"
          value={finance.netProfitCanShow ? `${finance.netProfit!.toFixed(2)} €` : "—"}
          tone={
            !finance.netProfitCanShow
              ? "default"
              : (finance.netProfit ?? 0) >= 0
                ? "success"
                : "warning"
          }
        />
      </div>

      {(finance.grossProfit.canShowProfit || finance.paymentsReceivedLegacyTotal > 0) && (
        <EntityProfitBanner
          entityKind="customer"
          revenue={finance.paymentsReceivedTotal}
          operatingCost={finance.costsTotal}
          revenueKnown={revenueKnown}
          paymentRecordCount={confirmedPaymentCount}
        />
      )}
      {finance.paymentsReceivedLegacyTotal > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Legacy import {finance.paymentsReceivedLegacyTotal.toFixed(2)} € nie je potvrdený príjem — zobrazuje sa
          len v rozpise vyššie.
        </p>
      )}

      {snapshot.rows.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">
              Finančný ledger{" "}
              <span className="text-muted-foreground font-normal">({snapshot.rows.length})</span>
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Agregované záznamy z payment_records, cost_records, payout_records a workflow zdrojov
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Dátum</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Typ</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Zdroj</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Popis</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Suma</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Truth level</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      {row.date ? new Date(row.date).toLocaleDateString("sk-SK") : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{LEDGER_KIND_LABELS[row.kind]}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {row.linkedOriginLabel
                        ? `${row.linkedOriginLabel}${row.linkedOriginSublabel ? ` · ${row.linkedOriginSublabel}` : ""}`
                        : "—"}
                    </td>
                    <td className="p-3 truncate max-w-[240px]">{row.title}</td>
                    <td
                      className={`p-3 text-right tabular-nums font-medium ${
                        row.direction === "in" ? "text-green-700 dark:text-green-400" : ""
                      }`}
                    >
                      {row.direction === "out" ? "−" : "+"}
                      {row.amount.toFixed(2)} €
                    </td>
                    <td className="p-3">
                      <TruthLevelBadge level={row.truthLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snapshot.rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">
          Žiadne finančné záznamy pre tohto klienta
        </p>
      )}

      <p className="text-[10px] text-muted-foreground italic">{FINANCE_TRUTH_DISCLAIMER}</p>

      {/* Väzby: prenájmy -> príjmy/náklady */}
      <section className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Väzby na služby</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Príjmy a náklady podľa prenájmu (payment_records / cost_records cez rental_website_id)
          </p>
        </div>
        {serviceRows.length === 0 && unlinkedIncome === 0 && unlinkedCost === 0 ? (
          <p className="text-xs text-muted-foreground italic px-4 py-4">Žiadne prepojené služby.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Prenájom</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Príjmy</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Náklady</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-right tabular-nums">{row.income.toFixed(2)} €</td>
                    <td className="p-3 text-right tabular-nums">{row.cost.toFixed(2)} €</td>
                    <td className="p-3 text-right">
                      <Link to="/admin/rentals" className="text-primary hover:underline text-xs">
                        Prenájmy
                      </Link>
                    </td>
                  </tr>
                ))}
                {(unlinkedIncome > 0 || unlinkedCost > 0) && (
                  <tr className="border-b border-border/40 last:border-0">
                    <td className="p-3 text-muted-foreground italic">
                      Nepriradené k prenájmu (e-mail/meno)
                    </td>
                    <td className="p-3 text-right tabular-nums">{unlinkedIncome.toFixed(2)} €</td>
                    <td className="p-3 text-right tabular-nums">{unlinkedCost.toFixed(2)} €</td>
                    <td className="p-3" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Provízie vyplatené komu */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Vyplatené provízie podľa realizátora</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Z payout_records (source_table=commissions)
            </p>
          </div>
          <Link to="/admin/commissions">
            <span className="text-xs text-primary hover:underline">Provízie modul</span>
          </Link>
        </div>
        {finance.paidCommissionsByImplementer.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-4 py-4">
            Žiadne potvrdené výplaty provízií.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Realizátor</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Suma</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Počet výplat</th>
                </tr>
              </thead>
              <tbody>
                {finance.paidCommissionsByImplementer.map((row) => (
                  <tr key={row.implementer} className="border-b border-border/40 last:border-0">
                    <td className="p-3 font-medium">{row.implementer}</td>
                    <td className="p-3 text-right tabular-nums">{row.total.toFixed(2)} €</td>
                    <td className="p-3 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* História platieb */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">
              História platieb{" "}
              <span className="text-muted-foreground font-normal">({recentPayments.length})</span>
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Posledných 12 mesiacov</p>
          </div>
          <Link to="/admin/finance?advanced=1&legacy=payments">
            <span className="text-xs text-primary hover:underline">Finance modul</span>
          </Link>
        </div>
        {recentPayments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-4 py-4">
            Žiadne platby za posledných 12 mesiacov.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Dátum</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Prenájom</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Metóda</th>
                  <th className="text-right p-3 text-[11px] font-medium text-muted-foreground">Suma</th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground">Truth level</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString("sk-SK")}
                    </td>
                    <td className="p-3 truncate max-w-[180px]">
                      {(p.rental_website_id && rentalNameById.get(p.rental_website_id)) ||
                        p.client_name ||
                        "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.method || "—"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {Number(p.amount).toFixed(2)} {p.currency || "€"}
                    </td>
                    <td className="p-3">
                      <TruthLevelBadge level={p.truth_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
