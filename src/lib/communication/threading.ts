/**
 * Email thread helpers — browser-safe (Batch G / G.5).
 * Keep in sync with supabase/functions/_shared/threading.ts
 */

import type { CommunicationEventRow } from "@/lib/communication/types";
import { parseCommunicationMetadata } from "@/lib/communication/types";

export function normalizeEmailSubject(subject: string | null | undefined): string {
  if (!subject?.trim()) return "";
  return subject
    .trim()
    .replace(/^(re|fwd|fw|odp|odpoveď):\s*/gi, "")
    .replace(/^(re|fwd|fw|odp|odpoveď):\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

export function parseReferencesHeader(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const matches = raw.match(/<[^>]+>|[^\s,;]+@[^\s,;>]+/g) ?? [];
  const ids = matches
    .map((m) => normalizeMessageId(m))
    .filter((id): id is string => !!id);
  return [...new Set(ids)];
}

export function subjectThreadKey(normalizedSubject: string, email: string): string | null {
  if (!normalizedSubject || !email) return null;
  return `subject:${normalizedSubject}:${email.toLowerCase()}`;
}

export function buildOutboundThreadId(
  resendId: string | null | undefined,
  normalizedSubject: string,
  recipientEmail: string | null,
): string | null {
  if (resendId) return `resend:${resendId}`;
  if (normalizedSubject && recipientEmail) {
    return subjectThreadKey(normalizedSubject, recipientEmail);
  }
  return null;
}

export function threadLookupCandidates(
  inReplyTo: string | null | undefined,
  referencesRaw: string | null | undefined,
  messageId: string | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (id: string | null | undefined) => {
    const n = normalizeMessageId(id);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  push(inReplyTo);
  for (const ref of parseReferencesHeader(referencesRaw)) push(ref);
  push(messageId);
  return out;
}

export type CommunicationLinkStatus = "linked" | "unlinked";

export function communicationLinkStatus(row: CommunicationEventRow): CommunicationLinkStatus {
  return row.customer_id ? "linked" : "unlinked";
}

export function isThreadAware(row: CommunicationEventRow): boolean {
  return !!(row.thread_id || row.in_reply_to || row.message_id);
}

export function isInboundKind(kind: string): boolean {
  return kind === "email_in";
}

export function isOutboundKind(kind: string): boolean {
  return kind === "email_out";
}

export function communicationThreadLabel(row: CommunicationEventRow): string | null {
  if (row.in_reply_to) return "Odpoveď vo vlákne";
  const meta = parseCommunicationMetadata(row.metadata);
  if (meta.thread_match === "subject") return "Vlákno (predmet)";
  if (meta.thread_match === "references" || meta.thread_match === "in_reply_to") {
    return "Vlákno (Message-ID)";
  }
  if (meta.thread_match === "resend_outbound") return "Vlákno (odchozí e-mail)";
  if (row.thread_id?.startsWith("resend:")) return "Vlákno (Resend ID)";
  if (row.thread_id?.startsWith("subject:")) return "Vlákno (predmet)";
  if (row.thread_id) return "Vlákno";
  return null;
}

export const THREAD_RESOLUTION_ORDER = [
  "1. In-Reply-To → existing communication_events.message_id → inherit thread_id",
  "2. References headers (each id, priority order) → same lookup",
  "3. In-Reply-To / References → metadata.resend_id on email_out (Resend outbound id)",
  "4. Normalized subject + sender_email → recent email_out/email_in to same address",
  "5. New thread root from inbound message_id, else subject: key, else resend: outbound id",
] as const;
