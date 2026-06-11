import { Badge } from "@/components/ui/badge";
import {
  COMMISSION_LINK_STATUS_LABELS,
  type CommissionLinkStatus,
} from "@/lib/commissionSource";

const STATUS_CLASS: Record<CommissionLinkStatus, string> = {
  linked: "bg-primary/15 text-primary border-primary/30",
  legacy: "bg-muted text-muted-foreground border-border",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  other: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

export function CommissionLinkBadge({ status }: { status: CommissionLinkStatus }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[status]}`}>
      {COMMISSION_LINK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ClientLinkBadge({ linked }: { linked: boolean }) {
  return linked ? (
    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
      Lead prepojený
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      Voľný text
    </Badge>
  );
}

export function CanonicalCustomerBadge() {
  return (
    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
      Kanónický zákazník
    </Badge>
  );
}

export function HeuristicDataBadge() {
  return (
    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-dashed">
      Heuristické zhody
    </Badge>
  );
}

export function EstimatedLinkBadge() {
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25">
      Odhadované prepojenie
    </Badge>
  );
}

export function ConfirmedLinkBadge({ label = "Potvrdené prepojenie" }: { label?: string }) {
  return (
    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
      {label}
    </Badge>
  );
}

export function StandaloneEntityBadge() {
  return (
    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
      Samostatný záznam
    </Badge>
  );
}
