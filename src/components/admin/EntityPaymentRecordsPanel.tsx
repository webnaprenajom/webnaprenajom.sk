import { fmtEur } from "@/lib/money/formatMoney";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import type { FactDraft } from "@/lib/finance/factDrafts";
import type { EntityPaymentRow } from "@/lib/finance/entityPaymentBridge";
import { toast } from "@/hooks/use-toast";
import { useAccessContext } from "@/hooks/useAccessContext";
import { canMutateFinanceRecords, writeDeniedMessage } from "@/lib/rbac/writePermissions";
import { Loader2 } from "lucide-react";

export type PaymentCreateAction = {
  key: string;
  label: string;
  disabled?: boolean;
  hint?: string | null;
  linkedExists?: boolean;
  buildDraft: () => FactDraft | null;
};

type Props = {
  payments: EntityPaymentRow[];
  loading?: boolean;
  createActions?: PaymentCreateAction[];
  variantLabel?: (row: EntityPaymentRow) => string | null;
  footerNote?: string;
  onSaved: () => void;
};

export function EntityPaymentRecordsPanel({
  payments,
  loading,
  createActions = [],
  variantLabel,
  footerNote,
  onSaved,
}: Props) {
  const access = useAccessContext();
  const canCreate = canMutateFinanceRecords(access);
  const [draft, setDraft] = useState<FactDraft | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = (action: PaymentCreateAction) => {
    if (!canCreate) {
      toast({ title: writeDeniedMessage("Vytvorenie platby"), variant: "destructive" });
      return;
    }
    if (action.linkedExists) {
      toast({ title: "Payment fact už existuje", variant: "destructive" });
      return;
    }
    const next = action.buildDraft();
    if (!next) {
      toast({
        title: "Nemožno vytvoriť draft",
        description: action.hint || "Chýbajú údaje alebo už existuje source-linked payment.",
        variant: "destructive",
      });
      return;
    }
    setDraft(next);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {footerNote ??
          "Potvrdená platba (payment_fact) je voliteľná — bez auto-sync. Workflow stav entity nie je auditovaný príjem."}
      </p>

      {createActions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {createActions.map((action) => {
            const blocked = !canCreate || action.disabled || action.linkedExists;
            return (
              <div key={action.key} className="space-y-0.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => openCreate(action)}
                >
                  {action.label}
                </Button>
                {blocked && action.hint && (
                  <p className="text-[10px] text-muted-foreground max-w-[220px]">{action.hint}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
          Žiadne platobné záznamy prepojené s touto entitou.
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Suma</TableHead>
                {variantLabel && <TableHead>Typ</TableHead>}
                <TableHead>Stav</TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("sk-SK") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{fmtEur(Number(p.amount || 0))}</TableCell>
                  {variantLabel && (
                    <TableCell className="text-xs">{variantLabel(p) || "—"}</TableCell>
                  )}
                  <TableCell>
                    <TruthLevelBadge level={p.truth_level as "payment_fact"} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FactConfirmDialog
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        mode="workflow"
        onSaved={() => {
          setOpen(false);
          setDraft(null);
          onSaved();
        }}
      />
    </div>
  );
}
