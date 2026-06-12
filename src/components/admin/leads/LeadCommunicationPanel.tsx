import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, MessageSquare, Inbox, Clock } from "lucide-react";
import {
  COMMUNICATION_KIND_LABELS,
  isCommunicationKind,
} from "@/lib/communication/events";
import type { CommunicationEventRow } from "@/lib/communication/types";
import {
  fetchLeadCommunicationEvents,
  leadLastActivityAt,
} from "@/lib/crmLookup/loadLeadCommunication";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";

interface Props {
  leadId: string;
  email: string;
  name: string;
  customerId?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "email_in") return <Inbox className="w-3 h-3" />;
  if (kind === "email_out") return <Mail className="w-3 h-3" />;
  return <MessageSquare className="w-3 h-3" />;
}

export function LeadCommunicationPanel({
  leadId,
  email,
  name,
  customerId,
  notes,
  updatedAt,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CommunicationEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchLeadCommunicationEvents({ email, customerId, limit: 15 }).then(({ events: rows, error: err }) => {
      if (cancelled) return;
      setEvents(rows);
      setError(err);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [email, customerId, leadId]);

  const lastActivity = useMemo(
    () => leadLastActivityAt(events, updatedAt),
    [events, updatedAt],
  );

  const customerHref = adminCustomerHrefPreferred(customerId, email);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">Komunikácia</h3>
        {customerHref && (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to={`${customerHref}?tab=komunikacia`}>Celá história klienta</Link>
          </Button>
        )}
      </div>

      {lastActivity && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Posledná aktivita: {new Date(lastActivity).toLocaleString("sk-SK")}
        </p>
      )}

      {notes?.trim() && (
        <div className="rounded-md bg-muted/40 p-2.5 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Interná poznámka (lead)
          </p>
          <p className="text-xs whitespace-pre-wrap line-clamp-4">{notes}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Načítavam komunikáciu…
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">Komunikáciu sa nepodarilo načítať: {error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Zatiaľ žiadna zaznamenaná komunikácia pre {name || email}.
        </p>
      )}

      {!loading && events.length > 0 && (
        <ul className="divide-y divide-border text-xs max-h-48 overflow-y-auto">
          {events.map((ev) => {
            const kind = ev.kind;
            const label = isCommunicationKind(kind) ? COMMUNICATION_KIND_LABELS[kind] : kind;
            return (
              <li key={ev.id} className="py-2 flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] h-4 shrink-0 gap-0.5">
                  <KindIcon kind={kind} />
                  {label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{ev.title}</p>
                  {ev.body_preview && (
                    <p className="text-muted-foreground line-clamp-1">{ev.body_preview}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(ev.occurred_at || ev.created_at).toLocaleString("sk-SK")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
