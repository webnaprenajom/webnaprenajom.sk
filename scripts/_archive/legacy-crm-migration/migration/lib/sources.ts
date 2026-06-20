export type SourceKind = "entity" | "finance" | "activity" | "config";

/** migrate = promote after validation; manual = stage + report only; skip = empty/archive */
export type PromotePolicy = "migrate" | "manual" | "skip";

export type MigrationSourceDef = {
  sourceFile: string;
  fileAliases: string[];
  entityType: string;
  legacyIdField: string;
  kind: SourceKind;
  promotePolicy?: PromotePolicy;
  fkFields?: Array<{
    field: string;
    targetEntity: string;
    targetSourceFile: string;
  }>;
  sensitiveFields?: string[];
  canonicalTable?: string;
  /** Finance FACT tables — never derive from workflow if export has rows */
  isFactLayer?: boolean;
};

export const MIGRATION_SOURCES: MigrationSourceDef[] = [
  {
    sourceFile: "customers.csv",
    fileAliases: ["customers.csv"],
    entityType: "customer",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "customers",
  },
  {
    sourceFile: "team_profiles.csv",
    fileAliases: ["team_profiles.csv"],
    entityType: "team_profile",
    legacyIdField: "user_id",
    kind: "config",
    canonicalTable: "team_profiles",
    promotePolicy: "skip",
  },
  {
    sourceFile: "user_roles.csv",
    fileAliases: ["user_roles.csv"],
    entityType: "user_role",
    legacyIdField: "id",
    kind: "config",
    canonicalTable: "user_roles",
    promotePolicy: "manual",
  },
  {
    sourceFile: "leads.csv",
    fileAliases: ["leads.csv"],
    entityType: "lead",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "leads",
    fkFields: [{ field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" }],
  },
  {
    sourceFile: "rental_websites.csv",
    fileAliases: ["rental_websites.csv", "rental_websites-2.csv"],
    entityType: "rental_website",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "rental_websites",
    fkFields: [{ field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" }],
  },
  {
    sourceFile: "hosting_records.csv",
    fileAliases: ["hosting_records.csv"],
    entityType: "hosting_record",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "hosting_records",
    fkFields: [
      { field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" },
      {
        field: "rental_website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
  },
  {
    sourceFile: "rental_payments.csv",
    fileAliases: ["rental_payments.csv", "rental_payments-3.csv"],
    entityType: "rental_payment",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "rental_payments",
    fkFields: [
      {
        field: "website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
  },
  {
    sourceFile: "commission_rules.csv",
    fileAliases: ["commission_rules.csv"],
    entityType: "commission_rule",
    legacyIdField: "id",
    kind: "config",
    canonicalTable: "commission_rules",
  },
  {
    sourceFile: "commission_rule_overrides.csv",
    fileAliases: ["commission_rule_overrides.csv"],
    entityType: "commission_rule_override",
    legacyIdField: "id",
    kind: "config",
    canonicalTable: "commission_rule_overrides",
    fkFields: [
      { field: "rule_id", targetEntity: "commission_rule", targetSourceFile: "commission_rules.csv" },
      {
        field: "rental_website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
    promotePolicy: "skip",
  },
  {
    sourceFile: "commissions.csv",
    fileAliases: ["commissions.csv", "commissions-6.csv"],
    entityType: "commission",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "commissions",
    fkFields: [{ field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" }],
  },
  {
    sourceFile: "payment_records.csv",
    fileAliases: ["payment_records.csv"],
    entityType: "payment_record",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "payment_records",
    isFactLayer: true,
    fkFields: [
      {
        field: "rental_website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
  },
  {
    sourceFile: "cost_records.csv",
    fileAliases: ["cost_records.csv"],
    entityType: "cost_record",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "cost_records",
    isFactLayer: true,
    fkFields: [
      {
        field: "rental_website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
  },
  {
    sourceFile: "payout_records.csv",
    fileAliases: ["payout_records.csv"],
    entityType: "payout_record",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "payout_records",
    isFactLayer: true,
  },
  {
    sourceFile: "expenses.csv",
    fileAliases: ["expenses.csv", "expenses-7.csv"],
    entityType: "expense",
    legacyIdField: "id",
    kind: "finance",
    canonicalTable: "expenses",
  },
  {
    sourceFile: "tasks.csv",
    fileAliases: ["tasks.csv", "tasks-8.csv"],
    entityType: "task",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "tasks",
    fkFields: [
      { field: "lead_id", targetEntity: "lead", targetSourceFile: "leads.csv" },
      { field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" },
    ],
  },
  {
    sourceFile: "project_notes.csv",
    fileAliases: ["project_notes.csv", "project_notes-9.csv"],
    entityType: "project_note",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "project_notes",
    sensitiveFields: ["username", "password", "access_credentials"],
    fkFields: [
      { field: "lead_id", targetEntity: "lead", targetSourceFile: "leads.csv" },
      { field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" },
    ],
  },
  {
    sourceFile: "lead_logs.csv",
    fileAliases: ["lead_logs.csv", "lead_logs-11.csv"],
    entityType: "lead_log",
    legacyIdField: "id",
    kind: "activity",
    canonicalTable: "lead_logs",
    fkFields: [{ field: "lead_id", targetEntity: "lead", targetSourceFile: "leads.csv" }],
  },
  {
    sourceFile: "notifications.csv",
    fileAliases: ["notifications.csv", "notifications-12.csv"],
    entityType: "notification",
    legacyIdField: "id",
    kind: "activity",
    canonicalTable: "notifications",
  },
  {
    sourceFile: "wheel_spins.csv",
    fileAliases: ["wheel_spins.csv", "wheel_spins-10.csv"],
    entityType: "wheel_spin",
    legacyIdField: "id",
    kind: "activity",
    canonicalTable: "wheel_spins",
  },
  {
    sourceFile: "design_proposals.csv",
    fileAliases: ["design_proposals.csv", "design_proposals-5.csv"],
    entityType: "design_proposal",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "design_proposals",
  },
  {
    sourceFile: "order_signatures.csv",
    fileAliases: ["order_signatures.csv", "order_signatures-4.csv"],
    entityType: "order_signature",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "order_signatures",
    promotePolicy: "skip",
  },
  {
    sourceFile: "communication_events.csv",
    fileAliases: ["communication_events.csv"],
    entityType: "communication_event",
    legacyIdField: "id",
    kind: "activity",
    canonicalTable: "communication_events",
    fkFields: [{ field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" }],
  },
  {
    sourceFile: "customer_communication_summaries.csv",
    fileAliases: ["customer_communication_summaries.csv"],
    entityType: "customer_communication_summary",
    legacyIdField: "customer_id",
    kind: "activity",
    canonicalTable: "customer_communication_summaries",
    fkFields: [{ field: "customer_id", targetEntity: "customer", targetSourceFile: "customers.csv" }],
    promotePolicy: "skip",
  },
];

export function resolveSourceFile(
  basename: string,
): { def: MigrationSourceDef; matchedAlias: string } | null {
  const lower = basename.toLowerCase();
  for (const def of MIGRATION_SOURCES) {
    const hit = def.fileAliases.find((a) => a.toLowerCase() === lower);
    if (hit) return { def, matchedAlias: hit };
  }
  return null;
}

export function promotePolicyFor(def: MigrationSourceDef): PromotePolicy {
  return def.promotePolicy ?? "migrate";
}

export function stagingTableFor(def: MigrationSourceDef): "legacy_import_rows" | "legacy_finance_staging" {
  return def.kind === "finance" ? "legacy_finance_staging" : "legacy_import_rows";
}
