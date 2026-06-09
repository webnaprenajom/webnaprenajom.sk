import { supabase } from "@/integrations/supabase/client";
import type { DismissalType } from "./issueKeys";

export interface IssueDismissalRow {
  id: string;
  issue_key: string;
  issue_type: string;
  dismissal_type: DismissalType;
  reason: string | null;
  created_at: string;
}

export async function loadIssueDismissals(): Promise<IssueDismissalRow[]> {
  const { data, error } = await supabase
    .from("finance_issue_dismissals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []) as IssueDismissalRow[];
}

export async function dismissIssue(input: {
  issueKey: string;
  issueType: string;
  dismissalType: DismissalType;
  reason?: string;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("finance_issue_dismissals").insert({
    issue_key: input.issueKey,
    issue_type: input.issueType,
    dismissal_type: input.dismissalType,
    reason: input.reason || null,
    created_by: user.user?.id ?? null,
  });
  if (error) throw error;
}

export async function revokeDismissal(issueKey: string): Promise<void> {
  const { error } = await supabase
    .from("finance_issue_dismissals")
    .delete()
    .eq("issue_key", issueKey);
  if (error) throw error;
}
