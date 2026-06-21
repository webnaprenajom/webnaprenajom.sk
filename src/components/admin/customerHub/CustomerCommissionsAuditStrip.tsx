import { Link } from "react-router-dom";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import { Badge } from "@/components/ui/badge";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { ArrowRight } from "lucide-react";
import {
  commissionHubStatusLabel,
  commissionHubStatusTone,
  hasConfirmedPayout,
  payoutRecordByCommissionId,
} from "@/lib/customerWorkbench/commissionHubTruth";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

interface Props {
  data: CustomerWorkbenchData;
}

type AuditLink = {
  id: string;
  label: string;
  amount: number;
  kind: "payment" | "commission";
  commissionId?: string;
  paymentStatus?: string;
  paymentTruthLevel?: string;
  href: string;
};

function statusBadgeClass(tone: "warning" | "success" | "muted"): string {
  if (tone === "success") return "border-green-500/40 text-green-700 dark:text-green-400";
  if (tone === "warning") return "border-amber-500/40 text-amber-700 dark:text-amber-400";
  return "border-muted-foreground/30 text-muted-foreground";
}

export function CustomerCommissionsAuditStrip({ data }: Props) {
  const links: AuditLink[] = [];
  const payoutByCommission = payoutRecordByCommissionId(data.payoutRecords);

  data.paymentRecords.slice(0, 3).forEach((p) => {
    links.push({
      id: `rev-${p.id}`,
      label: `Platba ${new Date(p.paid_at).toLocaleDateString("sk-SK")}`,
      amount: Number(p.amount) || 0,
      kind: "payment",
      paymentTruthLevel: p.truth_level,
      href: "/admin/finance?advanced=1&legacy=payments",
    });
  });

  data.commissions.slice(0, 5).forEach((c) => {
    links.push({
      id: `comm-${c.id}`,
      label: c.title,
      amount: Number(c.amount) || 0,
      kind: "commission",
      commissionId: c.id,
      paymentStatus: c.payment_status,
      href: "/admin/finance?advanced=1&legacy=commissions",
    });
  });

  if (links.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Provízie — audit reťazec</h3>
        <Link
          to="/admin/commissions"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Modul provízií <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {links.map((link, i) => {
          const payout =
            link.kind === "commission" && link.commissionId
              ? payoutByCommission.get(link.commissionId)
              : undefined;
          const confirmedPayout =
            link.kind === "commission" && link.commissionId
              ? hasConfirmedPayout(link.commissionId, data.payoutRecords)
              : false;

          return (
            <div key={link.id} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              <Link
                to={link.href}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted/50 inline-flex flex-col gap-0.5 min-w-[100px]"
              >
                <span className="font-medium truncate max-w-[160px]">{link.label}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular-nums font-semibold">{fmtEur(link.amount)}</span>
                  {link.kind === "payment" && link.paymentTruthLevel && (
                    <TruthLevelBadge level={link.paymentTruthLevel} className="text-[9px] h-4 px-1" />
                  )}
                  {link.kind === "commission" && link.commissionId && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${statusBadgeClass(
                          commissionHubStatusTone(link.paymentStatus || "unpaid", confirmedPayout),
                        )}`}
                      >
                        {commissionHubStatusLabel(link.paymentStatus || "unpaid", confirmedPayout)}
                      </Badge>
                      {payout && (
                        <TruthLevelBadge level={payout.truth_level} className="text-[9px] h-4 px-1" />
                      )}
                    </>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
