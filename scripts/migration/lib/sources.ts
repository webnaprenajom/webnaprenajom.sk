export type SourceKind = "entity" | "finance" | "activity";

export type MigrationSourceDef = {
  sourceFile: string;
  fileAliases: string[];
  entityType: string;
  legacyIdField: string;
  kind: SourceKind;
  fkFields?: Array<{
    field: string;
    targetEntity: string;
    targetSourceFile: string;
  }>;
  sensitiveFields?: string[];
  canonicalTable?: string;
};

export const MIGRATION_SOURCES: MigrationSourceDef[] = [
  {
    sourceFile: "leads.csv",
    fileAliases: ["leads.csv"],
    entityType: "lead",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "leads",
  },
  {
    sourceFile: "rental_websites.csv",
    fileAliases: ["rental_websites.csv", "rental_websites-2.csv"],
    entityType: "rental_website",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "rental_websites",
  },
  {
    sourceFile: "tasks.csv",
    fileAliases: ["tasks.csv", "tasks-8.csv"],
    entityType: "task",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "tasks",
    fkFields: [{ field: "lead_id", targetEntity: "lead", targetSourceFile: "leads.csv" }],
  },
  {
    sourceFile: "project_notes.csv",
    fileAliases: ["project_notes.csv", "project_notes-9.csv"],
    entityType: "project_note",
    legacyIdField: "id",
    kind: "entity",
    canonicalTable: "project_notes",
    sensitiveFields: ["username", "password"],
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
    sourceFile: "commissions.csv",
    fileAliases: ["commissions.csv", "commissions-6.csv"],
    entityType: "commission",
    legacyIdField: "id",
    kind: "finance",
  },
  {
    sourceFile: "rental_payments.csv",
    fileAliases: ["rental_payments.csv", "rental_payments-3.csv"],
    entityType: "rental_payment",
    legacyIdField: "id",
    kind: "finance",
    fkFields: [
      {
        field: "website_id",
        targetEntity: "rental_website",
        targetSourceFile: "rental_websites.csv",
      },
    ],
  },
  {
    sourceFile: "expenses.csv",
    fileAliases: ["expenses.csv", "expenses-7.csv"],
    entityType: "expense",
    legacyIdField: "id",
    kind: "finance",
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
