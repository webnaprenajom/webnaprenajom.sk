import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CRM_ASSIGNEES } from "@/lib/assignees";
import {
  buildCrmManagedUsers,
  archivedUserIdsFromRows,
  type AuthDirectoryRow,
  type CrmManagedUser,
} from "@/lib/admin/crmUserDirectory";
import { loadCrmUserArchives } from "@/lib/admin/crmUserRemoval";
import {
  buildHistoricalIdentityContext,
  type CrmUserArchiveRow,
  type HistoricalIdentityContext,
} from "@/lib/identity/historicalIdentity";

type RpcAuthRow = {
  user_id: string;
  email: string;
  auth_display_name: string | null;
  created_at: string;
};

type UseCrmUserDirectoryOptions = {
  /** When false, skips RPC/load (e.g. non-owner sidebar badge). Default true. */
  enabled?: boolean;
};

export function useCrmUserDirectory(options: UseCrmUserDirectoryOptions = {}) {
  const enabled = options.enabled !== false;
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<CrmManagedUser[]>([]);
  const [archives, setArchives] = useState<CrmUserArchiveRow[]>([]);
  const [historicalIdentity, setHistoricalIdentity] = useState<HistoricalIdentityContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [dirRes, rolesRes, profilesRes, registryRes, archiveRows] = await Promise.all([
      supabase.rpc("admin_list_auth_users"),
      supabase.from("user_roles").select("id,user_id,role").order("created_at"),
      supabase.from("team_profiles").select("user_id,display_name,implementer_name,active"),
      supabase.from("crm_implementers").select("name,active"),
      loadCrmUserArchives(),
    ]);

    if (dirRes.error) {
      setError(dirRes.error.message);
      setLoading(false);
      return;
    }

    const registryLoaded = !registryRes.error;
    const registryNames = (registryRes.data || [])
      .filter((r) => r.active !== false)
      .map((r) => String(r.name ?? "").trim())
      .filter(Boolean);

    const directory: AuthDirectoryRow[] = ((dirRes.data || []) as RpcAuthRow[]).map((r) => ({
      userId: r.user_id,
      email: r.email,
      authDisplayName: r.auth_display_name,
      createdAt: r.created_at,
    }));

    const standardList = registryLoaded ? registryNames : [...CRM_ASSIGNEES];
    const archivedIds = archivedUserIdsFromRows(archiveRows);

    const managed = buildCrmManagedUsers(
      directory,
      (rolesRes.data || []) as Array<{ id: string; user_id: string; role: string }>,
      (profilesRes.data || []) as Array<{
        user_id: string;
        display_name: string;
        implementer_name: string;
        active: boolean;
      }>,
      standardList,
      archivedIds,
    );

    const activeImplementerNames = managed
      .filter((u) => u.profileActive && u.implementerName)
      .map((u) => u.implementerName as string);

    setArchives(archiveRows);
    setHistoricalIdentity(
      buildHistoricalIdentityContext({
        archives: archiveRows,
        activeImplementerNames: [...activeImplementerNames, ...registryNames],
      }),
    );
    setUsers(managed);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setUsers([]);
      return;
    }
    void load();
  }, [load, enabled]);

  const withRole = users.filter((u) => u.role);
  const withoutRole = users.filter((u) => !u.role);

  return {
    loading,
    error,
    users,
    withRole,
    withoutRole,
    archives,
    historicalIdentity,
    reload: load,
  };
}
