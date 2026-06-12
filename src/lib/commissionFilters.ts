/**
 * Section-scoped commission filtering (Batch RC4).
 * Pure helpers — safe for unit tests without Supabase.
 */

import {
  type CommissionRow,
  type CommissionSourceType,
  getCommissionLinkStatus,
} from "@/lib/commissionSource";

export type SectionCommissionBuckets = {
  /** Commissions linked to the requested section (source_type + source_id). */
  section: CommissionRow[];
  /** Rows with no source link — legacy backlog. */
  legacy: CommissionRow[];
  /** Rows linked to a different section — must not appear as section-owned. */
  crossSection: CommissionRow[];
};

export function isCommissionForSection(
  row: CommissionRow,
  section: CommissionSourceType,
): boolean {
  return row.source_type === section && !!row.source_id?.trim();
}

/** Split commissions for a section view — prevents cross-section leakage. */
export function bucketCommissionsBySection(
  rows: CommissionRow[],
  section: CommissionSourceType,
): SectionCommissionBuckets {
  const sectionRows: CommissionRow[] = [];
  const legacy: CommissionRow[] = [];
  const crossSection: CommissionRow[] = [];

  for (const row of rows) {
    const status = getCommissionLinkStatus(row);
    if (status === "linked" && row.source_type === section) {
      sectionRows.push(row);
    } else if (status === "legacy" || status === "partial") {
      legacy.push(row);
    } else if (status === "linked" && row.source_type !== section) {
      crossSection.push(row);
    } else {
      legacy.push(row);
    }
  }

  return { section: sectionRows, legacy, crossSection };
}

export function filterImplementerCommissions(
  rows: CommissionRow[],
  implementer: string,
  options?: { year?: number; section?: CommissionSourceType },
): CommissionRow[] {
  const name = implementer.trim().toLowerCase();
  return rows.filter((c) => {
    if ((c.implementer || "").trim().toLowerCase() !== name) return false;
    if (options?.year != null && !c.date.startsWith(String(options.year))) return false;
    if (options?.section != null && !isCommissionForSection(c, options.section)) return false;
    return true;
  });
}
