import { Fragment, useMemo, useState } from "react";
import { fmtEur } from "@/lib/money/formatMoney";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CommissionRow,
  sourceDetailHref,
} from "@/lib/commissionSource";
import { COMMISSION_PAYOUT_STATUS_LABELS } from "@/lib/finance/commissionPayoutStatus";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { paymentFormLabel } from "@/lib/paymentForm";
import { adminCustomerHref } from "@/lib/adminNav";
import { useHistoricalIdentity } from "@/hooks/useHistoricalIdentity";
import { formatImplementerLabel } from "@/lib/identity/historicalIdentity";
import {
  buildImplementerCommissionViewRows,
  filterImplementerCommissionRowsByTab,
  IMPLEMENTER_COMMISSION_TAB_LABELS,
  summarizeImplementerCommissionViewRows,
  type ImplementerCommissionTab,
  type ImplementerCommissionViewRow,
} from "@/lib/finance/implementerCommissionView";
import {
  DEAL_PAYOUT_STATUS_LABELS,
  dealPayoutStatusClass,
} from "@/lib/finance/rentalCommissionDeal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  implementer: string;
  commissions: CommissionRow[];
  payoutRecords?: PayoutRecordLike[];
  websites?: Array<{ id: string; name?: string | null; client_name?: string | null; monthly_price?: number | null; implementers?: unknown }>;
  payments?: Array<{
    website_id: string;
    year: number;
    month: number;
    status?: string | null;
    paid?: boolean | null;
    custom_price?: number | null;
    amount?: number | null;
  }>;
  year?: number;
}

const TABS: ImplementerCommissionTab[] = ["all", "rental", "hosting", "marketing", "project"];

function TabTotals({ rows }: { rows: ImplementerCommissionViewRow[] }) {
  const t = summarizeImplementerCommissionViewRows(rows);
  if (t.count === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Žiadne provízie v tejto záložke.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
      <div className="rounded border p-2">
        <div className="text-[10px] text-muted-foreground">Počet</div>
        <div className="font-semibold">{t.count}</div>
      </div>
      <div className="rounded border p-2">
        <div className="text-[10px] text-muted-foreground">Potenciál</div>
        <div className="font-semibold text-primary">{fmtEur(t.potential)}</div>
      </div>
      <div className="rounded border p-2">
        <div className="text-[10px] text-muted-foreground">Vyplatené</div>
        <div className="font-semibold text-green-600">{fmtEur(t.paid)}</div>
      </div>
      <div className="rounded border p-2">
        <div className="text-[10px] text-muted-foreground">Ostáva</div>
        <div className="font-semibold text-amber-600">{fmtEur(t.remaining)}</div>
      </div>
    </div>
  );
}

function CommissionRowDetail({ row }: { row: ImplementerCommissionViewRow }) {
  const sourceHref =
    row.linkedSourceId &&
    row.sourceType !== "legacy" &&
    row.sourceType !== "other" &&
    row.sourceType !== "task"
      ? sourceDetailHref(row.sourceType, row.linkedSourceId)
      : null;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <span className="text-muted-foreground">Zdroj: </span>
          {sourceHref ? (
            <Link to={sourceHref} className="text-primary hover:underline">
              {row.sourceLabel}
            </Link>
          ) : (
            row.sourceLabel
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Klient: </span>
          {row.customerName ? (
            adminCustomerHref(row.customerName) ? (
              <Link to={adminCustomerHref(row.customerName)!} className="text-primary hover:underline">
                {row.customerName}
              </Link>
            ) : (
              row.customerName
            )
          ) : (
            "—"
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Forma: </span>
          {paymentFormLabel(row.paymentForm)}
        </div>
        {row.workflowPaidUnaudited && (
          <div className="text-amber-700 dark:text-amber-400">
            {COMMISSION_PAYOUT_STATUS_LABELS.paid_workflow_unaudited}
          </div>
        )}
      </div>
      {row.note && (
        <p className="text-muted-foreground">
          <span className="font-medium">Poznámka:</span> {row.note}
        </p>
      )}
      <div>
        <div className="font-medium mb-1">História výplat</div>
        {row.payoutHistory.length === 0 ? (
          <p className="text-muted-foreground">Zatiaľ žiadne auditované výplaty.</p>
        ) : (
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Forma / ref.</TableHead>
                  <TableHead>Poznámka</TableHead>
                  <TableHead>Truth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.payoutHistory.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.paid_at).toLocaleString("sk-SK")}</TableCell>
                    <TableCell className="text-right">{fmtEur(p.amount)}</TableCell>
                    <TableCell>{p.reference || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[160px] truncate">{p.note || "—"}</TableCell>
                    <TableCell>
                      {p.truth_level === "payout_fact" || p.truth_level === "legacy_import" ? (
                        <TruthLevelBadge level={p.truth_level} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function CommissionList({
  rows,
  expandedId,
  onToggle,
}: {
  rows: ImplementerCommissionViewRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-x-auto table-dense">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dátum</TableHead>
            <TableHead>Zdroj</TableHead>
            <TableHead>Názov</TableHead>
            <TableHead className="text-right">Potenciál</TableHead>
            <TableHead className="text-right">Vyplatené</TableHead>
            <TableHead className="text-right">Ostáva</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead className="w-[72px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <TableRow className={expanded ? "bg-muted/30" : undefined}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(row.sortDate).toLocaleDateString("sk-SK")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {row.sourceLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[180px] truncate" title={row.sourceTitle}>
                    {row.sourceTitle}
                  </TableCell>
                  <TableCell className="text-right text-sm">{fmtEur(row.potentialAmount)}</TableCell>
                  <TableCell className="text-right text-sm text-green-600">{fmtEur(row.paidAmount)}</TableCell>
                  <TableCell className="text-right text-sm text-amber-600">{fmtEur(row.remainingAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${dealPayoutStatusClass(row.payoutStatus)}`}>
                      {DEAL_PAYOUT_STATUS_LABELS[row.payoutStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px]"
                      onClick={() => onToggle(row.id)}
                    >
                      {expanded ? "Skryť" : "Detail"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={8} className="py-3">
                      <CommissionRowDetail row={row} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function FinanceImplementerDetailDialog({
  open,
  onOpenChange,
  implementer,
  commissions,
  payoutRecords = [],
  websites = [],
  payments = [],
  year = new Date().getFullYear(),
}: Props) {
  const [tab, setTab] = useState<ImplementerCommissionTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { historicalIdentity } = useHistoricalIdentity(open);

  const allRows = useMemo(
    () =>
      buildImplementerCommissionViewRows({
        implementer,
        year,
        commissions,
        payoutRecords,
        websites,
        payments,
      }),
    [implementer, year, commissions, payoutRecords, websites, payments],
  );

  const globalSummary = useMemo(() => summarizeImplementerCommissionViewRows(allRows), [allRows]);

  const rowsByTab = useMemo(() => {
    const map = new Map<ImplementerCommissionTab, ImplementerCommissionViewRow[]>();
    for (const t of TABS) {
      map.set(t, filterImplementerCommissionRowsByTab(allRows, t));
    }
    return map;
  }, [allRows]);

  const toggleExpand = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Provízie — {formatImplementerLabel(implementer, historicalIdentity)} ({year})
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Potenciál</div>
            <div className="font-semibold text-primary">{fmtEur(globalSummary.potential)}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Vyplatené</div>
            <div className="font-semibold text-green-600">{fmtEur(globalSummary.paid)}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Ostáva vyplatiť</div>
            <div className="font-semibold text-amber-600">{fmtEur(globalSummary.remaining)}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[10px] text-muted-foreground">Stavy</div>
            <div className="text-[11px] leading-snug">
              {globalSummary.statusCounts.unpaid} nevypl. ·{" "}
              {globalSummary.statusCounts.partially_paid} čiastoč. ·{" "}
              {globalSummary.statusCounts.paid} vypl.
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImplementerCommissionTab)}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs">
                {IMPLEMENTER_COMMISSION_TAB_LABELS[t]}
                {t !== "all" && (
                  <span className="ml-1 text-muted-foreground">
                    ({rowsByTab.get(t)?.length ?? 0})
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => {
            const tabRows = rowsByTab.get(t) ?? [];
            return (
              <TabsContent key={t} value={t} className="mt-3 space-y-2">
                <TabTotals rows={tabRows} />
                <CommissionList rows={tabRows} expandedId={expandedId} onToggle={toggleExpand} />
              </TabsContent>
            );
          })}
        </Tabs>

        <p className="text-[10px] text-muted-foreground">
          Vyplatené = súčet auditovaných <code className="text-[10px]">payout_records</code>. Workflow flagy
          sú len v detaile riadku. Prenájmy = jedna zákazka na web+rok bez duplicity JSON/commission.
        </p>
      </DialogContent>
    </Dialog>
  );
}
