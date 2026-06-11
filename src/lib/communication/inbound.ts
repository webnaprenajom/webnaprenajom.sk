/**
 * Inbound email display helpers (Batch G) — browser-safe pure functions.
 */

import type { CommunicationEventRow } from "@/lib/communication/types";
import { communicationThreadLabel } from "@/lib/communication/threading";
import { parseCommunicationMetadata } from "@/lib/communication/types";
export function parseEmailAddress(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

export function deriveThreadId(
  inReplyTo: string | null | undefined,
  messageId: string | null | undefined,
): string | null {
  const reply = normalizeMessageId(inReplyTo);
  if (reply) return reply;
  return normalizeMessageId(messageId);
}

export function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
  return stripped.replace(/\s+/g, " ").trim() || null;
}

export function buildInboundPreview(
  text: string | null | undefined,
  html: string | null | undefined,
  maxLen = 240,
): string | null {
  const fromText = text?.trim() || stripHtmlToText(html);
  if (!fromText?.trim()) return null;
  const collapsed = fromText.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen - 1)}…`;
}

export function inboundThreadHint(row: CommunicationEventRow): string | null {
  return communicationThreadLabel(row);
}

export function inboundAddressDetail(row: CommunicationEventRow): string | null {
  const parts: string[] = [];
  const sender = row.sender_email ?? parseEmailAddress(row.customer_email);
  const recipient = row.recipient_email;
  if (sender) parts.push(`Od: ${sender}`);
  if (recipient) parts.push(`Komu: ${recipient}`);
  return parts.length ? parts.join(" · ") : null;
}

export function inboundAttachmentHint(row: CommunicationEventRow): string | null {
  const meta = parseCommunicationMetadata(row.metadata);
  const count = meta.attachment_count;
  if (typeof count === "number" && count > 0) {
    return count === 1 ? "1 príloha" : `${count} príloh`;
  }
  return null;
}
