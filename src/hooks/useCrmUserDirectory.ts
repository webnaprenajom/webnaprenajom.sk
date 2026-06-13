import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CRM_ASSIGNEES } from "@/lib/assignees";
import {
  buildCrmManagedUsers,
  type AuthDirectoryRow,
  type CrmManagedUser,
} from "@/lib/admin/crmUserDirectory";

type RpcAuthRow = {
  user_id: string;
  email: string;
  auth_display_name: string | null;
  created_at: string;
};

export function useCrmUserDirectory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<CrmManagedUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [dirRes, rolesRes, profilesRes] = await Promise.all([
      supabase.rpc("admin_list_auth_users"),
      supabase.from("user_roles").select("id,user_id,role").order("created_at"),
      supabase.from("team_profiles").select("user_id,display_name,implementer_name,active"),
    ]);

    if (dirRes.error) {
      setError(dirRes.error.message);
      setLoading(false);
      return;
    }

    const directory: AuthDirectoryRow[] = ((dirRes.data || []) as RpcAuthRow[]).map((r) => ({
      userId: r.user_id,
      email: r.email,
      authDisplayName: r.auth_display_name,
      createdAt: r.created_at,
    }));

    const managed = buildCrmManagedUsers(
      directory,
      (rolesRes.data || []) as Array<{ id: string; user_id: string; role: "admin" | "user" }>,
      (profilesRes.data || []) as Array<{
        user_id: string;
        display_name: string;
        implementer_name: string;
        active: boolean;
      }>,
      CRM_ASSIGNEES,
    );

    setUsers(managed);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withRole = users.filter((u) => u.role);
  const withoutRole = users.filter((u) => !u.role);

  return { loading, error, users, withRole, withoutRole, reload: load };
}
