import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildSettlementDrafts } from "@/lib/finance/buildSettlementDrafts";
import { BatchPayoutReviewDialog } from "@/components/admin/finance/BatchPayoutReviewDialog";
import type { FinanceRawContext } from "@/lib/finance/factDrafts";
import type { SettlementDraft } from "@/lib/finance/types";
import type { CommissionRule, CommissionRuleOverride } from "@/lib/finance/commissionRules";

interface FinanceSettlementDraftsProps {
  ctx: FinanceRawContext;
  rules: CommissionRule[];
  overrides: CommissionRuleOverride[];
  onSaved: () => void;
}

export function FinanceSettlementDrafts({ ctx, rules, overrides, onSaved }: FinanceSettlementDraftsProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);

  const drafts = useMemo(
    () =>
      buildSettlementDrafts({
        commissions: ctx.commissions,
        payoutRecords: ctx.payoutRecords,
        year,
        month,
        rules,
        overrides,
        websites: ctx.websites,
      }),
    [ctx, year, month, rules, overrides],
  );

  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const draftKey = (d: SettlementDraft) => `${d.implementer}-${d.periodLabel}`;

  const selectedDrafts = drafts.filter((d) => selected.has(draftKey(d)));
  const selectableDrafts = drafts.filter((d) => d.pendingCommissions.length > 0);

  const toggleSelect = (d: SettlementDraft) => {
    const key = draftKey(d);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === selectableDrafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableDrafts.map(draftKey)));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Operatívny návrh výplaty — nie účtovný fakt. Effective rate je advisory preview (bez retroaktívnej mutácie).
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setSelected(new Set()); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); setSelected(new Set()); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
          ))}
        </select>
        {selectableDrafts.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={toggleAll}>
              {selected.size === selectableDrafts.length ? "Odznačiť všetko" : "Vybrať všetkých"}
            </Button>
            <Button
              size="sm"
              disabled={selectedDrafts.length === 0}
              onClick={() => setBatchOpen(true)}
            >
              Vytvoriť payout facts ({selectedDrafts.length})
            </Button>
          </>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center border rounded-xl">
          Žiadna provízna aktivita v období {periodLabel}.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Implementér</TableHead>
                <TableHead>Obdobie</TableHead>
                <TableHead className="text-right">Rate preview</TableHead>
                <TableHead>Rule source</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Legacy import</TableHead>
                <TableHead className="text-right">Confirmed payout</TableHead>
                <TableHead className="text-right">Workflow only</TableHead>
                <TableHead className="text-right">Suggested gap</TableHead>
                <TableHead>Warnings / hints</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d) => {
                const key = draftKey(d);
                const canSelect = d.pendingCommissions.length > 0;
                const allHints = [...d.warnings, ...(d.syncHints ?? [])];
                return (
                  <TableRow key={key}>
                    <TableCell>
                      {canSelect ? (
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggleSelect(d)}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{d.implementer}</TableCell>
                    <TableCell className="text-xs">{d.periodLabel}</TableCell>
                    <TableCell className="text-right text-sm">
                      {d.effectiveRatePreview != null ? `${d.effectiveRatePreview}%` : "—"}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                      {d.rateSourceLabel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{d.pendingCommissions.length}</TableCell>
                    <TableCell className="text-right text-sm">{d.legacyImportAmount.toFixed(2)} €</TableCell>
                    <TableCell className="text-right text-sm text-green-600">
                      {d.confirmedPayoutAmount.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {d.workflowOnlyAmount.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-amber-600">
                      {d.suggestedGap.toFixed(2)} €
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {allHints.length === 0 ? (
                          <Badge variant="outline" className="text-[10px]">OK</Badge>
                        ) : (
                          allHints.map((w) => (
                            <Badge
                              key={w}
                              variant={d.syncHints?.includes(w) ? "outline" : "secondary"}
                              className="text-[10px]"
                            >
                              {w}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <BatchPayoutReviewDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        drafts={selectedDrafts}
        ctx={ctx}
        periodLabel={periodLabel}
        onSaved={onSaved}
      />
    </div>
  );
}
