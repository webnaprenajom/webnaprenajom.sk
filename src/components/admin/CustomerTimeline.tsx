import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Loader2, Mail, MessageSquare, AlertCircle, Inbox, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  prepareTimelineEvents,
  TIMELINE_CATEGORY_LABELS,
} from "@/lib/crmLookup/timeline";
import {
  COMMUNICATION_KIND_LABELS,
  COMMUNICATION_TIMELINE_FILTER_LABELS,
  filterTimelineCommunicationEvents,
  isCommunicationKind,
  type CommunicationTimelineFilter,
} from "@/lib/communication/events";

export interface TimelineEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  href?: string;
  category?: "lead" | "project" | "rental" | "finance" | "communication" | "other";
  meta?: {
    source_type?: string;
    source_id?: string;
    source_table?: string;
    communication_kind?: string;
    resend_id?: string;
    thread_id?: string;
    in_reply_to?: string;
    sender_email?: string;
    recipient_email?: string;
    link_status?: "linked" | "unlinked";
    is_threaded?: boolean;
    thread_match?: string;
    lead_id?: string;
    log_field?: string;
    log_new_value?: string;
  };
  /** Finance timeline events — payment_fact, payout_fact, workflow_only, … */
  truthLevel?: string;
}

export interface CustomerTimelineProps {
  events: TimelineEvent[];
  limit?: number;
  title?: string;
  emptyText?: string;
  loading?: boolean;
  error?: string | null;
  /** Show communication-only filters (Batch G.5). */
  showCommunicationFilters?: boolean;
  communicationFilter?: CommunicationTimelineFilter;
  onCommunicationFilterChange?: (filter: CommunicationTimelineFilter) => void;
}

function CommunicationKindBadge({ kind }: { kind: string | undefined }) {
  if (!kind || !isCommunicationKind(kind)) return null;
  const label = COMMUNICATION_KIND_LABELS[kind];
  const isEmail = kind === "email_out";
  const isInbound = kind === "email_in";
  const isNote = kind === "note";
  return (
    <Badge
      variant={isEmail ? "default" : isInbound ? "outline" : isNote ? "secondary" : "outline"}
      className={`text-[9px] h-4 px-1.5 shrink-0 gap-0.5 ${
        isInbound ? "border-green-500/40 text-green-700 dark:text-green-400" : ""
      }`}
    >
      {isEmail && <Mail className="w-2.5 h-2.5" />}
      {isInbound && <Inbox className="w-2.5 h-2.5" />}
      {isNote && <MessageSquare className="w-2.5 h-2.5" />}
      {label}
    </Badge>
  );
}

function CommunicationLinkBadge({
  linkStatus,
  isThreaded,
}: {
  linkStatus?: "linked" | "unlinked";
  isThreaded?: boolean;
}) {
  if (linkStatus === "unlinked") {
    return (
      <Badge
        variant="outline"
        className="text-[9px] h-4 px-1.5 shrink-0 gap-0.5 border-amber-500/40 text-amber-700 dark:text-amber-400"
      >
        <Link2Off className="w-2.5 h-2.5" />
        Neprepojené
      </Badge>
    );
  }
  if (isThreaded) {
    return (
      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
        Vlákno
      </Badge>
    );
  }
  return null;
}

export function CustomerTimeline({
  events,
  limit = 12,
  title = "História zákazníka",
  emptyText = "Zatiaľ žiadna aktivita pre tohto zákazníka.",
  loading = false,
  error = null,
  showCommunicationFilters = false,
  communicationFilter: controlledFilter,
  onCommunicationFilterChange,
}: CustomerTimelineProps) {
  const [internalFilter, setInternalFilter] = useState<CommunicationTimelineFilter>("all");
  const commFilter = controlledFilter ?? internalFilter;

  const handleFilterChange = (value: CommunicationTimelineFilter) => {
    if (onCommunicationFilterChange) onCommunicationFilterChange(value);
    else setInternalFilter(value);
  };

  const filteredEvents = useMemo(() => {
    if (!showCommunicationFilters || commFilter === "all") return events;
    return filterTimelineCommunicationEvents(events, commFilter);
  }, [events, showCommunicationFilters, commFilter]);

  const sorted = useMemo(
    () => prepareTimelineEvents(filteredEvents, limit),
    [filteredEvents, limit],
  );

  const filterEmptyText =
    commFilter === "all"
      ? emptyText
      : `Žiadne udalosti pre filter „${COMMUNICATION_TIMELINE_FILTER_LABELS[commFilter]}“.`;

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold mb-3">{title}</h2>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-xs">Načítavam históriu…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-destructive/30 bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">{title}</h2>
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {showCommunicationFilters && (
            <CommunicationFilterSelect value={commFilter} onChange={handleFilterChange} />
          )}
        </div>
        <p className="text-xs text-muted-foreground italic">{filterEmptyText}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {showCommunicationFilters && (
            <CommunicationFilterSelect value={commFilter} onChange={handleFilterChange} />
          )}
          <span className="text-[10px] text-muted-foreground">{sorted.length} udalostí</span>
        </div>
      </div>
      <ul className="divide-y divide-border text-xs px-4">
        {sorted.map((item) => (
          <li key={item.id} className="py-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {item.category && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                    {TIMELINE_CATEGORY_LABELS[item.category]}
                  </Badge>
                )}
                <CommunicationKindBadge kind={item.meta?.communication_kind} />
                <CommunicationLinkBadge
                  linkStatus={item.meta?.link_status}
                  isThreaded={item.meta?.is_threaded}
                />
                {item.truthLevel && (
                  <TruthLevelBadge level={item.truthLevel} className="text-[9px] h-4 px-1 shrink-0" />
                )}
                <span className="font-medium truncate flex items-center gap-1 min-w-0">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  {item.label}
                </span>
              </div>
              {item.detail && (
                <div className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2 pl-0.5">
                  {item.detail}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(item.at).toLocaleString("sk-SK")}
              </div>
            </div>
            {item.href && (
              <Link to={item.href} className="shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Detail
                </Button>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommunicationFilterSelect({
  value,
  onChange,
}: {
  value: CommunicationTimelineFilter;
  onChange: (value: CommunicationTimelineFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CommunicationTimelineFilter)}>
      <SelectTrigger className="h-7 w-[140px] text-[10px]">
        <SelectValue placeholder="Filtrovať" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(COMMUNICATION_TIMELINE_FILTER_LABELS) as CommunicationTimelineFilter[]).map(
          (key) => (
            <SelectItem key={key} value={key} className="text-xs">
              {COMMUNICATION_TIMELINE_FILTER_LABELS[key]}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
