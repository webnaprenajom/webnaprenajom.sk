import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildSummaryFromEvents,
  type CustomerCommunicationSummary,
  emptyCommunicationSummary,
} from "@/lib/communication/summaryModel";

interface Props {
  customerId: string | null;
}

export function CommunicationSummaryPanel({ customerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<CustomerCommunicationSummary | null>(null);

  const load = useCallback(async () => {
    if (!customerId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    const { data: existing } = await supabase
      .from("customer_communication_summaries")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existing) {
      setSummary({
        customer_id: customerId,
        rolling_summary: existing.rolling_summary,
        key_decisions: (existing.key_decisions as any) || [],
        unresolved_topics: (existing.unresolved_topics as any) || [],
        next_steps: (existing.next_steps as any) || [],
        last_event_at: existing.last_event_at,
        updated_at: existing.updated_at,
      });
      setLoading(false);
      return;
    }

    const { data: events } = await supabase
      .from("communication_events")
      .select("kind,title,body_preview,occurred_at")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false })
      .limit(20);

    const built = buildSummaryFromEvents(
      customerId,
      (events || []).map((e) => ({
        kind: e.kind,
        title: e.title,
        body_preview: e.body_preview,
        occurred_at: e.occurred_at,
      })),
    );
    setSummary(built);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSummary = async () => {
    if (!customerId) return;
    setLoading(true);
    const { data: events } = await supabase
      .from("communication_events")
      .select("kind,title,body_preview,occurred_at")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false })
      .limit(30);

    const built = buildSummaryFromEvents(
      customerId,
      (events || []).map((e) => ({
        kind: e.kind,
        title: e.title,
        body_preview: e.body_preview,
        occurred_at: e.occurred_at,
      })),
      summary ?? undefined,
    );

    const { error } = await supabase.from("customer_communication_summaries").upsert({
      customer_id: customerId,
      rolling_summary: built.rolling_summary,
      key_decisions: built.key_decisions,
      unresolved_topics: built.unresolved_topics,
      next_steps: built.next_steps,
      last_event_at: built.last_event_at,
      updated_at: new Date().toISOString(),
    });

    setLoading(false);
    if (error) {
      toast({ title: "Súhrn", description: error.message, variant: "destructive" });
      return;
    }
    setSummary(built);
    toast({ title: "Súhrn aktualizovaný" });
  };

  if (!customerId) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Súhrn komunikácie je dostupný pre kanonického klienta s customer_id.
      </p>
    );
  }

  if (loading && !summary) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const s = summary ?? emptyCommunicationSummary(customerId);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Súhrn komunikácie
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Pre odovzdanie kolegovi — kľúčové body bez prepisovania celých e-mailov
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refreshSummary()} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Obnoviť
        </Button>
      </div>

      {s.rolling_summary ? (
        <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto">
          {s.rolling_summary}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground italic">Zatiaľ žiadna komunikácia na zhrnutie.</p>
      )}

      {s.next_steps.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Ďalšie kroky</p>
          <ul className="text-xs space-y-1">
            {s.next_steps.map((step) => (
              <li key={step.id} className="flex gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 h-5">
                  krok
                </Badge>
                {step.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.unresolved_topics.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Otvorené témy</p>
          <ul className="text-xs space-y-1 text-amber-800 dark:text-amber-300">
            {s.unresolved_topics.slice(0, 3).map((t) => (
              <li key={t.id}>{t.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
