import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AdminDialog } from "@/components/admin/AdminDialog";
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
import { paymentFormLabel } from "@/lib/paymentForm";
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

function CommissionDetailRow({ c }: { c: CommissionRow }) {
  const linkStatus = getCommissionLinkStatus(c);
  const sourceHref = sourceDetailHref(c.source_type as any, c.source_id);
  const sourceLabel =
    c.source_type && c.source_type !== "other"
      ? COMMISSION_SOURCE_LABELS[c.source_type as keyof typeof COMMISSION_SOURCE_LABELS] ?? c.source_type
      : c.source_type === "other"
        ? COMMISSION_SOURCE_LABELS.other
        : "Legacy";

  return (
    <>
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
          <Link
            to={adminCustomerHref(c.customer_email)!}
            className="text-primary hover:underline truncate block max-w-[140px]"
          >
            {c.customer_email}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap">
        {Number(c.amount || 0).toFixed(2)} €
      </TableCell>
      <TableCell className="text-xs hidden lg:table-cell">{paymentFormLabel(c.payment_form)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
          {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate hidden md:table-cell">
        {c.note || "—"}
      </TableCell>
    </>
  );
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
    const legacy = rows.filter((r) => getCommissionLinkStatus(r) === "legacy").length;
    return { paid, unpaid, count: rows.length, linked, legacy };
  }, [rows]);

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange} size="xl" title={<>Provízie — {implementer}</>}>
        <p className="text-xs text-muted-foreground -mt-2">
          Všetky sekcie (prenájmy, hosting, projekty) + legacy riadky bez zdroja.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3">
          <span className="text-green-600">Vyplatené: {totals.paid.toFixed(2)} €</span>
          <span className="text-amber-600">Nezaplatené: {totals.unpaid.toFixed(2)} €</span>
          <span className="text-muted-foreground">{totals.count} riadkov</span>
          <span className="text-muted-foreground">{totals.linked} prepojených</span>
          {totals.legacy > 0 && (
            <span className="text-amber-700 dark:text-amber-400">{totals.legacy} legacy</span>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žiadne provízne riadky.</p>
        ) : (
          <>
            <div className="hidden md:block rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Prepojenie</TableHead>
                    <TableHead>Zdroj</TableHead>
                    <TableHead>Názov</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Pozn.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <CommissionDetailRow c={c} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-2">
              {rows.map((c) => {
                const linkStatus = getCommissionLinkStatus(c);
                const sourceHref = sourceDetailHref(c.source_type as any, c.source_id);
                const sourceLabel =
                  c.source_type && COMMISSION_SOURCE_LABELS[c.source_type as keyof typeof COMMISSION_SOURCE_LABELS]
                    ? COMMISSION_SOURCE_LABELS[c.source_type as keyof typeof COMMISSION_SOURCE_LABELS]
                    : linkStatus === "legacy"
                      ? "Legacy"
                      : "—";
                return (
                  <div key={c.id} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{resolveCommissionSourceLabel(c)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.date).toLocaleDateString("sk-SK")}
                        </p>
                      </div>
                      <CommissionLinkBadge status={linkStatus} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {sourceHref ? (
                        <Link to={sourceHref} className="text-primary hover:underline">
                          {sourceLabel}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{sourceLabel}</span>
                      )}
                      {c.customer_email && (
                        <Link to={adminCustomerHref(c.customer_email)!} className="text-primary hover:underline truncate">
                          {c.customer_email}
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{Number(c.amount || 0).toFixed(2)} €</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
                        {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{paymentFormLabel(c.payment_form)}</span>
                    </div>
                    {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
    </AdminDialog>
  );
}
