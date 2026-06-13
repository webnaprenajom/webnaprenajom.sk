/**
 * Communication summary model (Batch RC6) — handoff-friendly knowledge layer.
 */

export type CommunicationSummaryBullet = {
  id: string;
  text: string;
  at?: string;
};

export type CustomerCommunicationSummary = {
  customer_id: string;
  rolling_summary: string | null;
  key_decisions: CommunicationSummaryBullet[];
  unresolved_topics: CommunicationSummaryBullet[];
  next_steps: CommunicationSummaryBullet[];
  last_event_at: string | null;
  updated_at: string;
};

export function parseSummaryBullets(raw: unknown): CommunicationSummaryBullet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, i) => {
      if (typeof item === "string") {
        return { id: `b-${i}`, text: item.trim() };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? o.label ?? "").trim();
        if (!text) return null;
        return {
          id: String(o.id ?? `b-${i}`),
          text,
          at: o.at ? String(o.at) : undefined,
        };
      }
      return null;
    })
    .filter(Boolean) as CommunicationSummaryBullet[];
}

export function emptyCommunicationSummary(customerId: string): CustomerCommunicationSummary {
  return {
    customer_id: customerId,
    rolling_summary: null,
    key_decisions: [],
    unresolved_topics: [],
    next_steps: [],
    last_event_at: null,
    updated_at: new Date().toISOString(),
  };
}

export type CommunicationEventSnippet = {
  kind: string;
  title: string;
  body_preview?: string | null;
  occurred_at: string;
};

/**
 * Deterministic rolling update from events (no external AI in RC6).
 * Produces a concise summary suitable for colleague handoff; can be replaced by LLM later.
 */
export function buildSummaryFromEvents(
  customerId: string,
  events: CommunicationEventSnippet[],
  existing?: Partial<CustomerCommunicationSummary>,
): CustomerCommunicationSummary {
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
  const recent = sorted.slice(0, 8);
  const rolling =
    recent.length === 0
      ? existing?.rolling_summary ?? null
      : recent
          .map((e) => {
            const date = new Date(e.occurred_at).toLocaleDateString("sk-SK");
            const preview = e.body_preview?.trim();
            return preview
              ? `${date} · ${e.title}: ${preview.slice(0, 120)}`
              : `${date} · ${e.title}`;
          })
          .join("\n");

  const inbound = sorted.filter((e) => e.kind === "email_in").slice(0, 3);
  const outbound = sorted.filter((e) => e.kind === "email_out").slice(0, 3);

  const next_steps: CommunicationSummaryBullet[] = [];
  if (inbound.length > 0 && outbound.length === 0) {
    next_steps.push({
      id: "ns-reply",
      text: "Klient čaká na odpoveď — posledná správa bola prichádzajúca.",
    });
  }
  const existingNext = parseSummaryBullets(existing?.next_steps);
  for (const step of existingNext) {
    if (!next_steps.some((s) => s.text === step.text)) next_steps.push(step);
  }

  return {
    customer_id: customerId,
    rolling_summary: rolling,
    key_decisions: parseSummaryBullets(existing?.key_decisions),
    unresolved_topics:
      inbound.length > 0
        ? inbound.map((e, i) => ({
            id: `un-${i}`,
            text: e.body_preview?.slice(0, 160) || e.title,
            at: e.occurred_at,
          }))
        : parseSummaryBullets(existing?.unresolved_topics),
    next_steps,
    last_event_at: sorted[0]?.occurred_at ?? existing?.last_event_at ?? null,
    updated_at: new Date().toISOString(),
  };
}

export const EMAIL_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  connected: "Pripojené",
  disconnected: "Odpojené",
  error: "Chyba",
  pending: "Čaká na pripojenie",
};
