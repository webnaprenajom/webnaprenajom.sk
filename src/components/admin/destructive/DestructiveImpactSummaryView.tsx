import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import {
  blockingRecordTypeLabel,
  sectionActionLabel,
  type DestructiveCtaLink,
  type DestructiveImpactSummary,
  type LeadImpactSection,
  type LeadImpactSectionKey,
} from "@/lib/destructive/types";

interface Props {
  impact: DestructiveImpactSummary;
}

const LEAD_SECTION_LABELS: Record<LeadImpactSectionKey, string> = {
  customerLink: "Prepojený klient",
  tasks: "Úlohy",
  projectNotes: "Projekty",
  marketing: "Marketing",
  leadLogs: "História leadu (logy)",
};

function leadSectionDetail(section: LeadImpactSection): string {
  switch (section.key) {
    case "customerLink": {
      const c = section.linked_customer;
      if (!c) return "Klient zostane v systéme.";
      const parts = [
        `Klient zostane v systéme (${c.rentals_count} prenájmov, ${c.hosting_count} hosting).`,
      ];
      if (c.has_finance_facts) {
        parts.push("Potvrdené finančné záznamy ostávajú nedotknuté.");
      }
      return parts.join(" ");
    }
    case "tasks":
      return `${section.count} úloh sa odpojí od leadu (zostanú v systéme).`;
    case "projectNotes":
      return `${section.count} projektov sa odpojí od leadu (zostanú v systéme).`;
    case "marketing":
      return `${section.count} marketing záznamov stratí väzbu na lead (záznamy zostanú).`;
    case "leadLogs":
      return `${section.count} audit záznamov zostane zachovaných.`;
    default:
      return "";
  }
}

export function DestructiveImpactSummaryView({ impact }: Props) {
  const isLead = impact.entity_type === "lead";
  const visibleSections = impact.sections.filter((s) => s.count > 0);
  const leadSections = isLead ? (impact.lead_impact?.sections ?? []) : [];

  return (
    <div className="space-y-4 text-sm">
      {impact.finance_critical && !isLead && (
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

      {impact.finance_critical && isLead && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-300">
              Upozornenie — prepojený klient má finančné fakty
            </p>
            <p className="text-xs text-orange-800/90 dark:text-orange-300/90 mt-0.5">
              Zmazanie leadu odstráni len pipeline záznam. Klient, prenájmy, hosting a potvrdené
              platby / náklady / výplaty zostanú v systéme.
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

      {leadSections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dopad na dáta
          </p>
          <ul className="space-y-2">
            {leadSections.map((section) => (
              <li
                key={section.key}
                className="rounded-lg border border-border/80 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {LEAD_SECTION_LABELS[section.key]}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[9px] h-4 tabular-nums">
                      {section.count}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        section.severity === "warning"
                          ? "text-[9px] border-orange-500/50 text-orange-700"
                          : "text-[9px]"
                      }
                    >
                      {section.severity === "warning" ? "Upozornenie" : "Info"}
                    </Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{leadSectionDetail(section)}</p>
                {section.action && section.action !== "keep" && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    {sectionActionLabel(section.action)}
                  </p>
                )}
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
        <CtaLinks
          links={impact.cta_links}
          heading={isLead ? "Súvisiace odkazy" : "Kde vyriešiť blokáciu"}
        />
      )}
    </div>
  );
}

function CtaLinks({ links, heading }: { links: DestructiveCtaLink[]; heading: string }) {
  return (
    <div className="space-y-2 pt-1 border-t border-border/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
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
