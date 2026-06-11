/**
 * Inbound webhook operational diagnostics (Batch G.5).
 */

import { supabase } from "@/integrations/supabase/client";
import type { CommunicationEventRow } from "@/lib/communication/types";

export type WebhookIncidentType =
  | "verify_failed"
  | "fetch_failed"
  | "malformed"
  | "insert_failed"
  | "deduped_inbound";

export interface WebhookIncidentRow {
  id: string;
  incident_type: WebhookIncidentType;
  provider_email_id: string | null;
  sender_email: string | null;
  customer_email: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

export interface CommunicationDiagnostics {
  inboundTotal: number;
  outboundTotal: number;
  unlinkedInbound: number;
  threadAwareInbound: number;
  recentIncidents: WebhookIncidentRow[];
  unlinkedEvents: CommunicationEventRow[];
  incidentCounts: Record<WebhookIncidentType, number>;
}

const INCIDENT_TYPES: WebhookIncidentType[] = [
  "verify_failed",
  "fetch_failed",
  "malformed",
  "insert_failed",
  "deduped_inbound",
];

export async function fetchCommunicationDiagnostics(
  limit = 25,
): Promise<{ data: CommunicationDiagnostics | null; error: string | null }> {
  try {
    const [
      inboundRes,
      outboundRes,
      unlinkedRes,
      threadedRes,
      incidentsRes,
      unlinkedListRes,
    ] = await Promise.all([
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_in"),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_out"),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_in")
        .is("customer_id", null),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_in")
        .not("thread_id", "is", null),
      supabase
        .from("communication_webhook_incidents")
        .select(
          "id,incident_type,provider_email_id,sender_email,customer_email,summary,metadata,occurred_at",
        )
        .order("occurred_at", { ascending: false })
        .limit(limit),
      supabase
        .from("communication_events")
        .select(
          "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at,updated_at",
        )
        .eq("kind", "email_in")
        .is("customer_id", null)
        .order("occurred_at", { ascending: false })
        .limit(limit),
    ]);

    const incidentCountResults = await Promise.all(
      INCIDENT_TYPES.map((type) =>
        supabase
          .from("communication_webhook_incidents")
          .select("id", { count: "exact", head: true })
          .eq("incident_type", type),
      ),
    );

    const firstError =
      inboundRes.error ||
      outboundRes.error ||
      unlinkedRes.error ||
      threadedRes.error ||
      incidentsRes.error ||
      unlinkedListRes.error ||
      incidentCountResults.find((r) => r.error)?.error;

    if (firstError) {
      return { data: null, error: firstError.message };
    }

    const incidents = (incidentsRes.data ?? []) as WebhookIncidentRow[];
    const incidentCounts = INCIDENT_TYPES.reduce(
      (acc, type, index) => {
        acc[type] = incidentCountResults[index]?.count ?? 0;
        return acc;
      },
      {} as Record<WebhookIncidentType, number>,
    );

    return {
      data: {
        inboundTotal: inboundRes.count ?? 0,
        outboundTotal: outboundRes.count ?? 0,
        unlinkedInbound: unlinkedRes.count ?? 0,
        threadAwareInbound: threadedRes.count ?? 0,
        recentIncidents: incidents,
        unlinkedEvents: (unlinkedListRes.data ?? []) as CommunicationEventRow[],
        incidentCounts,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "unknown" };
  }
}
