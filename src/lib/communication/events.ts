/**
 * Communication events — client-side helpers (Batch F2 / F2.5).
 * Best-effort writes only; never throw to callers.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { findCustomerByEmail, findCustomerById } from "@/lib/crmLookup/customers";
import {
  inboundAddressDetail,
  inboundAttachmentHint,
} from "@/lib/communication/inbound";
import {
  communicationThreadLabel,
  isThreadAware,
  communicationLinkStatus,
} from "@/lib/communication/threading";
import {
  type CommunicationEventRow,
  type CommunicationEventMetadata,
  parseCommunicationMetadata,
  metadataResendId,
} from "@/lib/communication/types";
import type { TimelineEvent } from "@/components/admin/CustomerTimeline";

export type { CommunicationEventRow } from "@/lib/communication/types";

export const COMMUNICATION_KINDS = [
  "email_out",
  "email_in",
  "note",
  "status_change",
  "payment",
  "commission",
  "project_event",
  "rental_event",
  "hosting_event",
] as const;

export type CommunicationKind = (typeof COMMUNICATION_KINDS)[number];

export const COMMUNICATION_KIND_LABELS: Record<CommunicationKind, string> = {
  email_out: "Odchozí e-mail",
  email_in: "Prichádzajúci e-mail",
  note: "Interná poznámka",
  status_change: "Zmena stavu",
  payment: "Platba",
  commission: "Provízia",
  project_event: "Projekt",
  rental_event: "Prenájom",
  hosting_event: "Hosting",
};

/** Human-readable edge function names for timeline detail. */
export const EDGE_FUNCTION_LABELS: Record<string, string> = {
  "send-reminder-email": "Automatický reminder",
  "send-offer-email": "Automatická ponuka",
  "send-instructions-email": "Inštrukcie pred objednávkou",
  "send-order-email": "Objednávka so zmluvou",
  "send-wheel-reminder": "Pripomienka kolesa šťastia",
};

export const CRM_ORIGIN_LABELS: Record<string, string> = {
  crm_app: "CRM",
  admin_customer_note: "Poznámka v 360°",
  edge_function: "Automatický e-mail",
};

export interface InsertCommunicationEventInput {
  kind: CommunicationKind;
  title: string;
  body_preview?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  metadata?: CommunicationEventMetadata;
  source_table?: string | null;
  source_id?: string | null;
  occurred_at?: string;
  /** When set, duplicate inserts are suppressed (F2.5 entity idempotency). */
  idempotency_key?: string;
}

const PREVIEW_MAX = 240;

export function isCommunicationKind(value: string): value is CommunicationKind {
  return (COMMUNICATION_KINDS as readonly string[]).includes(value);
}

/** Truncate plain text for timeline / list previews. */
export function buildEventPreview(text: string | null | undefined, maxLen = PREVIEW_MAX): string | null {
  if (!text?.trim()) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen - 1)}…`;
}

/** Human label for event origin (edge function, CRM module, etc.). */
export function communicationSourceLabel(row: CommunicationEventRow): string {
  const meta = parseCommunicationMetadata(row.metadata);
  if (meta.edge_function && EDGE_FUNCTION_LABELS[meta.edge_function]) {
    return EDGE_FUNCTION_LABELS[meta.edge_function];
  }
  if (typeof meta.edge_function === "string") return `E-mail: ${meta.edge_function}`;
  if (typeof meta.origin === "string" && CRM_ORIGIN_LABELS[meta.origin]) {
    return CRM_ORIGIN_LABELS[meta.origin];
  }
  if (typeof meta.origin === "string") return meta.origin;
  if (row.source_table) return row.source_table;
  const kind = isCommunicationKind(row.kind) ? row.kind : null;
  return kind ? COMMUNICATION_KIND_LABELS[kind] : row.kind;
}

export interface ResolvedCommunicationCustomer {
  customer_id: string | null;
  customer_email: string | null;
}

/** Resolve customer_id + normalized email for logging. Does not create customers. */
export async function resolveCommunicationCustomer(input: {
  customer_id?: string | null;
  customer_email?: string | null;
}): Promise<ResolvedCommunicationCustomer> {
  const email = normalizeEmail(input.customer_email);

  if (input.customer_id) {
    const row = await findCustomerById(input.customer_id);
    return {
      customer_id: row?.id ?? input.customer_id,
      customer_email: row?.email ?? email,
    };
  }

  if (email) {
    const row = await findCustomerByEmail(email);
    return { customer_id: row?.id ?? null, customer_email: email };
  }

  return { customer_id: null, customer_email: null };
}

export interface InsertCommunicationEventResult {
  ok: boolean;
  id?: string;
  deduped?: boolean;
  error?: string;
}

function buildMetadata(
  input: InsertCommunicationEventInput,
): CommunicationEventMetadata {
  const base: CommunicationEventMetadata = {
    origin: "crm_app",
    ...input.metadata,
  };
  if (input.idempotency_key) {
    base.idempotency_key = input.idempotency_key;
  }
  return base;
}

/** Insert communication event — best-effort; never throws. */
export async function insertCommunicationEvent(
  input: InsertCommunicationEventInput,
): Promise<InsertCommunicationEventResult> {
  try {
    const resolved = await resolveCommunicationCustomer({
      customer_id: input.customer_id,
      customer_email: input.customer_email,
    });

    const payload = {
      kind: input.kind,
      title: input.title.trim(),
      body_preview: input.body_preview ?? null,
      customer_id: resolved.customer_id,
      customer_email: resolved.customer_email,
      metadata: buildMetadata(input) as Json,
      source_table: input.source_table ?? null,
      source_id: input.source_id ?? null,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("communication_events")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        const key = input.idempotency_key ?? metadataResendId(payload.metadata as Json);
        console.info("[communication_events] deduped insert", key ?? "unique-violation");
        return { ok: true, deduped: true };
      }
      console.error("[communication_events] insert failed", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[communication_events] insert error", msg);
    return { ok: false, error: msg };
  }
}

export type EntityCommunicationKind = Extract<
  CommunicationKind,
  "project_event" | "commission" | "rental_event" | "hosting_event" | "payment"
>;

export interface LogEntityCommunicationInput {
  kind: EntityCommunicationKind;
  title: string;
  body_preview?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  source_table: string;
  source_id: string;
  idempotency_key: string;
  metadata?: CommunicationEventMetadata;
}

/** Log entity-scoped CRM action with idempotency_key — fire-and-forget safe. */
export async function logEntityCommunicationEvent(
  input: LogEntityCommunicationInput,
): Promise<InsertCommunicationEventResult> {
  return insertCommunicationEvent({
    kind: input.kind,
    title: input.title,
    body_preview: input.body_preview,
    customer_id: input.customer_id,
    customer_email: input.customer_email,
    source_table: input.source_table,
    source_id: input.source_id,
    idempotency_key: input.idempotency_key,
    metadata: {
      action: input.idempotency_key.split(":").pop(),
      ...input.metadata,
    },
  });
}

/** Fire-and-forget wrapper — never blocks UI saves. */
export function logEntityCommunicationEventSafe(input: LogEntityCommunicationInput): void {
  void logEntityCommunicationEvent(input).then((result) => {
    if (!result.ok && !result.deduped) {
      console.warn("[communication_events] entity log failed", input.idempotency_key, result.error);
    }
  });
}

function timelineCategoryForKind(kind: CommunicationKind): TimelineEvent["category"] {
  if (kind === "email_out" || kind === "email_in" || kind === "note") return "communication";
  if (kind === "commission" || kind === "payment") return "finance";
  if (kind === "project_event") return "project";
  if (kind === "rental_event") return "rental";
  return "other";
}

export type CommunicationTimelineFilter =
  | "all"
  | "inbound"
  | "outbound"
  | "unlinked"
  | "threaded";

export const COMMUNICATION_TIMELINE_FILTER_LABELS: Record<CommunicationTimelineFilter, string> = {
  all: "Všetko",
  inbound: "Prichádzajúce",
  outbound: "Odchádzajúce",
  unlinked: "Neprepojené",
  threaded: "Vo vlákne",
};

function isCommunicationTimelineEvent(event: TimelineEvent): boolean {
  return event.id.startsWith("comm-event-") || event.category === "communication";
}

/** Filter customer timeline to communication subsets (Batch G.5). */
export function filterTimelineCommunicationEvents(
  events: TimelineEvent[],
  filter: CommunicationTimelineFilter,
): TimelineEvent[] {
  if (filter === "all") return events;

  return events.filter((event) => {
    if (!isCommunicationTimelineEvent(event)) return false;
    const kind = event.meta?.communication_kind;
    if (filter === "inbound") return kind === "email_in";
    if (filter === "outbound") return kind === "email_out";
    if (filter === "unlinked") return event.meta?.link_status === "unlinked";
    if (filter === "threaded") return event.meta?.is_threaded === true;
    return true;
  });
}

function timelineLabelForRow(row: CommunicationEventRow, kind: CommunicationKind): string {
  if (kind === "email_out" || kind === "email_in") return row.title;
  if (kind === "note") return "Interná poznámka";
  return `${COMMUNICATION_KIND_LABELS[kind]} · ${row.title}`;
}

export function communicationEventToTimeline(row: CommunicationEventRow): TimelineEvent {
  const kind = isCommunicationKind(row.kind) ? row.kind : null;
  const origin = communicationSourceLabel(row);
  const category = kind ? timelineCategoryForKind(kind) : "other";
  const meta = parseCommunicationMetadata(row.metadata);

  const detailParts: string[] = [];
  const threadLabel = communicationThreadLabel(row);

  if (kind === "email_in") {
    const addr = inboundAddressDetail(row);
    if (addr) detailParts.push(addr);
    if (threadLabel) detailParts.push(threadLabel);
    const attach = inboundAttachmentHint(row);
    if (attach) detailParts.push(attach);
    if (row.body_preview) detailParts.push(row.body_preview);
  } else if (kind === "email_out") {
    if (threadLabel) detailParts.push(threadLabel);
    if (row.body_preview) detailParts.push(row.body_preview);
    detailParts.push(origin);
  } else {
    if (row.body_preview) detailParts.push(row.body_preview);
    if (kind === "note") {
      detailParts.push(origin);
    } else if (kind && origin !== COMMUNICATION_KIND_LABELS[kind]) {
      detailParts.push(origin);
    }
  }

  return {
    id: `comm-event-${row.id}`,
    at: row.occurred_at,
    label: kind ? timelineLabelForRow(row, kind) : row.title,
    detail: detailParts.length ? detailParts.join(" · ") : undefined,
    category,
    href:
      row.source_table === "project_notes" && row.source_id
        ? `/admin/projects/${row.source_id}`
        : row.source_table === "leads" && row.source_id
          ? `/admin?lead=${row.source_id}`
          : undefined,
    meta: {
      communication_kind: kind ?? row.kind,
      source_table: row.source_table ?? undefined,
      source_id: row.source_id ?? undefined,
      resend_id: meta.resend_id ?? undefined,
      thread_id: row.thread_id ?? undefined,
      in_reply_to: row.in_reply_to ?? undefined,
      sender_email: row.sender_email ?? undefined,
      recipient_email: row.recipient_email ?? undefined,
      link_status: communicationLinkStatus(row),
      is_threaded: isThreadAware(row),
      thread_match: meta.thread_match ?? undefined,
    },
  };
}

export function communicationEventsToTimeline(rows: CommunicationEventRow[]): TimelineEvent[] {
  return rows.map(communicationEventToTimeline);
}
