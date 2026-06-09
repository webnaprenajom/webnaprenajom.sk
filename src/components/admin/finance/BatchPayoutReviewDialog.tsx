import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { buildBatchPayoutPlan, saveBatchPayoutFacts } from "@/lib/finance/buildBatchPayoutPlan";
import type { FinanceRawContext } from "@/lib/finance/factDrafts";
import type { SettlementDraft } from "@/lib/finance/types";

interface BatchPayoutReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: SettlementDraft[];
  ctx: FinanceRawContext;
  periodLabel: string;
  onSaved: () => void;
}

export function BatchPayoutReviewDialog({
  open,
  onOpenChange,
  drafts,
  ctx,
  periodLabel,
  onSaved,
}: BatchPayoutReviewDialogProps) {
  const [saving, setSaving] = useState(false);
  const plan = useMemo(() => buildBatchPayoutPlan(drafts, ctx), [drafts, ctx]);
  const toCreate = plan.filter((p) => !p.skipped);
  const skipped = plan.filter((p) => p.skipped);
  const totalAmount = toCreate.reduce((s, p) => s + p.amount, 0);

  const confirm = async () => {
    if (toCreate.length === 0) {
      toast({ title: "Nič na vytvorenie", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await saveBatchPayoutFacts(plan, periodLabel);
      toast({
        title: "Batch payout dokončený",
        description: `Vytvorených ${result.created}, preskočených ${result.skipped}`,
      });
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba batch vytvárania";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review batch payout facts — {periodLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
          Vytvorí sa jeden payout_fact na každú workflow-only províziu (source-linked). Effective rate je advisory preview — payout suma sa nemení.
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Implementéri</div>
            <div className="font-medium">{drafts.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Na vytvorenie</div>
            <div className="font-medium text-green-600">{toCreate.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Suma</div>
            <div className="font-medium">{totalAmount.toFixed(2)} €</div>
          </div>
        </div>
        {plan.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Žiadne pending provízie v batchi.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provízia</TableHead>
                  <TableHead>Implementér</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.map((p) => (
                  <TableRow key={p.commissionId}>
                    <TableCell className="text-xs max-w-[120px] truncate">{p.title}</TableCell>
                    <TableCell className="text-xs">{p.implementer}</TableCell>
                    <TableCell className="text-right text-xs">
                      {p.effectiveRate != null ? `${p.effectiveRate}%` : "—"}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[100px] truncate">
                      {p.rateSourceLabel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">{p.amount.toFixed(2)} €</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {p.skipped ? p.skipReason : "Vytvorí sa"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {skipped.length > 0 && (
          <p className="text-[10px] text-amber-600">{skipped.length} položiek preskočených (duplicita / existujúci payout).</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušiť</Button>
          <Button onClick={() => void confirm()} disabled={saving || toCreate.length === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Potvrdiť batch ({toCreate.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
