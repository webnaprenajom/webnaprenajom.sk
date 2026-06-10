import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Lightweight confirm before admin logout. */
export async function confirmAdminSignOut(navigate: NavigateFunction): Promise<void> {
  if (!confirm("Naozaj sa chcete odhlásiť?")) return;
  await supabase.auth.signOut();
  navigate("/auth", { replace: true });
}
