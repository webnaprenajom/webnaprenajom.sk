import { supabase } from "@/integrations/supabase/client";
import { STATUS_CONFIG, type LeadStatus } from "@/components/admin/leads/constants";

export type LeadStatusEmailKind = NonNullable<
  (typeof STATUS_CONFIG)[LeadStatus]["sendsEmail"]
>;

export type LeadStatusSideEffectContext = "inline" | "detail";

export interface LeadStatusEmailPayload {
  name: string;
  email: string;
  amount?: number | null;
  lead_id?: string;
  customer_id?: string | null;
}

type SideEffectResult =
  | { action: "skipped" }
  | { action: "sent"; kind: LeadStatusEmailKind }
  | { action: "failed"; kind: LeadStatusEmailKind; error: string };

const EMAIL_FN_MAP: Record<
  LeadStatusEmailKind,
  { fn: string; body: (lead: LeadStatusEmailPayload) => Record<string, unknown> }
> = {
  reminder: {
    fn: "send-reminder-email",
    body: (lead) => ({
      name: lead.name,
      email: lead.email,
      lead_id: lead.lead_id,
      customer_id: lead.customer_id ?? null,
    }),
  },
  offer: {
    fn: "send-offer-email",
    body: (lead) => ({
      name: lead.name,
      email: lead.email,
      lead_id: lead.lead_id,
      customer_id: lead.customer_id ?? null,
    }),
  },
  order: {
    fn: "send-order-email",
    body: (lead) => ({
      name: lead.name,
      email: lead.email,
      amount: lead.amount ?? null,
      lead_id: lead.lead_id,
      customer_id: lead.customer_id ?? null,
    }),
  },
  instructions: {
    fn: "send-instructions-email",
    body: (lead) => ({
      name: lead.name,
      email: lead.email,
      amount: lead.amount ?? null,
      lead_id: lead.lead_id,
      customer_id: lead.customer_id ?? null,
    }),
  },
};

/** True when transitioning to a status that triggers an email (per STATUS_CONFIG.sendsEmail). */
export function shouldSendLeadStatusEmail(
  oldStatus: LeadStatus,
  newStatus: LeadStatus,
): boolean {
  if (oldStatus === newStatus) return false;
  return !!STATUS_CONFIG[newStatus]?.sendsEmail;
}

/**
 * Central orchestration for status-driven email side-effects.
 * Used by inline status change and lead detail save.
 *
 * Bulk status updates intentionally do NOT call this — see bulkSetStatus in Admin.tsx.
 */
export async function runLeadStatusSideEffects(
  oldStatus: LeadStatus,
  newStatus: LeadStatus,
  lead: LeadStatusEmailPayload,
): Promise<SideEffectResult> {
  const kind = STATUS_CONFIG[newStatus]?.sendsEmail;
  if (!shouldSendLeadStatusEmail(oldStatus, newStatus) || !kind) {
    return { action: "skipped" };
  }

  const cfg = EMAIL_FN_MAP[kind];
  try {
    const { error } = await supabase.functions.invoke(cfg.fn, {
      body: cfg.body(lead),
    });
    if (error) {
      return { action: "failed", kind, error: error.message };
    }
    return { action: "sent", kind };
  } catch (e) {
    return {
      action: "failed",
      kind,
      error: e instanceof Error ? e.message : "Neznáma chyba",
    };
  }
}

/** Toast copy preserved from inline vs detail flows in Admin.tsx. */
export function getLeadStatusEmailToast(
  context: LeadStatusSideEffectContext,
  kind: LeadStatusEmailKind,
  outcome: "sent" | "failed",
  email: string,
  errorMessage?: string,
): { title: string; description?: string; variant?: "destructive" } {
  const inline = {
    reminder: { sent: "Reminder odoslaný", failed: "Reminder sa neodoslal" },
    offer: { sent: "Ponuka odoslaná", failed: "Ponuka sa neodoslala" },
    order: { sent: "Objednávka odoslaná", failed: "Objednávka sa neodoslala" },
    instructions: { sent: "Inštrukcie odoslané", failed: "Inštrukcie sa neodoslali" },
  } as const;

  const detail = {
    reminder: {
      sent: "Uložené & reminder odoslaný",
      failed: "Uložené, ale reminder sa neodoslal",
    },
    offer: {
      sent: "Uložené & ponuka odoslaná",
      failed: "Uložené, ale ponuka sa neodoslala",
    },
    order: {
      sent: "Uložené & objednávka odoslaná",
      failed: "Uložené, ale objednávka sa neodoslala",
    },
    instructions: {
      sent: "Uložené & inštrukcie odoslané",
      failed: "Uložené, ale inštrukcie sa neodoslali",
    },
  } as const;

  const labels = context === "inline" ? inline : detail;
  const title = labels[kind][outcome === "sent" ? "sent" : "failed"];

  if (outcome === "failed") {
    return { title, description: errorMessage, variant: "destructive" };
  }

  if (context === "detail" && kind === "order") {
    return { title, description: `${email} · zmluva v prílohe` };
  }

  return { title, description: email };
}
