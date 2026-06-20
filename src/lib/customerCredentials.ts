/**
 * Customer-owned access credentials (customer_credentials table).
 */

export const CREDENTIAL_CATEGORIES = [
  { value: "web_admin", label: "Web admin" },
  { value: "hosting", label: "Hosting" },
  { value: "email", label: "E-mail" },
  { value: "domain", label: "Doména" },
  { value: "shoptet", label: "Shoptet" },
  { value: "wordpress", label: "WordPress" },
  { value: "facebook", label: "Facebook" },
  { value: "google_ads", label: "Google Ads" },
  { value: "other", label: "Iné" },
] as const;

export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[number]["value"];

export type LinkedEntityType = "project" | "hosting" | "marketing" | "rental";

export const LINKED_ENTITY_TYPES: { value: LinkedEntityType; label: string }[] = [
  { value: "project", label: "Projekt" },
  { value: "hosting", label: "Hosting" },
  { value: "marketing", label: "Marketing" },
  { value: "rental", label: "Prenájom" },
];

/** Admin list load — explicit columns (includes password for reveal/copy in list UI). */
export const CREDENTIAL_LIST_SELECT =
  "id,customer_id,customer_email,client_name,lead_id,category,label,url,login,password,note,linked_entity_type,linked_entity_id,batch_id,updated_at" as const;

export type CustomerCredential = {
  id: string;
  customer_id: string | null;
  customer_email: string | null;
  client_name: string | null;
  lead_id: string | null;
  category: CredentialCategory;
  label: string | null;
  url: string | null;
  login: string | null;
  password: string | null;
  note: string | null;
  linked_entity_type: LinkedEntityType | null;
  linked_entity_id: string | null;
  batch_id: string | null;
  updated_at: string;
};

/** One login row inside the credential modal (maps to customer_credentials row). */
export type CredentialFormItem = {
  key: string;
  dbId?: string;
  category: CredentialCategory;
  label: string;
  url: string;
  login: string;
  password: string;
  note: string;
};

/** Modal state: shared client + entity context, repeatable credential items. */
export type CredentialFormState = {
  customer_id: string | null;
  customer_email: string | null;
  client_name: string | null;
  lead_id: string | null;
  batch_id: string | null;
  linked_entity_type: LinkedEntityType | null;
  linked_entity_id: string | null;
  items: CredentialFormItem[];
};

export const MASKED_PASSWORD = "••••••••";

const CATEGORY_LABEL = new Map(CREDENTIAL_CATEGORIES.map((c) => [c.value, c.label]));

export function credentialCategoryLabel(category: string): string {
  return CATEGORY_LABEL.get(category as CredentialCategory) ?? category;
}

export function credentialDisplayLabel(c: Pick<CustomerCredential, "category" | "label">): string {
  const base = credentialCategoryLabel(c.category);
  const extra = c.label?.trim();
  if (c.category === "other" && extra) return extra;
  if (extra && extra.toLowerCase() !== base.toLowerCase()) return `${base} — ${extra}`;
  return base;
}

export function linkedEntityTypeLabel(type: string | null): string {
  if (!type) return "—";
  return LINKED_ENTITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function emptyCustomerCredential(): Partial<CustomerCredential> {
  return {
    customer_id: null,
    customer_email: "",
    client_name: "",
    lead_id: null,
    category: "web_admin",
    label: "",
    url: "",
    login: "",
    password: "",
    note: "",
    linked_entity_type: null,
    linked_entity_id: null,
    batch_id: null,
  };
}

export function newCredentialItemKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyFormItem(category: CredentialCategory = "web_admin"): CredentialFormItem {
  return {
    key: newCredentialItemKey(),
    category,
    label: "",
    url: "",
    login: "",
    password: "",
    note: "",
  };
}

export function emptyCredentialFormState(
  partial?: Partial<Omit<CredentialFormState, "items">> & { items?: CredentialFormItem[] },
): CredentialFormState {
  return {
    customer_id: null,
    customer_email: "",
    client_name: "",
    lead_id: null,
    batch_id: null,
    linked_entity_type: null,
    linked_entity_id: null,
    items: [createEmptyFormItem()],
    ...partial,
  };
}

export function credentialToFormItem(c: CustomerCredential): CredentialFormItem {
  return {
    key: c.id,
    dbId: c.id,
    category: c.category,
    label: c.label || "",
    url: c.url || "",
    login: c.login || "",
    password: c.password || "",
    note: c.note || "",
  };
}

export function formStateFromCredentials(rows: CustomerCredential[]): CredentialFormState {
  const head = rows[0];
  return {
    customer_id: head.customer_id,
    customer_email: head.customer_email,
    client_name: head.client_name,
    lead_id: head.lead_id,
    batch_id: head.batch_id,
    linked_entity_type: head.linked_entity_type,
    linked_entity_id: head.linked_entity_id,
    items: rows.map(credentialToFormItem),
  };
}

export function isCredentialItemBlank(
  item: Pick<CredentialFormItem, "label" | "url" | "login" | "password" | "note">,
): boolean {
  return !item.label?.trim() && !credentialHasSecret(item) && !item.note?.trim();
}

export function filledCredentialItems(items: CredentialFormItem[]): CredentialFormItem[] {
  return items.filter((i) => !isCredentialItemBlank(i));
}

export function credentialHasSecret(c: Pick<CustomerCredential, "url" | "login" | "password">): boolean {
  return !!(c.url?.trim() || c.login?.trim() || c.password?.trim());
}

export function validateCredentialDraft(
  editing: Partial<Pick<CustomerCredential, "label" | "url" | "login" | "password">>,
): string | null {
  if (!editing.label?.trim()) return "Zadaj označenie prístupu";
  if (!credentialHasSecret(editing)) return "Zadaj aspoň URL, login alebo heslo";
  return null;
}

export function validateCredentialFormItems(items: CredentialFormItem[]): string | null {
  const filled = filledCredentialItems(items);
  if (!filled.length) return "Pridaj aspoň jeden vyplnený prístup";
  for (let i = 0; i < filled.length; i++) {
    const err = validateCredentialDraft(filled[i]);
    if (err) return `Prístup #${i + 1}: ${err}`;
  }
  return null;
}

/** Stable idempotency key for backfill from project_notes.access_credentials rows. */
export function legacyCredentialSourceKey(projectNoteId: string, credentialId: string): string {
  return `project_notes:${projectNoteId}:${credentialId}`;
}

export function legacyCredentialLegacyColumnKey(projectNoteId: string): string {
  return `project_notes:${projectNoteId}:legacy`;
}

/** ponytail: minimal self-check — fails if label logic regresses */
export function credentialLabelSelfCheck(): void {
  const mixed = credentialDisplayLabel({ category: "wordpress", label: "FTP" });
  if (!mixed.includes("WordPress") || !mixed.includes("FTP")) {
    throw new Error("credentialDisplayLabel: mixed label failed");
  }
  const other = credentialDisplayLabel({ category: "other", label: "VPN" });
  if (other !== "VPN") throw new Error("credentialDisplayLabel: other category failed");
}
