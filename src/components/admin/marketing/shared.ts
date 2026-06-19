export type MarketingChannel =
  | "google_ads"
  | "meta"
  | "seo"
  | "email"
  | "other";

export type MarketingStatus =
  | "active"
  | "paused"
  | "completed"
  | "archived";

export interface MarketingRecord {
  id: string;
  title: string;
  client_name: string | null;
  customer_email: string | null;
  customer_id: string | null;
  lead_id: string | null;
  channel: MarketingChannel;
  status: MarketingStatus;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  agreed_fee?: number | null;
}

export const MARKETING_CHANNELS: { value: MarketingChannel; label: string }[] = [
  { value: "google_ads", label: "Google Ads" },
  { value: "meta", label: "Meta (FB/IG)" },
  { value: "seo", label: "SEO" },
  { value: "email", label: "E-mail marketing" },
  { value: "other", label: "Iné" },
];

export const MARKETING_STATUSES: { value: MarketingStatus; label: string }[] = [
  { value: "active", label: "Aktívna" },
  { value: "paused", label: "Pozastavená" },
  { value: "completed", label: "Dokončená" },
  { value: "archived", label: "Archivovaná" },
];

export const MARKETING_STATUS_COLORS: Record<MarketingStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  archived: "bg-muted text-muted-foreground border-border",
};

export const emptyMarketingRecord: Omit<
  MarketingRecord,
  "id" | "created_at" | "updated_at"
> = {
  title: "",
  client_name: null,
  customer_email: null,
  customer_id: null,
  lead_id: null,
  channel: "other",
  status: "active",
  url: null,
  notes: null,
  agreed_fee: null,
};
