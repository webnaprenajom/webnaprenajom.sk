import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import type { CustomerFinanceSummary, WorkbenchTabId } from "@/lib/customerWorkbench/types";
import { ArrowRight } from "lucide-react";

interface Props {
  finance: CustomerFinanceSummary;
  onOpenTab: (tab: WorkbenchTabId) => void;
}

function KpiCell({
  label,
  value,
  tone,
  breakdown,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success" | "danger";
  breakdown?: { level: string; amount: number }[];
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "success"
        ? "border-green-500/40 bg-green-500/5"
        : tone === "danger"
          ? "border-red-500/40 bg-red-500/5"
          : "";
  return (
    <div className={`rounded-lg border border-border px-2.5 py-2 sm:px-3 min-w-0 ${toneClass}`}>
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div className="text-base sm:text-lg font-semibold tabular-nums">{value}</div>
      {breakdown && breakdown.filter((b) => b.amount > 0).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {breakdown
            .filter((b) => b.amount > 0)
            .map((b) => (
              <span key={b.level} className="inline-flex items-center gap-0.5">
                <TruthLevelBadge level={b.level} />
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {b.amount.toFixed(0)} €
                </span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

export function CustomerHubFinanceSnapshot({ finance, onOpenTab }: Props) {
  const grossDisplay = finance.grossProfit.canShowProfit
    ? `${finance.grossProfit.profit!.toFixed(2)} €`
    : "—";
  const netDisplay = finance.netProfitCanShow ? `${finance.netProfit!.toFixed(2)} €` : "—";

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Financie — prehľad</h3>
        <button
          type="button"
          onClick={() => onOpenTab("financie")}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Detail financií <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiCell
          label="Tržby"
          value={`${finance.paymentsReceivedTotal.toFixed(2)} €`}
          tone="success"
          breakdown={[
            { level: "payment_fact", amount: finance.paymentsReceivedFactTotal },
            { level: "legacy_import", amount: finance.paymentsReceivedLegacyTotal },
          ]}
        />
        <KpiCell
          label="Náklady"
          value={`${finance.costsTotal.toFixed(2)} €`}
          tone={finance.costsTotal > 0 ? "warning" : "default"}
          breakdown={[
            { level: "cost_fact", amount: finance.costsFactTotal },
            { level: "legacy_import", amount: finance.costsLegacyTotal },
          ]}
        />
        <KpiCell
          label="Hrubý zisk"
          value={grossDisplay}
          tone={finance.grossProfit.canShowProfit ? "success" : "default"}
          breakdown={
            finance.grossProfit.canShowProfit
              ? [{ level: "derived", amount: finance.grossProfit.profit ?? 0 }]
              : undefined
          }
        />
        <KpiCell
          label="Čistý zisk"
          value={netDisplay}
          tone={
            finance.netProfitCanShow
              ? (finance.netProfit ?? 0) >= 0
                ? "success"
                : "danger"
              : "default"
          }
          breakdown={
            finance.netProfitCanShow
              ? [{ level: "derived", amount: finance.netProfit ?? 0 }]
              : undefined
          }
        />
        <KpiCell
          label="Nezaplatené"
          value={`${finance.paymentsExpectedTotal.toFixed(2)} €`}
          tone={finance.paymentsExpectedTotal > 0 ? "danger" : "default"}
          breakdown={[{ level: "workflow_only", amount: finance.paymentsExpectedTotal }]}
        />
        <KpiCell
          label="Provízie vypl."
          value={`${finance.paidCommissionsTotal.toFixed(2)} €`}
          breakdown={[{ level: "payout_fact", amount: finance.paidCommissionsTotal }]}
        />
      </div>
    </section>
  );
}
