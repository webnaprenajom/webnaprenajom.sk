import { resolveProfitDisplayContext, type ProfitEntityKind } from "@/lib/profit/profitContext";
import { AlertTriangle, Info } from "lucide-react";

interface Props {
  entityKind: ProfitEntityKind;
  revenue: number;
  operatingCost?: number;
  /** When false, do not compute profit (e.g. project without payment_records loaded). */
  revenueKnown?: boolean;
  paymentRecordCount?: number;
}

/** Profit banner with explicit revenue basis and safe fallbacks (RC6 / RC6.5). */
export function EntityProfitBanner({
  entityKind,
  revenue,
  operatingCost = 0,
  revenueKnown = true,
  paymentRecordCount,
}: Props) {
  const ctx = resolveProfitDisplayContext({
    entityKind,
    revenueKnown,
    revenue,
    operatingCost,
    paymentRecordCount,
  });

  const tone =
    ctx.status === "complete"
      ? "border-border bg-muted/30"
      : ctx.status === "cost_without_revenue"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border bg-muted/20";

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${tone}`}>
      <div className="flex items-start gap-2">
        {ctx.canShowProfit ? (
          <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-foreground">Základ provízie (zisk)</p>
          <p className="text-muted-foreground">{ctx.headline}</p>
          <p className="text-[10px] text-muted-foreground">{ctx.detail}</p>
          <p className="text-[10px] text-muted-foreground italic">
            Zdroj tržieb: {ctx.revenueBasisLabel}
            {paymentRecordCount != null &&
            (entityKind === "project" || entityKind === "marketing") &&
            revenueKnown
              ? ` · ${paymentRecordCount} potvrdených platieb`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
