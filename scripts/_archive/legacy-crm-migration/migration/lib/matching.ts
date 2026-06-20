import type { ParsedCsvRow, ReviewItem, StagedRow } from "./types.js";
import {
  buildNameEmailKey,
  normalizeEmail,
  normalizePhone,
  clientNameCompareKey,
} from "./normalizeIdentity.js";
import type { MigrationSourceDef } from "./sources.js";

export type CustomerCandidate = {
  matchMethod: "email" | "phone" | "name_email";
  email: string | null;
  phone: string | null;
  displayName: string | null;
  legacyLeadIds: string[];
};

export type DuplicateEmailGroup = {
  email: string;
  legacyIds: string[];
  sourceFile: string;
};

const REALIZED_LEAD_STATUSES = new Set(["won", "order", "realized", "completed"]);

export function isRealizedLeadStatus(status: string | null | undefined): boolean {
  if (!status?.trim()) return false;
  return REALIZED_LEAD_STATUSES.has(status.trim().toLowerCase());
}

export function classifyDuplicateEmailGroups(
  leadRows: StagedRow[],
): DuplicateEmailGroup[] {
  const byEmail = new Map<string, string[]>();
  for (const row of leadRows) {
    const email = normalizeEmail(row.payload.email);
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(row.legacyId);
    byEmail.set(email, list);
  }
  return [...byEmail.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([email, legacyIds]) => ({
      email,
      legacyIds,
      sourceFile: "leads.csv",
    }));
}

export function duplicateEmailReviewItems(groups: DuplicateEmailGroup[]): ReviewItem[] {
  return groups.map((g) => ({
    entityType: "lead",
    legacyId: g.legacyIds[0] ?? null,
    sourceFile: g.sourceFile,
    reason: "duplicate_email",
    detail: `Email ${g.email} appears on ${g.legacyIds.length} leads`,
    candidates: g.legacyIds.map((id) => ({ legacyId: id, email: g.email })),
  }));
}

export function detectSensitivePayloads(
  rows: StagedRow[],
  def: MigrationSourceDef,
): ReviewItem[] {
  const fields = def.sensitiveFields ?? [];
  if (fields.length === 0) return [];

  const items: ReviewItem[] = [];
  for (const row of rows) {
    const present = fields.filter((f) => (row.payload[f] ?? "").trim().length > 0);
    if (present.length === 0) continue;
    items.push({
      entityType: row.entityType,
      legacyId: row.legacyId,
      sourceFile: row.sourceFile,
      reason: "sensitive_payload",
      detail: `Contains sensitive fields: ${present.join(", ")} — promote only to admin credentials`,
      candidates: present.map((f) => ({ field: f, hasValue: true })),
    });
  }
  return items;
}

export function detectOrphanFkRisks(
  rows: StagedRow[],
  def: MigrationSourceDef,
  knownLegacyIds: Map<string, Set<string>>,
): ReviewItem[] {
  if (!def.fkFields?.length) return [];
  const items: ReviewItem[] = [];

  for (const row of rows) {
    for (const fk of def.fkFields) {
      const ref = (row.payload[fk.field] ?? "").trim();
      if (!ref) continue;
      const targetSet = knownLegacyIds.get(fk.targetSourceFile);
      if (targetSet?.has(ref)) continue;
      items.push({
        entityType: row.entityType,
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "orphan_fk",
        detail: `${fk.field}=${ref} not found in staged ${fk.targetSourceFile}`,
        candidates: [{ field: fk.field, value: ref, targetSourceFile: fk.targetSourceFile }],
      });
    }
  }
  return items;
}

/** Notification metadata.lead_id orphan check. */
export function detectNotificationLeadOrphans(
  notificationRows: StagedRow[],
  leadLegacyIds: Set<string>,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const row of notificationRows) {
    let leadId: string | null = null;
    const rawMeta = row.payload.metadata;
    if (rawMeta) {
      try {
        const meta = JSON.parse(rawMeta) as { lead_id?: string };
        leadId = meta.lead_id?.trim() || null;
      } catch {
        // non-json metadata — skip
      }
    }
    if (!leadId) continue;
    if (leadLegacyIds.has(leadId)) continue;
    items.push({
      entityType: "notification",
      legacyId: row.legacyId,
      sourceFile: row.sourceFile,
      reason: "orphan_fk",
      detail: `metadata.lead_id=${leadId} not found in staged leads.csv`,
      candidates: [{ lead_id: leadId }],
    });
  }
  return items;
}

export type ExistingCustomerHint = {
  id: string;
  email: string | null;
  display_name: string;
};

export function buildCustomerMatchHints(
  leadRows: StagedRow[],
  existingCustomers: ExistingCustomerHint[],
): ReviewItem[] {
  const byEmail = new Map<string, ExistingCustomerHint[]>();
  const byPhone = new Map<string, ExistingCustomerHint[]>();

  for (const c of existingCustomers) {
    const e = normalizeEmail(c.email);
    if (e) {
      const list = byEmail.get(e) ?? [];
      list.push(c);
      byEmail.set(e, list);
    }
    const phone = normalizePhone((c as { metadata?: { phone?: string } }).metadata?.phone);
    if (phone) {
      const list = byPhone.get(phone) ?? [];
      list.push(c);
      byPhone.set(phone, list);
    }
  }

  const items: ReviewItem[] = [];

  for (const row of leadRows) {
    if (!isRealizedLeadStatus(row.payload.status)) continue;

    const email = normalizeEmail(row.payload.email);
    const phone = normalizePhone(row.payload.phone);
    const candidates: CustomerCandidate[] = [];

    if (email) {
      const hits = byEmail.get(email) ?? [];
      if (hits.length === 1) {
        candidates.push({
          matchMethod: "email",
          email,
          phone: null,
          displayName: hits[0].display_name,
          legacyLeadIds: [row.legacyId],
        });
      } else if (hits.length > 1) {
        items.push({
          entityType: "lead",
          legacyId: row.legacyId,
          sourceFile: row.sourceFile,
          reason: "ambiguous_customer_match",
          detail: `Multiple existing customers share email ${email}`,
          candidates: hits,
        });
        continue;
      }
    }

    if (phone) {
      const hits = byPhone.get(phone) ?? [];
      if (hits.length > 1) {
        items.push({
          entityType: "lead",
          legacyId: row.legacyId,
          sourceFile: row.sourceFile,
          reason: "ambiguous_customer_match",
          detail: `Multiple existing customers share phone ${phone}`,
          candidates: hits,
        });
        continue;
      }
      if (hits.length === 1 && !candidates.length) {
        candidates.push({
          matchMethod: "phone",
          email: normalizeEmail(hits[0].email),
          phone,
          displayName: hits[0].display_name,
          legacyLeadIds: [row.legacyId],
        });
      }
    }

    const nameEmail = buildNameEmailKey(row.payload.name, row.payload.email);
    if (nameEmail && !candidates.length) {
      items.push({
        entityType: "lead",
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "ambiguous_customer_match",
        detail: `Realized lead has name+email key but no existing customer — will create on promote`,
        candidates: [{ matchMethod: "name_email", key: nameEmail }],
      });
    } else if (candidates.length === 1) {
      items.push({
        entityType: "lead",
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "ambiguous_customer_match",
        detail: `Possible existing customer match via ${candidates[0].matchMethod} (informational — link on promote)`,
        candidates,
      });
    }

    if (isRealizedLeadStatus(row.payload.status) && !email) {
      items.push({
        entityType: "lead",
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "missing_email",
        detail: "Realized lead missing email — customer create requires manual review",
      });
    }
  }

  return items;
}

export function buildLegacyIdIndex(rows: StagedRow[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = index.get(row.sourceFile) ?? new Set<string>();
    set.add(row.legacyId);
    index.set(row.sourceFile, set);
  }
  return index;
}

export function summarizeReviewItems(items: ReviewItem[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of items) {
    summary[item.reason] = (summary[item.reason] ?? 0) + 1;
  }
  return summary;
}

/** Classify whether a row should be flagged for review (non-blocking helper). */
export function shouldFlagForReview(item: ReviewItem): boolean {
  if (item.reason === "duplicate_email") return true;
  if (item.reason === "uuid_collision") return true;
  if (item.reason === "orphan_fk") return true;
  if (item.reason === "missing_email") return true;
  if (item.reason === "sensitive_payload") return false; // informational flag, still recorded
  if (item.reason === "ambiguous_customer_match") {
    return item.detail.includes("Multiple existing");
  }
  return false;
}

export function extractLeadIdentity(row: ParsedCsvRow) {
  return {
    email: normalizeEmail(row.email),
    phone: normalizePhone(row.phone),
    nameKey: clientNameCompareKey(row.name),
  };
}
