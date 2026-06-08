import { Flame, Minus, Snowflake } from "lucide-react";

export type LeadStatus =
  | "new"
  | "to_call"
  | "contacted"
  | "send_offer"
  | "offer_silent"
  | "reminder"
  | "reminder_silent"
  | "scheduled"
  | "send_instructions"
  | "order"
  | "won"
  | "lost";

export type SortKey =
  | "created_at"
  | "name"
  | "email"
  | "source"
  | "type"
  | "status"
  | "assigned_to"
  | "temperature";

export type SortDir = "asc" | "desc";
export type LeadTemperature = "hot" | "neutral" | "cold" | null;
export type ViewMode = "current" | "archive" | "stale" | "imported";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  type: string;
  language: string;
  status: LeadStatus;
  notes: string | null;
  source: string | null;
  temperature: LeadTemperature;
  assigned_to: string | null;
  consultation_date: string | null;
  consultation_time: string | null;
  follow_up_date: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
  status_changed_at: string | null;
  imported?: boolean;
  import_batch?: string | null;
}

export const ASSIGNEES = ["Peter", "Maroš", "Matuš"] as const;
export const UNASSIGNED = "__unassigned__";

export const STALE_DAYS = 14;
export const STALE_STATUSES: LeadStatus[] = [
  "contacted",
  "reminder",
  "reminder_silent",
  "offer_silent",
];
export const ARCHIVE_STATUSES: LeadStatus[] = ["won", "lost"];

export const isStale = (l: {
  status: string;
  status_changed_at: string | null;
  updated_at: string;
}) => {
  if (l.status === "offer_silent") return true;
  if (!STALE_STATUSES.includes(l.status as LeadStatus)) return false;
  const since = l.status_changed_at
    ? new Date(l.status_changed_at).getTime()
    : new Date(l.updated_at).getTime();
  return Date.now() - since >= STALE_DAYS * 86400000;
};

export const TEMP_CONFIG: Record<
  "hot" | "neutral" | "cold",
  { label: string; icon: typeof Flame; className: string }
> = {
  hot: { label: "Hot", icon: Flame, className: "text-red-500 hover:bg-red-500/10" },
  neutral: { label: "Neutral", icon: Minus, className: "text-yellow-500 hover:bg-yellow-500/10" },
  cold: { label: "Cold", icon: Snowflake, className: "text-blue-400 hover:bg-blue-400/10" },
};

export const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ai", label: "AI návrh" },
  { value: "consultation", label: "Konzultácia" },
  { value: "redesign", label: "Re-dizajn" },
  { value: "eshop", label: "Eshop" },
  { value: "ai_solution", label: "AI riešenie" },
  { value: "repair", label: "Opravy" },
];

export const typeLabel = (t: string) =>
  TYPE_OPTIONS.find((o) => o.value === t)?.label || t;

export const STATUS_CONFIG: Record<
  LeadStatus,
  {
    label: string;
    className: string;
    rowClass: string;
    borderClass: string;
    sendsEmail?: "reminder" | "offer" | "order" | "instructions";
  }
> = {
  new:        { label: "Nový",            className: "bg-blue-500/15 text-blue-500 border-blue-500/30",       rowClass: "bg-blue-500/5 hover:bg-blue-500/10",       borderClass: "border-l-4 border-l-blue-500" },
  to_call:    { label: "Zavolať 📞",      className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30", rowClass: "bg-indigo-500/5 hover:bg-indigo-500/10",   borderClass: "border-l-4 border-l-indigo-500" },
  contacted:  { label: "Kontaktovaný",    className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30", rowClass: "bg-yellow-500/5 hover:bg-yellow-500/10",   borderClass: "border-l-4 border-l-yellow-500" },
  send_offer: { label: "Poslať ponuku ✉", className: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",       rowClass: "bg-cyan-500/5 hover:bg-cyan-500/10",       borderClass: "border-l-4 border-l-cyan-500", sendsEmail: "offer" },
  offer_silent: { label: "Po ponuke bez reakcie", className: "bg-pink-500/15 text-pink-500 border-pink-500/30", rowClass: "bg-pink-500/5 hover:bg-pink-500/10", borderClass: "border-l-4 border-l-pink-500" },
  reminder:        { label: "Poslať reminder ✉", className: "bg-orange-500/15 text-orange-500 border-orange-500/30", rowClass: "bg-orange-500/5 hover:bg-orange-500/10", borderClass: "border-l-4 border-l-orange-500", sendsEmail: "reminder" },
  reminder_silent: { label: "Reminder (bez e-mailu)", className: "bg-amber-600/15 text-amber-600 border-amber-600/30", rowClass: "bg-amber-600/5 hover:bg-amber-600/10", borderClass: "border-l-4 border-l-amber-600" },
  scheduled:  { label: "Dohodnutý",       className: "bg-purple-500/15 text-purple-500 border-purple-500/30", rowClass: "bg-purple-500/5 hover:bg-purple-500/10",   borderClass: "border-l-4 border-l-purple-500" },
  send_instructions: { label: "Zaslať inštrukcie 📋", className: "bg-teal-500/15 text-teal-600 border-teal-500/30", rowClass: "bg-teal-500/5 hover:bg-teal-500/10", borderClass: "border-l-4 border-l-teal-500", sendsEmail: "instructions" },
  order:      { label: "Objednávka 📄",   className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", rowClass: "bg-emerald-500/5 hover:bg-emerald-500/10", borderClass: "border-l-4 border-l-emerald-500", sendsEmail: "order" },
  won:        { label: "Zrealizovaný",    className: "bg-green-500/15 text-green-500 border-green-500/30",    rowClass: "bg-green-500/5 hover:bg-green-500/10",     borderClass: "border-l-4 border-l-green-500" },
  lost:       { label: "Zamietnutý",      className: "bg-red-500/15 text-red-500 border-red-500/30",          rowClass: "bg-red-500/5 hover:bg-red-500/10",         borderClass: "border-l-4 border-l-red-500" },
};
