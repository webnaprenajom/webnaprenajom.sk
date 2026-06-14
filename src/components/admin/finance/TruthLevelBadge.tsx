import { Badge } from "@/components/ui/badge";
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
  if (level.endsWith("_fact")) return "border-green-500/40 text-green-700 dark:text-green-400";
  if (level === "legacy_import") return "border-orange-500/40 text-orange-700 dark:text-orange-400";
  return "border-muted-foreground/30 text-muted-foreground";
}

export function TruthLevelBadge({ level, className = "" }: { level: string; className?: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${truthToneClass(level)} ${className}`}>
      {TRUTH_LEVEL_LABELS[level] ?? level}
    </Badge>
  );
}
