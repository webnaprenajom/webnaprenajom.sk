export type LookupKind =
  | "customer"
  | "client"
  | "lead"
  | "project"
  | "rental"
  | "hosting"
  | "marketing"
  | "task"
  | "email";

export interface LookupResult {
  kind: LookupKind;
  id: string;
  label: string;
  sublabel?: string;
  email?: string | null;
  clientName?: string | null;
  meta?: Record<string, unknown>;
}

export interface LookupSearchOptions {
  kind: LookupKind;
  query?: string;
  limit?: number;
}
