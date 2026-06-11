import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import {
  type FactDraft,
  type FinanceRawContext,
  getIssueActionLabel,
  isIssueActionable,
  prefillFromReconciliationIssue,
} from "@/lib/finance/factDrafts";
import { dismissIssue, revokeDismissal, type IssueDismissalRow } from "@/lib/finance/dismissals";
import { buildIssueKey, filterActiveIssues, isIssueDismissable } from "@/lib/finance/issueKeys";
import type { FinanceSnapshot, ReconciliationIssue, ReconciliationIssueKind } from "@/lib/finance/types";
import { toast } from "@/hooks/use-toast";

const ISSUE_LABELS: Record<ReconciliationIssueKind, string> = {
  workflow_incoming: "Workflow príjem",
  workflow_outgoing_commission: "Workflow výplata (provízia)",
  workflow_outgoing_expense: "Workflow náklad",
  legacy_no_reference: "Legacy bez referencie",
  legacy_imprecise_paid_at: "Legacy — odhadovaný dátum",
  missing_counterparty: "Chýba protistrana",
  potential_duplicate: "Možná duplicita",
};

type IssueFilter = "active" | "dismissed" | "all";

interface FinanceReconciliationProps {
  snapshot: FinanceSnapshot;
  ctx: FinanceRawContext;
  year: number;
  dismissals: IssueDismissalRow[];
  onSaved: () => void;
}

export function FinanceReconciliation({
  snapshot,
  ctx,
  year,
  dismissals,
  onSaved,
}: FinanceReconciliationProps) {
  const allIssues = snapshot.reconciliation.issues;
  const dismissedKeySet = useMemo(
    () => new Set(dismissals.map((d) => d.issue_key)),
    [dismissals],
  );
  const dismissalMap = useMemo(
    () => new Map(dismissals.map((d) => [d.issue_key, d])),
    [dismissals],
  );

  const [filter, setFilter] = useState<IssueFilter>("active");
  const [draft, setDraft] = useState<FactDraft | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "promote" | "workflow">("workflow");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<ReconciliationIssue | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissType, setDismissType] = useState<"dismissed" | "false_positive">("false_positive");

  const visibleIssues = useMemo(() => {
    if (filter === "active") return filterActiveIssues(allIssues, dismissedKeySet);
    if (filter === "dismissed") {
      return allIssues.filter((i) => dismissedKeySet.has(i.issueKey ?? buildIssueKey(i)));
    }
    return allIssues;
  }, [allIssues, dismissedKeySet, filter]);

  const activeCount = filterActiveIssues(allIssues, dismissedKeySet).length;

  const openAction = (issue: ReconciliationIssue) => {
    const prefill = prefillFromReconciliationIssue(issue, ctx);
    if (!prefill) return;
    setDraft(prefill);
    setDialogMode(
      issue.kind === "legacy_no_reference" || issue.kind === "legacy_imprecise_paid_at"
        ? "promote"
        : "workflow",
    );
    setDialogOpen(true);
  };

  const submitDismiss = async () => {
    if (!dismissTarget) return;
    const key = dismissTarget.issueKey ?? buildIssueKey(dismissTarget);
    try {
      await dismissIssue({
        issueKey: key,
        issueType: dismissTarget.kind,
        dismissalType: dismissType,
        reason: dismissReason || undefined,
      });
      toast({ title: "Problém zamietnutý" });
      setDismissTarget(null);
      setDismissReason("");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
  };

  const handleRevoke = async (issueKey: string) => {
    try {
      await revokeDismissal(issueKey);
      toast({ title: "Zamietnutie zrušené" });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Operatívny prehľad ({year} pre prenájmy). Aktívne: {activeCount}, zamietnuté: {dismissals.length}.
      </p>

      <div className="flex flex-wrap gap-2">
        {(["active", "dismissed", "all"] as IssueFilter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "active" ? "Aktívne" : f === "dismissed" ? "Zamietnuté" : "Všetky"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CountCard label="Aktívne problémy" count={activeCount} highlight />
        <CountCard label="Zamietnuté" count={dismissals.length} />
        <CountCard label="Možné duplicity" count={allIssues.filter((i) => i.kind === "potential_duplicate").length} />
        <CountCard label="Celkom raw" count={allIssues.length} />
      </div>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Problémy ({visibleIssues.length})</h2>
        </div>
        {visibleIssues.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {filter === "active" ? "Žiadne aktívne problémy." : "Žiadne problémy v tomto filtri."}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleIssues.slice(0, 150).map((issue, idx) => {
                  const key = issue.issueKey ?? buildIssueKey(issue);
                  const dismissed = dismissalMap.get(key);
                  const actionable = isIssueActionable(issue, ctx) && !dismissed;
                  const actionLabel = getIssueActionLabel(issue);
                  const dismissable = isIssueDismissable(issue) && !dismissed;
                  return (
                    <TableRow key={`${issue.kind}-${idx}`}>
                      <TableCell>
                        <Badge
                          variant={issue.severity === "warn" ? "destructive" : "outline"}
                          className="text-[10px] whitespace-nowrap"
                        >
                          {ISSUE_LABELS[issue.kind]}
                        </Badge>
                        {dismissed && (
                          <Badge variant="secondary" className="text-[10px] ml-1">
                            {dismissed.dismissal_type === "false_positive" ? "FP" : "DIS"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{issue.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {dismissed?.reason ? `${issue.detail} · ${dismissed.reason}` : issue.detail}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {issue.amount != null ? `${issue.amount.toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {actionable && actionLabel && (
                          <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => openAction(issue)}>
                            {actionLabel}
                          </Button>
                        )}
                        {dismissable && (
                          <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => setDismissTarget(issue)}>
                            Zamietnuť
                          </Button>
                        )}
                        {dismissed && (
                          <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => void handleRevoke(key)}>
                            Obnoviť
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FactConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        mode={dialogMode}
        onSaved={onSaved}
      />

      <Dialog open={!!dismissTarget} onOpenChange={(o) => !o && setDismissTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dismiss issue</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Skryje issue v aktívnom pohľade. Nemení source dáta.
          </p>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Typ</label>
            <select
              value={dismissType}
              onChange={(e) => setDismissType(e.target.value as "dismissed" | "false_positive")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="false_positive">Known false positive</option>
              <option value="dismissed">Dismissed (všeobecne)</option>
            </select>
            <label className="text-xs text-muted-foreground">Dôvod (voliteľné)</label>
            <Input value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} placeholder="Prečo je to OK?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissTarget(null)}>Zrušiť</Button>
            <Button onClick={() => void submitDismiss()}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountCard({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? "text-primary" : "text-foreground"}`}>{count}</div>
    </div>
  );
}
