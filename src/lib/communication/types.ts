/**
 * Typed communication_events surface (Batch F2.5).
 * Source of truth: `Database['public']['Tables']['communication_events']`.
 */

import type { Database, Json } from "@/integrations/supabase/types";

export type CommunicationEventRow =
  Database["public"]["Tables"]["communication_events"]["Row"];

export type CommunicationEventInsert =
  Database["public"]["Tables"]["communication_events"]["Insert"];

export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

/** Known metadata keys — extensible via Json index signature. */
export type CommunicationEventMetadata = {
  origin?: string;
  edge_function?: string;
  subject?: string;
  resend_id?: string | null;
  idempotency_key?: string;
  action?: string;
  payment_status?: string;
  entity_status?: string;
  provider?: string;
  provider_email_id?: string;
  svix_id?: string | null;
  thread_match?: string;
  normalized_subject?: string;
  outbound_thread_key?: string;
  [key: string]: Json | undefined;
};

export function parseCommunicationMetadata(
  raw: Json | null,
): CommunicationEventMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CommunicationEventMetadata;
}

export function metadataResendId(raw: Json | null): string | undefined {
  const m = parseCommunicationMetadata(raw);
  return typeof m.resend_id === "string" ? m.resend_id : undefined;
}
