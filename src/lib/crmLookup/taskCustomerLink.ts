/**
 * Task ↔ customer linking (Batch I).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  isCanonicalCustomerId,
  resolveCustomerLinkFields,
} from "@/lib/crmLookup/customers";

export type TaskLinkStrength = "customer_id" | "lead_id" | "client_name" | "unlinked";

export type TaskLinkFields = {
  customer_id: string | null;
  client_name: string;
  lead_id: string | null;
};

export function classifyTaskLink(task: {
  customer_id?: string | null;
  lead_id?: string | null;
  client_name?: string | null;
}): TaskLinkStrength {
  if (task.customer_id && isCanonicalCustomerId(task.customer_id)) return "customer_id";
  if (task.lead_id) return "lead_id";
  if (task.client_name?.trim()) return "client_name";
  return "unlinked";
}

export const TASK_LINK_STRENGTH_LABELS: Record<TaskLinkStrength, string> = {
  customer_id: "Prepojené na zákazníka",
  lead_id: "Prepojené cez lead",
  client_name: "Len meno klienta",
  unlinked: "Bez prepojenia",
};

export const TASK_LINK_PRIORITY: Record<TaskLinkStrength, number> = {
  customer_id: 0,
  lead_id: 1,
  client_name: 2,
  unlinked: 3,
};

export function compareTaskLinkStrength(a: TaskLinkStrength, b: TaskLinkStrength): number {
  return TASK_LINK_PRIORITY[a] - TASK_LINK_PRIORITY[b];
}

/** Resolve strongest safe customer link for task save — no aggressive name guessing. */
export async function resolveTaskCustomerFields(input: {
  customer_id?: string | null;
  customer_email?: string | null;
  client_name?: string | null;
  lead_id?: string | null;
}): Promise<TaskLinkFields> {
  const leadId = input.lead_id?.trim() || null;
  let clientName = input.client_name?.trim() || "";
  let customerId: string | null =
    input.customer_id && isCanonicalCustomerId(input.customer_id) ? input.customer_id : null;

  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id,name,email,customer_id")
      .eq("id", leadId)
      .maybeSingle();

    if (lead) {
      if (!clientName) clientName = (lead.name || "").trim();
      if (!customerId && lead.customer_id && isCanonicalCustomerId(lead.customer_id)) {
        customerId = lead.customer_id;
      }
      if (!customerId && !input.customer_email && lead.email) {
        const linked = await resolveCustomerLinkFields({
          customer_email: lead.email,
          client_name: clientName || lead.name,
          createIfMissing: false,
        });
        customerId = linked.customer_id;
        if (!clientName) clientName = linked.client_name;
      }
    }
  }

  if (customerId || input.customer_email) {
    const linked = await resolveCustomerLinkFields({
      customer_id: customerId,
      customer_email: input.customer_email,
      client_name: clientName,
      createIfMissing: false,
    });
    return {
      customer_id: linked.customer_id,
      client_name: linked.client_name || clientName,
      lead_id: leadId,
    };
  }

  return {
    customer_id: customerId,
    client_name: clientName,
    lead_id: leadId,
  };
}

export interface TaskBackfillCandidate {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  client_name: string | null;
}

export interface LeadCustomerRef {
  id: string;
  customer_id: string | null;
}

/** Pure backfill planner — only lead.customer_id propagation (safe). */
export function planTaskCustomerBackfill(
  tasks: TaskBackfillCandidate[],
  leadsById: Map<string, LeadCustomerRef>,
): Array<{ taskId: string; proposedCustomerId: string | null; reason: string }> {
  return tasks.map((task) => {
    if (task.customer_id) {
      return { taskId: task.id, proposedCustomerId: null, reason: "already_linked" };
    }
    if (!task.lead_id) {
      return { taskId: task.id, proposedCustomerId: null, reason: "no_lead_id" };
    }
    const lead = leadsById.get(task.lead_id);
    if (!lead?.customer_id) {
      return { taskId: task.id, proposedCustomerId: null, reason: "lead_without_customer" };
    }
    return {
      taskId: task.id,
      proposedCustomerId: lead.customer_id,
      reason: "lead_customer_id",
    };
  });
}

export function summarizeOpenTasks(tasks: Array<{ status: string; customer_id?: string | null }>) {
  const open = tasks.filter((t) => t.status !== "done");
  const customerLinked = open.filter((t) => t.customer_id).length;
  return {
    openTotal: open.length,
    customerLinked,
    legacyOnly: open.length - customerLinked,
  };
}
