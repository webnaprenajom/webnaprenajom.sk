import { useMemo } from "react";
import { fmtEur } from "@/lib/money/formatMoney";
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
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import {
  groupDailyFinanceDetailRows,
  type DailyFinanceCommissionSummary,
  type DailyFinanceCostSummary,
  type DailyFinanceDetailKind,
  type DailyFinanceDetailRow,
} from "@/lib/finance/dailyFinanceDetail";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DailyFinanceDetailKind;
  title: string;
  subtitle?: string;
  rows: DailyFinanceDetailRow[];
  commissionSummary?: DailyFinanceCommissionSummary;
  costSummary?: DailyFinanceCostSummary;
}

export function FinanceDailyDetailDialog({
  open,
  onOpenChange,
  kind,
  title,
  subtitle,
  rows,
  commissionSummary,
  costSummary,
}: Props) {
  const groups = useMemo(() => groupDailyFinanceDetailRows(rows), [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </DialogHeader>

        {kind === "commission" && commissionSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <SummaryTile label="Počet záznamov" value={String(commissionSummary.rowCount)} />
            <SummaryTile label="Potenciál" value={fmtEur(commissionSummary.potential)} accent="text-primary" />
            <SummaryTile label="Vyplatené" value={fmtEur(commissionSummary.paid)} accent="text-green-600" />
            <SummaryTile label="Zostáva" value={fmtEur(commissionSummary.remaining)} accent="text-amber-600" />
          </div>
        )}

        {kind === "cost" && costSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <SummaryTile label="Počet záznamov" value={String(costSummary.rowCount)} />
            <SummaryTile label="Potvrdené" value={fmtEur(costSummary.confirmed)} accent="text-green-600" />
            <SummaryTile label="Legacy import" value={fmtEur(costSummary.legacy)} />
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Žiadne záznamy v tomto roku.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.sourceLabel} className="rounded-xl border overflow-hidden">
                <div className="px-3 py-2 border-b bg-muted/30 text-xs font-medium">
                  {group.sourceLabel}{" "}
                  <span className="text-muted-foreground font-normal">({group.rows.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Položka</TableHead>
                        {kind === "commission" && <TableHead>Realizátor</TableHead>}
                        <TableHead>Klient / protistrana</TableHead>
                        <TableHead className="text-right">
                          {kind === "commission" ? "Potenciál" : "Suma"}
                        </TableHead>
                        {kind === "commission" && (
                          <>
                            <TableHead className="text-right">Vyplatené</TableHead>
                            <TableHead className="text-right">Zostáva</TableHead>
                          </>
                        )}
                        <TableHead>Stav</TableHead>
                        <TableHead>Dátum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs font-medium max-w-[200px]">
                            <div>{row.sourceTitle}</div>
                            {row.note && (
                              <div className="text-[10px] text-muted-foreground truncate">{row.note}</div>
                            )}
                          </TableCell>
                          {kind === "commission" && (
                            <TableCell className="text-xs">{row.counterpartyName ?? "—"}</TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">
                            {row.customerName ?? row.counterpartyName ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{fmtEur(row.amount)}</TableCell>
                          {kind === "commission" && (
                            <>
                              <TableCell className="text-right text-xs text-green-600 tabular-nums">
                                {fmtEur(row.paidAmount)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-amber-600 tabular-nums">
                                {fmtEur(row.remainingAmount)}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-xs">
                            <div>{row.status}</div>
                            {row.truthLevel && (
                              <TruthLevelBadge level={row.truthLevel} className="mt-0.5" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {row.occurredAt || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}
