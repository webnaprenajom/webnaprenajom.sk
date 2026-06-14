import { supabase } from "@/integrations/supabase/client";
import {
  parseDeleteResult,
  parseImpactSummary,
  type DestructiveDeleteResult,
  type DestructiveEntityType,
  type DestructiveImpactSummary,
} from "./types";

export async function precheckDestructiveDelete(
  entityType: DestructiveEntityType,
  entityId: string,
): Promise<{ impact: DestructiveImpactSummary | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_precheck_destructive_delete", {
    p_entity_type: entityType,
    p_entity_id: entityId,
  });

  if (error) {
    return { impact: null, error: error.message };
  }

  const impact = parseImpactSummary(data);
  if (!impact) {
    return { impact: null, error: "Neplatná odpoveď precheck služby." };
  }
  return { impact, error: null };
}

export async function executeDestructiveDelete(
  entityType: DestructiveEntityType,
  entityId: string,
  options: Record<string, unknown> = {},
): Promise<{ result: DestructiveDeleteResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_execute_destructive_delete", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_options: options,
  });

  if (error) {
    const msg = error.message.startsWith("delete_blocked:")
      ? error.message.replace(/^delete_blocked:\s*/, "")
      : error.message;
    return { result: null, error: msg };
  }

  const result = parseDeleteResult(data);
  if (!result) {
    return { result: null, error: "Neplatná odpoveď delete služby." };
  }
  return { result, error: null };
}
