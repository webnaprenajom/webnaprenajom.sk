import { executeDestructiveDelete, precheckDestructiveDelete } from "./client";
import { isLeadDeleteRisky } from "./types";

export type BulkLeadDeleteItemFailure = {
  id: string;
  reason: string;
};

export type BulkLeadDeleteResult = {
  deleted: string[];
  skipped: string[];
  failed: BulkLeadDeleteItemFailure[];
};

/** ponytail: sequential RPC loop; fine for typical bulk sizes (<50). */
export async function bulkDeleteLeads(ids: string[]): Promise<BulkLeadDeleteResult> {
  const deleted: string[] = [];
  const skipped: string[] = [];
  const failed: BulkLeadDeleteItemFailure[] = [];

  for (const id of ids) {
    const { impact, error: precheckError } = await precheckDestructiveDelete("lead", id);
    if (precheckError || !impact) {
      failed.push({ id, reason: precheckError ?? "Precheck zlyhal." });
      continue;
    }

    if (impact.lead_impact && isLeadDeleteRisky(impact.lead_impact)) {
      skipped.push(id);
      continue;
    }

    const { result, error: execError } = await executeDestructiveDelete("lead", id);
    if (execError || !result) {
      failed.push({ id, reason: execError ?? "Zmazanie zlyhalo." });
      continue;
    }

    deleted.push(id);
  }

  return { deleted, skipped, failed };
}

export function formatBulkLeadDeleteSummary(result: BulkLeadDeleteResult): string {
  const parts: string[] = [];
  if (result.deleted.length > 0) parts.push(`Zmazaných: ${result.deleted.length}`);
  if (result.skipped.length > 0) {
    parts.push(`Preskočených: ${result.skipped.length} (rizikové / finančné upozornenie)`);
  }
  if (result.failed.length > 0) parts.push(`Zlyhalo: ${result.failed.length}`);
  return parts.join(" · ");
}
