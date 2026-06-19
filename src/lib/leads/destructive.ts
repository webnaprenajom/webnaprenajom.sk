/**
 * Canonical client API for lead destructive delete.
 * UI MUST call these (or useDestructiveAction with entityType "lead") — never supabase.from("leads").delete().
 *
 * Server: admin_precheck_destructive_delete / admin_execute_destructive_delete (entity_type = lead).
 * @see GOVERNANCE.md · migrations 20260620100000 (L1), 20260620110000 (L2)
 */

import {
  executeDestructiveDelete,
  precheckDestructiveDelete,
} from "@/lib/destructive/client";
import type { DestructiveDeleteResult, DestructiveImpactSummary } from "@/lib/destructive/types";

export async function precheckLeadDelete(
  leadId: string,
): Promise<{ impact: DestructiveImpactSummary | null; error: string | null }> {
  return precheckDestructiveDelete("lead", leadId);
}

export async function executeLeadDelete(
  leadId: string,
): Promise<{ result: DestructiveDeleteResult | null; error: string | null }> {
  return executeDestructiveDelete("lead", leadId);
}

/** Short description for bulk-delete confirmation dialogs. */
export const LEAD_DELETE_BULK_SUMMARY =
  "Pre každý lead sa skontrolujú dopady. Leady s finančným upozornením na prepojenom klientovi budú preskočené; ostatné sa zmazú (úlohy a projekty sa odpoja). Klient, prenájmy a potvrdené finančné fakty zostávajú nedotknuté.";

/** Lead-specific modal intro (single delete). */
export const LEAD_DELETE_MODAL_INTRO =
  "Lead sa odstráni z pipeline. Prepojený klient (ak existuje), prenájmy, hosting a potvrdené platby / náklady / výplaty zostávajú v systéme. Úlohy a projekty sa odpoja od leadu.";
