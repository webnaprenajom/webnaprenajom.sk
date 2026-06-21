import { supabase } from "@/integrations/supabase/client";
import type { CrmUserArchiveRow } from "@/lib/identity/historicalIdentity";

export type RemoveCrmUserResult = {
  user_id: string;
  display_name: string;
  historical_implementer_name: string | null;
  email: string;
};

export async function removeCrmUser(userId: string): Promise<{
  data: RemoveCrmUserResult | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("owner_remove_crm_user", {
    p_target_user_id: userId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as RemoveCrmUserResult, error: null };
}

export async function clearCrmUserArchive(userId: string): Promise<string | null> {
  const { error } = await supabase.from("crm_user_archives").delete().eq("user_id", userId);
  return error?.message ?? null;
}

export async function loadCrmUserArchives(): Promise<CrmUserArchiveRow[]> {
  const { data, error } = await supabase
    .from("crm_user_archives")
    .select("user_id,email,display_name,historical_implementer_name,removed_at,removed_by_user_id")
    .order("removed_at", { ascending: false });
  if (error) {
    console.error("[crm_user_archives] load failed", error.message);
    return [];
  }
  return (data || []) as CrmUserArchiveRow[];
}
