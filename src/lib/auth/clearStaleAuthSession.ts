import { supabase } from "@/integrations/supabase/client";

/** Drop orphaned local JWT after remote auth reset (getSession ≠ getUser). */
export async function clearStaleAuthSession(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return false;

  const { data: userData, error } = await supabase.auth.getUser();
  if (!error && userData.user) return false;

  await supabase.auth.signOut();
  return true;
}
