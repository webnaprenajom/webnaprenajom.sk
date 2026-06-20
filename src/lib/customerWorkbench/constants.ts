export const LOG_FIELD_LABEL: Record<string, string> = {
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
};

export const DESIGN_STATUS_LABEL: Record<string, string> = {
  sent: "Zaslané",
  viewed: "Pozreté",
  approved: "Schválené",
  rejected: "Zamietnuté",
  revision: "Úpravy",
};

export const SIGNATURE_STATUS_LABEL: Record<string, string> = {
  signed: "Podpísané",
  in_progress: "Realizuje sa",
  done: "Hotové",
  canceled: "Zrušené",
};

export const MARKETING_STATUS_LABEL: Record<string, string> = {
  active: "Aktívna",
  paused: "Pozastavená",
  archived: "Archivovaná",
};

export const NOTE_STATUS_LABEL: Record<string, string> = {
  in_progress: "Prebieha",
  waiting: "Čaká",
  done: "Hotové",
  archived: "Archivované",
};

export const WORKBENCH_TABS = [
  { id: "prehlad", label: "Prehľad" },
  { id: "komunikacia", label: "Komunikácia" },
  { id: "projekty", label: "Projekty" },
  { id: "hesla", label: "Heslá" },
  { id: "marketing", label: "Marketing" },
  { id: "prenajmy", label: "Prenájmy" },
  { id: "hosting", label: "Hosting" },
  { id: "financie", label: "Financie" },
  { id: "ulohy", label: "Úlohy" },
  { id: "historia", label: "História" },
] as const;

export const logSummary = (log: {
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
}): string => {
  if (log.action === "updated" && log.field) {
    const field = LOG_FIELD_LABEL[log.field] || log.field;
    const from = log.old_value ?? "—";
    const to = log.new_value ?? "—";
    return `${field}: ${from} → ${to}`;
  }
  if (log.action === "created") return "Lead vytvorený";
  if (log.action === "deleted") return "Lead vymazaný";
  if (log.action === "notification") return log.new_value || "Notifikácia";
  if (log.action === "wheel_spin") return log.new_value || "Spin na kolese";
  return log.action;
};
