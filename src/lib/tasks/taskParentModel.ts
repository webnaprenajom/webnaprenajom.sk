/**
 * Task parent entity model (Batch 2).
 * ponytail: parent_type + parent_id; no per-entity FK columns; legacy rows may lack parent.
 */
import { supabase } from "@/integrations/supabase/client";
import type { LookupKind, LookupResult } from "@/lib/crmLookup/types";

export const TASK_PARENT_TYPES = [
  "customer",
  "project",
  "hosting",
  "marketing",
  "rental",
] as const;

export type TaskParentType = (typeof TASK_PARENT_TYPES)[number];

export const TASK_PARENT_TYPE_LABELS: Record<TaskParentType, string> = {
  customer: "Zákazník",
  project: "Projekt",
  hosting: "Hosting",
  marketing: "Marketing",
  rental: "Prenájom",
};

export const TASK_PARENT_LOOKUP_KIND: Record<TaskParentType, LookupKind> = {
  customer: "customer",
  project: "project",
  hosting: "hosting",
  marketing: "marketing",
  rental: "rental",
};

export type TaskParentRef = {
  parent_type: TaskParentType;
  parent_id: string;
  label?: string;
};

export function taskParentKey(parent_type: string, parent_id: string): string {
  return `${parent_type}:${parent_id}`;
}

export function isValidTaskParentType(value: string | null | undefined): value is TaskParentType {
  return !!value && (TASK_PARENT_TYPES as readonly string[]).includes(value);
}

export function isOrphanTask(task: {
  parent_type?: string | null;
  parent_id?: string | null;
}): boolean {
  return !isValidTaskParentType(task.parent_type) || !task.parent_id?.trim();
}

export function taskParentRequiredError(
  parent_type: string | null | undefined,
  parent_id: string | null | undefined,
): string | null {
  if (isValidTaskParentType(parent_type) && parent_id?.trim()) return null;
  return "Vyberte nadradenú entitu (zákazník, projekt, hosting, marketing alebo prenájom).";
}

export function taskParentDetailHref(
  parent_type: string | null | undefined,
  parent_id: string | null | undefined,
): string | null {
  if (!isValidTaskParentType(parent_type) || !parent_id?.trim()) return null;
  switch (parent_type) {
    case "customer":
      return `/admin/customers/${parent_id}`;
    case "project":
      return `/admin/projects/${parent_id}`;
    case "hosting":
      return `/admin/hosting/${parent_id}`;
    case "marketing":
      return `/admin/marketing/${parent_id}`;
    case "rental":
      return `/admin/rentals?website=${parent_id}`;
    default:
      return null;
  }
}

export function buildTaskCreateHref(parent: TaskParentRef): string {
  const params = new URLSearchParams({
    task: "new",
    parentType: parent.parent_type,
    parentId: parent.parent_id,
  });
  if (parent.label) params.set("parentLabel", parent.label);
  return `/admin/tasks?${params.toString()}`;
}

export function parentFromLookup(row: LookupResult): TaskParentRef | null {
  const map: Partial<Record<LookupKind, TaskParentType>> = {
    customer: "customer",
    project: "project",
    hosting: "hosting",
    marketing: "marketing",
    rental: "rental",
  };
  const parent_type = map[row.kind];
  if (!parent_type || !row.id) return null;
  return { parent_type, parent_id: row.id, label: row.label };
}

export function parseTaskParentFromSearchParams(params: URLSearchParams): TaskParentRef | null {
  const parent_type = params.get("parentType") || "";
  const parent_id = params.get("parentId") || "";
  if (!isValidTaskParentType(parent_type) || !parent_id.trim()) return null;
  return {
    parent_type,
    parent_id: parent_id.trim(),
    label: params.get("parentLabel") || undefined,
  };
}

/** Sync legacy customer/lead fields from canonical parent for hub + filters. */
export async function enrichTaskCustomerFieldsFromParent(
  parent: TaskParentRef,
): Promise<{ customer_id: string | null; lead_id: string | null; client_name: string }> {
  const empty = { customer_id: null as string | null, lead_id: null as string | null, client_name: "" };

  switch (parent.parent_type) {
    case "customer": {
      const { data } = await supabase
        .from("customers")
        .select("id,display_name,email")
        .eq("id", parent.parent_id)
        .maybeSingle();
      if (!data) return empty;
      return {
        customer_id: data.id,
        lead_id: null,
        client_name: (data.display_name || "").trim(),
      };
    }
    case "project": {
      const { data } = await supabase
        .from("project_notes")
        .select("client_name,customer_email,customer_id,lead_id")
        .eq("id", parent.parent_id)
        .maybeSingle();
      if (!data) return empty;
      return {
        customer_id: data.customer_id ?? null,
        lead_id: data.lead_id ?? null,
        client_name: (data.client_name || "").trim(),
      };
    }
    case "hosting": {
      const { data } = await supabase
        .from("hosting_records")
        .select("client_name,customer_email,customer_id")
        .eq("id", parent.parent_id)
        .maybeSingle();
      if (!data) return empty;
      return {
        customer_id: data.customer_id ?? null,
        lead_id: null,
        client_name: (data.client_name || "").trim(),
      };
    }
    case "marketing": {
      const { data } = await supabase
        .from("marketing_records")
        .select("client_name,customer_email,customer_id,lead_id")
        .eq("id", parent.parent_id)
        .maybeSingle();
      if (!data) return empty;
      return {
        customer_id: data.customer_id ?? null,
        lead_id: data.lead_id ?? null,
        client_name: (data.client_name || "").trim(),
      };
    }
    case "rental": {
      const { data } = await supabase
        .from("rental_websites")
        .select("name,client_name,customer_id,customer_email")
        .eq("id", parent.parent_id)
        .maybeSingle();
      if (!data) return empty;
      return {
        customer_id: data.customer_id ?? null,
        lead_id: null,
        client_name: (data.client_name || data.name || "").trim(),
      };
    }
    default:
      return empty;
  }
}

/** Batch-resolve parent labels for task list rows. */
export async function resolveTaskParentLabels(
  rows: Array<{ parent_type?: string | null; parent_id?: string | null }>,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const idsByType = new Map<TaskParentType, Set<string>>();
  for (const row of rows) {
    if (!isValidTaskParentType(row.parent_type) || !row.parent_id) continue;
    const set = idsByType.get(row.parent_type) ?? new Set<string>();
    set.add(row.parent_id);
    idsByType.set(row.parent_type, set);
  }

  const load = async (
    type: TaskParentType,
    table: string,
    idCol: string,
    labelCol: string,
  ) => {
    const ids = [...(idsByType.get(type) ?? [])];
    if (!ids.length) return;
    const { data } = await supabase.from(table).select(`${idCol},${labelCol}`).in(idCol, ids);
    (data || []).forEach((r: Record<string, string>) => {
      labels.set(taskParentKey(type, r[idCol]), String(r[labelCol] || "—"));
    });
  };

  await Promise.all([
    load("customer", "customers", "id", "display_name"),
    load("project", "project_notes", "id", "title"),
    load("hosting", "hosting_records", "id", "client_name"),
    load("marketing", "marketing_records", "id", "title"),
    load("rental", "rental_websites", "id", "name"),
  ]);

  return labels;
}
