import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  COMMISSION_SOURCE_LABELS,
  type CommissionRow,
  getCommissionLinkStatus,
  resolveCommissionSourceLabel,
  sourceDetailHref,
} from "@/lib/commissionSource";
import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";
import { adminCustomerHref } from "@/lib/adminNav";
import { CommissionLinkBadge } from "@/components/admin/lookup/LinkStatusBadge";

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-green-500/15 text-green-500 border-green-500/30",
  unpaid: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  implementer: string;
  commissions: CommissionRow[];
}

export function FinanceImplementerDetailDialog({ open, onOpenChange, implementer, commissions }: Props) {
  const rows = useMemo(
    () =>
      commissions
        .filter((c) => (c.implementer || "").trim() === implementer.trim())
        .sort((a, b) => {
          const dt = new Date(b.date).getTime() - new Date(a.date).getTime();
          return dt !== 0 ? dt : b.id.localeCompare(a.id);
        }),
    [commissions, implementer],
  );

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const unpaid = rows.filter((r) => r.payment_status === "unpaid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const linked = rows.filter((r) => getCommissionLinkStatus(r) === "linked").length;
    return { paid, unpaid, count: rows.length, linked };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provízie — {implementer}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-4 text-xs mb-3">
          <span className="text-green-600">Vyplatené: {totals.paid.toFixed(2)} €</span>
          <span className="text-amber-600">Nezaplatené: {totals.unpaid.toFixed(2)} €</span>
          <span className="text-muted-foreground">{totals.count} riadkov</span>
          <span className="text-muted-foreground">{totals.linked} prepojených</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žiadne provízne riadky.</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Prepojenie</TableHead>
                  <TableHead>Zdroj</TableHead>
                  <TableHead>Názov</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Pozn.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const linkStatus = getCommissionLinkStatus(c);
                  const sourceHref = sourceDetailHref(c.source_type as any, c.source_id);
                  const sourceLabel =
                    c.source_type && c.source_type !== "other"
                      ? COMMISSION_SOURCE_LABELS[c.source_type as keyof typeof COMMISSION_SOURCE_LABELS] ?? c.source_type
                      : c.source_type === "other"
                        ? COMMISSION_SOURCE_LABELS.other
                        : "—";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(c.date).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <CommissionLinkBadge status={linkStatus} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {sourceHref ? (
                          <Link to={sourceHref} className="text-primary hover:underline">
                            {sourceLabel}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{sourceLabel}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{resolveCommissionSourceLabel(c)}</TableCell>
                      <TableCell className="text-xs">
                        {c.customer_email ? (
                          <Link to={adminCustomerHref(c.customer_email)!} className="text-primary hover:underline truncate block max-w-[140px]">
                            {c.customer_email}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {Number(c.amount || 0).toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
                          {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {c.note || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
