/** Which tables have SQL RPC promote steps in legacy_promote_batch. */

export type SqlPromoteStep =
  | "customers"
  | "commission_rules"
  | "leads"
  | "rental_websites"
  | "hosting_records"
  | "rental_payments"
  | "commissions"
  | "payment_records"
  | "cost_records"
  | "payout_records"
  | "expenses"
  | "project_notes"
  | "tasks"
  | "lead_logs"
  | "notifications"
  | "wheel_spins"
  | "design_proposals"
  | "communication_events";

export type TablePromoteStatus = "sql_wired" | "cli_plan_only" | "manual_only" | "skip_policy";

export type PromoteTableEntry = {
  sourceFile: string;
  canonicalTable: string;
  status: TablePromoteStatus;
  sqlStep?: SqlPromoteStep;
  notes?: string;
};

/** Order matches PROMOTE_ORDER in promotePolicies.ts */
export const PROMOTE_TABLE_REGISTRY: PromoteTableEntry[] = [
  { sourceFile: "customers.csv", canonicalTable: "customers", status: "sql_wired", sqlStep: "customers" },
  { sourceFile: "commission_rules.csv", canonicalTable: "commission_rules", status: "sql_wired", sqlStep: "commission_rules" },
  { sourceFile: "leads.csv", canonicalTable: "leads", status: "sql_wired", sqlStep: "leads" },
  {
    sourceFile: "rental_websites.csv",
    canonicalTable: "rental_websites",
    status: "sql_wired",
    sqlStep: "rental_websites",
    notes: "customer_email bridge",
  },
  { sourceFile: "hosting_records.csv", canonicalTable: "hosting_records", status: "sql_wired", sqlStep: "hosting_records" },
  {
    sourceFile: "rental_payments.csv",
    canonicalTable: "rental_payments",
    status: "sql_wired",
    sqlStep: "rental_payments",
    notes: "workflow only — never derive FACT",
  },
  {
    sourceFile: "commissions.csv",
    canonicalTable: "commissions",
    status: "sql_wired",
    sqlStep: "commissions",
    notes: "workflow only — never derive FACT",
  },
  { sourceFile: "payment_records.csv", canonicalTable: "payment_records", status: "sql_wired", sqlStep: "payment_records", notes: "FACT as exported" },
  { sourceFile: "cost_records.csv", canonicalTable: "cost_records", status: "sql_wired", sqlStep: "cost_records", notes: "FACT as exported" },
  { sourceFile: "payout_records.csv", canonicalTable: "payout_records", status: "sql_wired", sqlStep: "payout_records", notes: "FACT as exported" },
  { sourceFile: "expenses.csv", canonicalTable: "expenses", status: "sql_wired", sqlStep: "expenses" },
  { sourceFile: "project_notes.csv", canonicalTable: "project_notes", status: "sql_wired", sqlStep: "project_notes", notes: "sensitive fields as exported" },
  { sourceFile: "tasks.csv", canonicalTable: "tasks", status: "sql_wired", sqlStep: "tasks", notes: "parent_type backfill when customer_id" },
  { sourceFile: "lead_logs.csv", canonicalTable: "lead_logs", status: "sql_wired", sqlStep: "lead_logs", notes: "OPTION A orphan skip" },
  { sourceFile: "notifications.csv", canonicalTable: "notifications", status: "sql_wired", sqlStep: "notifications", notes: "trg_log_notification_insert off during bulk" },
  { sourceFile: "wheel_spins.csv", canonicalTable: "wheel_spins", status: "sql_wired", sqlStep: "wheel_spins" },
  { sourceFile: "design_proposals.csv", canonicalTable: "design_proposals", status: "sql_wired", sqlStep: "design_proposals" },
  { sourceFile: "communication_events.csv", canonicalTable: "communication_events", status: "sql_wired", sqlStep: "communication_events" },
  { sourceFile: "user_roles.csv", canonicalTable: "user_roles", status: "manual_only", notes: "YAML mapping required" },
  { sourceFile: "team_profiles.csv", canonicalTable: "team_profiles", status: "skip_policy" },
  { sourceFile: "order_signatures.csv", canonicalTable: "order_signatures", status: "skip_policy" },
  { sourceFile: "commission_rule_overrides.csv", canonicalTable: "commission_rule_overrides", status: "skip_policy" },
  { sourceFile: "customer_communication_summaries.csv", canonicalTable: "customer_communication_summaries", status: "skip_policy" },
];

export const SQL_WIRED_STEPS: SqlPromoteStep[] = [
  "customers",
  "commission_rules",
  "leads",
  "rental_websites",
  "hosting_records",
  "rental_payments",
  "commissions",
  "payment_records",
  "cost_records",
  "payout_records",
  "expenses",
  "project_notes",
  "tasks",
  "lead_logs",
  "notifications",
  "wheel_spins",
  "design_proposals",
  "communication_events",
];

export function registryForSource(sourceFile: string): PromoteTableEntry | undefined {
  return PROMOTE_TABLE_REGISTRY.find((e) => e.sourceFile === sourceFile);
}
