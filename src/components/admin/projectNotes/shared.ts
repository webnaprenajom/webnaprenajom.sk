export type ProjectType = "wordpress" | "shoptet" | "custom" | "other";

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
  notes: string | null;
  status: string;
  updated_at: string;
}

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "wordpress", label: "WordPress" },
  { value: "shoptet", label: "Shoptet" },
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
  username: "",
  password: "",
  notes: "",
  status: "in_progress",
};

export const MASKED_PASSWORD = "••••••••";

export const hasCredentials = (item: Pick<ProjectNote, "url" | "username" | "password">) =>
  !!(item.url?.trim() || item.username?.trim() || item.password?.trim());

export type ProjectNotesViewMode = "projects" | "passwords";
