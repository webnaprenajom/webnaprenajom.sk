import type { Json } from "@/integrations/supabase/types";

export type ProjectType = "wordpress" | "shoptet" | "custom" | "other" | "ai";

export interface ProjectNote {
  id: string;
  title: string;
  client_name: string | null;
  customer_email: string | null;
  customer_id: string | null;
  lead_id: string | null;
  project_type: ProjectType | null;
  url: string | null;
  username: string | null;
  password: string | null;
  access_credentials?: Json;
  notes: string | null;
  status: string;
  updated_at: string;
  operating_cost?: number;
  agreed_fee?: number | null;
}

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "wordpress", label: "WordPress" },
  { value: "shoptet", label: "Shoptet" },
  { value: "ai", label: "AI" },
  { value: "custom", label: "Zákazkový web" },
  { value: "other", label: "Iné" },
];

export const PROJECT_STATUSES = [
  { value: "in_progress", label: "Rozpracované", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { value: "waiting", label: "Čaká na klienta", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  { value: "done", label: "Hotové", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { value: "archived", label: "Archív", color: "bg-muted text-muted-foreground border-border" },
] as const;

export const emptyProjectNote: Partial<ProjectNote> = {
  title: "",
  client_name: "",
  customer_email: "",
  customer_id: null,
  lead_id: null,
  project_type: "wordpress",
  url: "",
  notes: "",
  status: "in_progress",
};

/** List load — excludes legacy credential columns (canonical store: customer_credentials). */
export const PROJECT_LIST_SELECT =
  "id,title,client_name,customer_email,customer_id,lead_id,project_type,url,notes,status,updated_at,operating_cost,agreed_fee" as const;

const LEGACY_CREDENTIAL_KEYS = new Set([
  "username",
  "password",
  "access_credentials",
]);

/** Delivery-only project_notes write — never mutates legacy credential columns. */
export function buildProjectNoteDeliveryPayload(
  editing: Partial<ProjectNote>,
  linked: {
    client_name: string | null;
    customer_email: string;
    customer_id: string;
    lead_id: string | null;
  },
): Record<string, unknown> {
  const payload = {
    title: editing.title!.trim(),
    client_name: linked.client_name || null,
    customer_email: linked.customer_email,
    customer_id: linked.customer_id,
    lead_id: linked.lead_id || editing.lead_id || null,
    project_type: editing.project_type || null,
    url: editing.url?.trim() || null,
    notes: editing.notes || null,
    status: editing.status || "in_progress",
  };
  for (const key of Object.keys(payload)) {
    if (LEGACY_CREDENTIAL_KEYS.has(key)) {
      throw new Error(`project_notes delivery payload must not include legacy credential field: ${key}`);
    }
  }
  return payload;
}
