/** UI copy — distinguishes manual status flags from audited payment facts. */



export const FINANCE_TRUTH_DISCLAIMER =
  "Súhrn agreguje CRM záznamy podľa úrovne dôveryhodnosti. Potvrdené platby/výplaty/náklady pochádzajú z payment_records / payout_records / cost_records. Legacy import je odvodený zo starých workflow flagov bez bankovej referencie. Interné stavy „vyplatené/uhradené“ nie sú auditované platobné dôkazy.";



export const COMMISSION_STATUS_LABELS = {

  paid: "Označ. vyplatené (workflow)",

  unpaid: "Nevyplatené (interný stav)",

} as const;



export const EXPENSE_STATUS_LABELS = {

  paid: "Označ. uhradené (workflow)",

  unpaid: "Neuhradené (interný stav)",

} as const;



export const RENTAL_MONTH_STATUS_LABELS = {

  none: "Bez stavu",

  invoice: "Faktúra vystavená (interný)",

  paid: "Označ. uhradené (workflow)",

  unpaid: "Nezaplatené (interný)",

  overdue: "Omeškaná platba (web deaktivovaný)",

} as const;



export const TRUTH_LEVEL_LABELS: Record<string, string> = {

  payment_fact: "Potvrdená platba",
  payout_fact: "Potvrdená výplata",
  cost_fact: "Potvrdený náklad",
  legacy_import: "Legacy import",

  workflow_only: "Iba workflow flag",

  derived: "Odvodené",

};


