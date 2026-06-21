import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/admin/StatusChip";
import { TRUTH_LEVEL_LABELS } from "@/lib/finance/labels";

/**
 * Truth-level farebná konvencia podľa CLAUDE.md:
 *  - zelená (#22c55e, "potvrdené") — `*_fact` (payment_fact / payout_fact / cost_fact)
 *  - oranžová (#f97316, "čakajúce/legacy") — `legacy_import`
 *  - sivá (#6b7280, "neaktívne") — `workflow_only` / `derived`
 *
 * Jediný zdroj pravdy pre truth-level badge — používa Finance aj Customer Hub
 * (Fáza 3: Finance Coherence, zjednotenie naprieč `AdminFinance.tsx`,
 * `FinanceRecordsCrud.tsx`, `CustomerFinancePanel.tsx`).
 */
export function truthToneClass(level: string): string {
  if (level.endsWith("_fact")) {
    return "bg-green-500/12 text-green-600 dark:text-green-400 border-green-500/35";
  }
  if (level === "legacy_import") {
    return "bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/35";
  }
  return "bg-muted/40 text-muted-foreground border-border/60";
}

export function TruthLevelBadge({ level, className = "" }: { level: string; className?: string }) {
  return (
    <StatusChip
      dot
      label={TRUTH_LEVEL_LABELS[level] ?? level}
      className={`${truthToneClass(level)} ${className}`}
    />
  );
}
