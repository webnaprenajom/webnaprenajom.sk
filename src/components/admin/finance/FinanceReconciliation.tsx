import { fmtEur } from "@/lib/money/formatMoney";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
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
import {
  filterOwnerPrimaryReconciliationIssues,
  isFinanceAdvisoryDiagnosticIssue,
  summarizeReconciliationIssueCounts,
} from "@/lib/finance/issuePresentation";
import type {
  FinanceSnapshot,
  ReconciliationIssue,
  ReconciliationIssueKind,
} from "@/lib/finance/types";
import { formatReconciliationSourceHint } from "@/lib/finance/financeSourceLabels";
import { toast } from "@/hooks/use-toast";

const ISSUE_LABELS: Record<ReconciliationIssueKind, string> = {
  workflow_incoming: "Workflow príjem",
  workflow_outgoing_commission: "Workflow výplata (provízia)",
  workflow_outgoing_expense: "Workflow náklad",
  entity_missing_payment_fact: "Chýba potvrdená platba",
  entity_partial_payment: "Nedoplatok (čiastková úhrada)",
  task_missing_payment_deposit: "Úloha — chýba záloha (legacy)",
  task_missing_payment_full: "Úloha — chýba úhrada (legacy)",
  entity_payment_ahead_of_workflow: "Platba pred workflow",
  legacy_no_reference: "Legacy bez referencie",
  legacy_imprecise_paid_at: "Legacy — odhadovaný dátum",
  missing_counterparty: "Chýba protistrana",
  potential_duplicate: "Možná duplicita",
};

type IssueFilter = "active" | "dismissed" | "all";

type IssueSection = {
  id: string;
  title: string;
  kinds: ReconciliationIssueKind[];
};

const PRIMARY_ISSUE_SECTIONS: IssueSection[] = [
  {
    id: "rentals",
    title: "Prenájmy",
    kinds: ["workflow_incoming"],
  },
  {
    id: "outgoing",
    title: "Provízie & náklady",
    kinds: ["workflow_outgoing_commission", "workflow_outgoing_expense"],
  },
  {
    id: "entities",
    title: "Projekty, marketing & hosting",
    kinds: ["entity_missing_payment_fact", "entity_partial_payment"],
  },
  {
    id: "legacy",
    title: "Legacy import",
    kinds: ["legacy_no_reference", "legacy_imprecise_paid_at"],
  },
];

const ADVISORY_DIAGNOSTIC_SECTION: IssueSection = {
  id: "advisory",
  title: "Diagnostika (heuristika)",
  kinds: ["missing_counterparty", "potential_duplicate", "entity_payment_ahead_of_workflow"],
};

const LEGACY_ISSUE_SECTION: IssueSection = {
  id: "tasks",
  title: "Úlohy (legacy, bez akcie)",
  kinds: ["task_missing_payment_deposit", "task_missing_payment_full"],
};

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
    let list = allIssues;
    if (filter === "active") list = filterActiveIssues(allIssues, dismissedKeySet);
    else if (filter === "dismissed") {
      list = allIssues.filter((i) => dismissedKeySet.has(i.issueKey ?? buildIssueKey(i)));
    }
    return filterOwnerPrimaryReconciliationIssues(list);
  }, [allIssues, dismissedKeySet, filter]);

  const advisoryDiagnosticIssues = useMemo(() => {
    if (filter === "dismissed") return [];
    const base =
      filter === "active" ? filterActiveIssues(allIssues, dismissedKeySet) : allIssues;
    return base.filter((i) => isFinanceAdvisoryDiagnosticIssue(i));
  }, [allIssues, dismissedKeySet, filter]);

  const issueSummary = useMemo(
    () => summarizeReconciliationIssueCounts(allIssues, dismissedKeySet, ctx),
    [allIssues, dismissedKeySet, ctx],
  );

  const legacyVisibleIssues = useMemo(() => {
    if (filter === "dismissed") return [];
    const base =
      filter === "active" ? filterActiveIssues(allIssues, dismissedKeySet) : allIssues;
    return base.filter((i) => LEGACY_ISSUE_SECTION.kinds.includes(i.kind));
  }, [allIssues, dismissedKeySet, filter]);

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

  const confirmAsValid = async (issue: ReconciliationIssue) => {
    const key = issue.issueKey ?? buildIssueKey(issue);
    try {
      await dismissIssue({
        issueKey: key,
        issueType: issue.kind,
        dismissalType: "false_positive",
        reason: "Potvrdené ako validné",
      });
      toast({ title: "Označené ako validné" });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    }
  };

  const sectionIssues = useMemo(() => {
    const visibleSet = new Set(visibleIssues.map((i) => i.issueKey ?? buildIssueKey(i)));
    return PRIMARY_ISSUE_SECTIONS.map((section) => ({
      ...section,
      issues: allIssues.filter(
        (i) =>
          section.kinds.includes(i.kind) &&
          visibleSet.has(i.issueKey ?? buildIssueKey(i)),
      ),
    })).filter((s) => s.issues.length > 0);
  }, [allIssues, visibleIssues]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
        <strong>Zladenie výnimiek</strong> medzi workflow a auditovanými záznamami ({year} pre
        prenájmy). Položky s tlačidlom <strong>Potvrdiť</strong> vyžadujú akciu; heuristické
        upozornenia sú v sekcii „Zobraziť diagnostiku“. Zamietnuté: {dismissals.length}.
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

      <div className="flex flex-wrap gap-2">
        <CountCard
          label="Vyžaduje akciu"
          count={issueSummary.actionableCount}
          highlight={issueSummary.actionableCount > 0}
          variant="action"
        />
        {issueSummary.advisoryCount > 0 && (
          <CountCard label="Len kontrola / dismiss" count={issueSummary.advisoryCount} />
        )}
        {issueSummary.hiddenLegacyCount > 0 && (
          <CountCard label="Legacy úlohy (skryté)" count={issueSummary.hiddenLegacyCount} muted />
        )}
      </div>

      {visibleIssues.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          {filter === "active"
            ? "Žiadne aktívne problémy v primárnom pohľade."
            : "Žiadne problémy v tomto filtri."}
        </div>
      ) : (
        <div className="space-y-4">
          {sectionIssues.map((section) => (
            <IssueSectionTable
              key={section.id}
              title={`${section.title} (${section.issues.length})`}
              issues={section.issues}
              ctx={ctx}
              dismissalMap={dismissalMap}
              onAction={openAction}
              onDismiss={setDismissTarget}
              onRevoke={handleRevoke}
              onConfirmValid={(issue) => void confirmAsValid(issue)}
            />
          ))}
        </div>
      )}

      {advisoryDiagnosticIssues.length > 0 && (
        <Collapsible className="rounded-xl border border-dashed border-border/80">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs text-muted-foreground hover:bg-muted/30">
            <span>
              Zobraziť diagnostiku ({advisoryDiagnosticIssues.length}) — heuristika, bez povinnej
              akcie
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-2">
            <IssueSectionTable
              title={ADVISORY_DIAGNOSTIC_SECTION.title}
              issues={advisoryDiagnosticIssues}
              ctx={ctx}
              dismissalMap={dismissalMap}
              onAction={openAction}
              onDismiss={setDismissTarget}
              onRevoke={handleRevoke}
              onConfirmValid={(issue) => void confirmAsValid(issue)}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {legacyVisibleIssues.length > 0 && (
        <Collapsible className="rounded-xl border border-dashed border-border/80">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs text-muted-foreground hover:bg-muted/30">
            <span>
              Legacy úlohy & info ({legacyVisibleIssues.length}) — bez akcie, len historický stav
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-2">
            <IssueSectionTable
              title={LEGACY_ISSUE_SECTION.title}
              issues={legacyVisibleIssues}
              ctx={ctx}
              dismissalMap={dismissalMap}
              onAction={openAction}
              onDismiss={setDismissTarget}
              onRevoke={handleRevoke}
              onConfirmValid={(issue) => void confirmAsValid(issue)}
              readOnlyActions
            />
          </CollapsibleContent>
        </Collapsible>
      )}

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
            <DialogTitle>Zamietnuť problém</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Skryje issue v aktívnom pohľade. Nemení source dáta. Pre validné duplicity radšej použite
            „Potvrdiť“.
          </p>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Typ</label>
            <select
              value={dismissType}
              onChange={(e) => setDismissType(e.target.value as "dismissed" | "false_positive")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="false_positive">Známy false positive</option>
              <option value="dismissed">Všeobecné zamietnutie</option>
            </select>
            <label className="text-xs text-muted-foreground">Dôvod (voliteľné)</label>
            <Input value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} placeholder="Prečo je to OK?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissTarget(null)}>Zrušiť</Button>
            <Button onClick={() => void submitDismiss()}>Zamietnuť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueSectionTable({
  title,
  issues,
  ctx,
  dismissalMap,
  onAction,
  onDismiss,
  onRevoke,
  onConfirmValid,
  readOnlyActions = false,
}: {
  title: string;
  issues: ReconciliationIssue[];
  ctx: FinanceRawContext;
  dismissalMap: Map<string, IssueDismissalRow>;
  onAction: (issue: ReconciliationIssue) => void;
  onDismiss: (issue: ReconciliationIssue) => void;
  onRevoke: (issueKey: string) => void;
  onConfirmValid: (issue: ReconciliationIssue) => void;
  readOnlyActions?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto max-h-[360px] table-dense">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ</TableHead>
              <TableHead>Zdroj</TableHead>
              <TableHead>Popis</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Suma</TableHead>
              <TableHead>Akcie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.slice(0, 80).map((issue, idx) => {
              const key = issue.issueKey ?? buildIssueKey(issue);
              const dismissed = dismissalMap.get(key);
              const actionable = !readOnlyActions && isIssueActionable(issue, ctx) && !dismissed;
              const actionLabel = getIssueActionLabel(issue);
              const dismissable = isIssueDismissable(issue) && !dismissed;
              const confirmValidOnly = dismissable && !actionable && !readOnlyActions;
              const sourceHint = formatReconciliationSourceHint(issue.sourceTable, issue.sourceId);
              return (
                <TableRow key={`${issue.kind}-${key}-${idx}`}>
                  <TableCell>
                    <Badge
                      variant={issue.severity === "warn" ? "destructive" : "outline"}
                      className="text-[10px] whitespace-nowrap"
                    >
                      {ISSUE_LABELS[issue.kind]}
                    </Badge>
                    {dismissed && (
                      <Badge variant="secondary" className="text-[10px] ml-1">
                        {dismissed.dismissal_type === "false_positive" ? "OK" : "Zam."}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {sourceHint ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate">{issue.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                    {dismissed?.reason ? `${issue.detail} · ${dismissed.reason}` : issue.detail}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {issue.amount != null ? fmtEur(issue.amount) : "—"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {actionable && actionLabel && (
                      <Button size="sm" variant="default" className="text-[10px] h-7" onClick={() => onAction(issue)}>
                        {actionLabel}
                      </Button>
                    )}
                    {confirmValidOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-7"
                        onClick={() => onConfirmValid(issue)}
                      >
                        Potvrdiť
                      </Button>
                    )}
                    {dismissable && (
                      <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => onDismiss(issue)}>
                        Zamietnuť
                      </Button>
                    )}
                    {dismissed && (
                      <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => void onRevoke(key)}>
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
    </section>
  );
}

function CountCard({
  label,
  count,
  highlight,
  variant = "default",
  muted,
}: {
  label: string;
  count: number;
  highlight?: boolean;
  variant?: "default" | "action";
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[8rem] ${
        highlight && variant === "action"
          ? "border-red-500/40 bg-red-500/5"
          : muted
            ? "border-dashed border-border/60 bg-muted/10"
            : "border-border bg-card"
      }`}
    >
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${
          highlight && variant === "action" ? "text-red-600" : "text-foreground"
        }`}
      >
        {count}
      </div>
    </div>
  );
}

