import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

interface Props {
  data: CustomerWorkbenchData;
}

type AuditLink = {
  id: string;
  label: string;
  amount: number;
  status: "paid" | "unpaid" | "payout";
  href: string;
};

export function CustomerCommissionsAuditStrip({ data }: Props) {
  const links: AuditLink[] = [];

  data.paymentRecords.slice(0, 3).forEach((p) => {
    links.push({
      id: `rev-${p.id}`,
      label: `Platba ${new Date(p.paid_at).toLocaleDateString("sk-SK")}`,
      amount: Number(p.amount) || 0,
      status: "paid",
      href: "/admin/finance?advanced=1&legacy=payments",
    });
  });

  data.commissions.slice(0, 5).forEach((c) => {
    links.push({
      id: `comm-${c.id}`,
      label: c.title,
      amount: Number(c.amount) || 0,
      status: c.payment_status === "paid" ? "payout" : "unpaid",
      href: "/admin/finance?advanced=1&legacy=commissions",
    });
  });

  const payoutByCommission = new Map(
    data.payoutRecords.map((p) => [p.source_id, p]),
  );

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
          const commissionPayout =
            link.id.startsWith("comm-") && payoutByCommission.get(link.id.replace("comm-", ""));
          return (
            <div key={link.id} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              <Link
                to={link.href}
                className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted/50 inline-flex flex-col gap-0.5 min-w-[100px]"
              >
                <span className="font-medium truncate max-w-[140px]">{link.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums font-semibold">{link.amount.toFixed(2)} €</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      link.status === "paid"
                        ? "border-green-500/40 text-green-700"
                        : link.status === "payout"
                          ? "border-green-500/40 text-green-700"
                          : "border-amber-500/40 text-amber-700"
                    }`}
                  >
                    {link.status === "paid"
                      ? "Príjem"
                      : link.status === "payout"
                        ? "Vyplatené"
                        : "Neuhradené"}
                  </Badge>
                  {commissionPayout && (
                    <Badge variant="outline" className="text-[9px] border-green-500/40">
                      payout ✓
                    </Badge>
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
