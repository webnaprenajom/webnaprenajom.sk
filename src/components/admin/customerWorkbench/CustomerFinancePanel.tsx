import { Link } from "react-router-dom";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { FINANCE_TRUTH_DISCLAIMER } from "@/lib/finance/labels";
import type { CustomerFinanceSummary, CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

interface Props {
  data: CustomerWorkbenchData;
  finance: CustomerFinanceSummary;
}

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

const MONTH_MS = 1000 * 60 * 60 * 24 * 31;

export function CustomerFinancePanel({ data, finance }: Props) {
  const rentalIds = new Set(data.rentals.map((r) => r.id));

  // Väzby: príjmy/náklady per prenájom (Golden Path: rental_websites -> payment/cost_records)
  const serviceRows = data.rentals.map((r) => {
    const income = data.paymentRecords
      .filter((p) => p.rental_website_id === r.id)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const cost = data.costRecords
      .filter((c) => c.rental_website_id === r.id)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { id: r.id, name: r.name, income, cost };
  });
  const unlinkedIncome = data.paymentRecords
    .filter((p) => !p.rental_website_id || !rentalIds.has(p.rental_website_id))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const unlinkedCost = data.costRecords
    .filter((c) => !c.rental_website_id || !rentalIds.has(c.rental_website_id))
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // História platieb — posledných ~12 mesiacov
  const cutoff = Date.now() - 12 * MONTH_MS;
  const recentPayments = data.paymentRecords.filter(
    (p) => new Date(p.paid_at).getTime() >= cutoff,
  );
  const rentalNameById = new Map(data.rentals.map((r) => [r.id, r.name]));

  return (
    <div className="space-y-4">
      {/* Finančný súhrn */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FinanceMetric
          label="Prijaté platby"
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
          label="Náklady"
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

      <EntityProfitBanner
        entityKind="customer"
        revenue={finance.paymentsReceivedTotal}
        operatingCost={finance.costsTotal}
        revenueKnown
        paymentRecordCount={data.paymentRecords.length}
      />

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
