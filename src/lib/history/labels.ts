const MODULE_BY_ENTITY: Record<string, string> = {
  lead: "Leady",
  customer: "Klienti",
  rental_websites: "Prenájmy",
  hosting_records: "Hosting",
  project_notes: "Projekty",
  tasks: "Úlohy",
  commission: "Financie",
  payment_records: "Financie",
  payout_records: "Financie",
  cost_records: "Financie",
  user_roles: "Nastavenia",
  team_profiles: "Nastavenia",
  implementer: "Realizátori",
  finance_rules: "Financie",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  customer: "Klient",
  rental_websites: "Prenájom",
  hosting_records: "Hosting",
  project_notes: "Projekt",
  tasks: "Úloha",
  commission: "Provízia",
  payment_records: "Platba",
  payout_records: "Výplata",
  cost_records: "Náklad",
  user_roles: "Rola používateľa",
  team_profiles: "Team profile",
  implementer: "Realizátor",
};

const LEAD_FIELD_LABELS: Record<string, string> = {
  status: "Status",
  type: "Typ",
  assigned_to: "Kto rieši",
  temperature: "Teplota",
  source: "Zdroj",
  name: "Meno",
  email: "E-mail",
  phone: "Telefón",
  notes: "Poznámky",
  amount: "Suma",
  consultation_date: "Termín konzultácie",
  prize: "Výhra",
  wheel_spin: "Koleso šťastia",
  lead: "Lead",
};

const LEAD_ACTION_LABELS: Record<string, string> = {
  created: "Vytvorený lead",
  updated: "Upravený lead",
  deleted: "Vymazaný lead",
  notification: "Notifikácia",
  wheel_spin: "Koleso šťastia",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  role_assigned: "Rola pridaná",
  role_removed: "Rola odstránená",
  team_profile_assigned: "Team profile priradený",
  team_profile_updated: "Team profile upravený",
  commission_status_changed: "Stav provízie",
  operating_cost_changed: "Prevádzkové náklady",
  finance_config_changed: "Finančná konfigurácia",
  entity_deleted: "Zmazaná entita",
  user_archived: "Používateľ odstránený z CRM",
  entity_created: "Vytvorená entita",
  entity_updated: "Upravená entita",
  status_changed: "Zmena stavu",
  payment_recorded: "Zaznamenaná platba",
  payout_recorded: "Zaznamenaná výplata",
  cost_recorded: "Zaznamenaný náklad",
};

export function historyModuleForEntity(entityType: string): string {
  return MODULE_BY_ENTITY[entityType] ?? "CRM";
}

export function historyEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

export function leadFieldLabel(field: string | null): string {
  if (!field) return "";
  return LEAD_FIELD_LABELS[field] ?? field;
}

export function leadActionLabel(action: string, field: string | null): string {
  if (action === "updated" && field) {
    return `Zmena: ${leadFieldLabel(field)}`;
  }
  return LEAD_ACTION_LABELS[action] ?? action;
}

export function auditActionLabel(actionType: string): string {
  return AUDIT_ACTION_LABELS[actionType] ?? actionType;
}

export function leadActionTypeFromRow(action: string, field: string | null): string {
  if (action === "updated" && field) return `updated_${field}`;
  return action;
}
