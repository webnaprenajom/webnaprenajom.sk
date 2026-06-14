import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import {
  blockingRecordTypeLabel,
  sectionActionLabel,
  type DestructiveCtaLink,
  type DestructiveImpactSummary,
} from "@/lib/destructive/types";

interface Props {
  impact: DestructiveImpactSummary;
}

export function DestructiveImpactSummaryView({ impact }: Props) {
  const visibleSections = impact.sections.filter((s) => s.count > 0);

  return (
    <div className="space-y-4 text-sm">
      {impact.finance_critical && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 flex gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">Finančný dopad</p>
            <p className="text-xs text-red-700/90 dark:text-red-400/90 mt-0.5">
              Táto akcia ovplyvní potvrdené finančné údaje alebo reporty. Zmazanie je zablokované,
              kým existujú potvrdené fakty nižšie.
            </p>
          </div>
        </div>
      )}

      {!impact.can_delete && impact.block_reason && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-200">{impact.block_reason}</p>
        </div>
      )}

      {impact.blocking_records.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Blokujúce záznamy ({impact.blocking_records.length})
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
            {impact.blocking_records.map((rec) => (
              <li key={rec.id} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-700">
                      {blockingRecordTypeLabel(rec.record_type)}
                    </Badge>
                    <span className="font-medium text-xs truncate">{rec.label}</span>
                  </div>
                  {rec.detail && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{rec.detail}</p>
                  )}
                </div>
                <Link to={rec.cta_path}>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] shrink-0">
                    Finance <ExternalLink className="w-3 h-3 ml-0.5" />
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibleSections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dopad na dáta
          </p>
          <ul className="space-y-1">
            {visibleSections.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/60 last:border-0"
              >
                <span className="text-muted-foreground">{s.label}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[9px] h-4 tabular-nums">
                    {s.count}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {sectionActionLabel(s.action)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.warnings.length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
          {impact.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {impact.cta_links.length > 0 && (
        <CtaLinks links={impact.cta_links} />
      )}
    </div>
  );
}

function CtaLinks({ links }: { links: DestructiveCtaLink[] }) {
  return (
    <div className="space-y-2 pt-1 border-t border-border/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kde vyriešiť blokáciu
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link key={link.path + link.label} to={link.path}>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              {link.label}
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
