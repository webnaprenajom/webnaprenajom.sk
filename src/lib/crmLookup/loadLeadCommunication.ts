/**
 * Load communication events for a lead context (Batch RC2).
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";
import type { CommunicationEventRow } from "@/lib/communication/types";

export async function fetchLeadCommunicationEvents(input: {
  email?: string | null;
  customerId?: string | null;
  limit?: number;
}): Promise<{ events: CommunicationEventRow[]; error: string | null }> {
  const limit = input.limit ?? 20;
  const email = normalizeEmail(input.email);
  const customerId =
    input.customerId && isCanonicalCustomerId(input.customerId) ? input.customerId : null;

  if (!email && !customerId) {
    return { events: [], error: null };
  }

  try {
    if (customerId && email) {
      const { data, error } = await supabase
        .from("communication_events")
        .select(
          "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at,updated_at",
        )
        .or(`customer_id.eq.${customerId},customer_email.eq.${email}`)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) return { events: [], error: error.message };
      return { events: (data ?? []) as CommunicationEventRow[], error: null };
    }

    if (customerId) {
      const { data, error } = await supabase
        .from("communication_events")
        .select(
          "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at,updated_at",
        )
        .eq("customer_id", customerId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) return { events: [], error: error.message };
      return { events: (data ?? []) as CommunicationEventRow[], error: null };
    }

    const { data, error } = await supabase
      .from("communication_events")
      .select(
        "id,customer_id,customer_email,sender_email,recipient_email,kind,title,body_preview,metadata,source_table,source_id,message_id,in_reply_to,thread_id,occurred_at,created_at,updated_at",
      )
      .eq("customer_email", email!)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) return { events: [], error: error.message };
    return { events: (data ?? []) as CommunicationEventRow[], error: null };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Neznáma chyba" };
  }
}

export function leadLastActivityAt(
  events: CommunicationEventRow[],
  notesUpdatedAt?: string | null,
): string | null {
  const times = [
    ...events.map((e) => e.occurred_at || e.created_at),
    notesUpdatedAt,
  ].filter(Boolean) as string[];
  if (times.length === 0) return null;
  return times.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}
