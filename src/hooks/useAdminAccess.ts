import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/rbac/permissions";
import { isCrmUser, resolveAppRoleFromRows } from "@/lib/rbac/permissions";

/** Server-side role check when user_roles SELECT is empty (RLS/timing). */
async function resolveAppRoleViaRpc(userId: string): Promise<AppRole | null> {
  // ponytail: is_crm_* RPCs exist in DB but are not in generated Database types yet
  const rpc = supabase.rpc.bind(supabase) as (
    fn: string,
    args?: Record<string, unknown>,
  ) => ReturnType<typeof supabase.rpc>;

  const [ownerRes, adminRes] = await Promise.all([
    rpc("is_crm_owner", { _user_id: userId }),
    rpc("is_crm_administrator", { _user_id: userId }),
  ]);

  if (ownerRes.error) {
    console.error("[useAdminAccess] is_crm_owner RPC failed", ownerRes.error);
  }
  if (adminRes.error) {
    console.error("[useAdminAccess] is_crm_administrator RPC failed", adminRes.error);
  }

  if (ownerRes.data === true) return "owner";
  if (adminRes.data === true) return "administrator";
  return null;
}

export interface AppAccessState {
  authChecking: boolean;
  isAdmin: boolean;
  isUser: boolean;
  isCrmUser: boolean;
  role: AppRole | null;
  userEmail: string;
  userId: string | null;
  implementerName: string | null;
  displayName: string | null;
}

const initialState: AppAccessState = {
  authChecking: true,
  isAdmin: false,
  isUser: false,
  isCrmUser: false,
  role: null,
  userEmail: "",
  userId: null,
  implementerName: null,
  displayName: null,
};

export const useAdminAccess = (): AppAccessState => {
  const [state, setState] = useState<AppAccessState>(initialState);

  const resolveAccess = useCallback(async (user: { id: string; email?: string | null }) => {
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("[useAdminAccess] role read failed", roleError);
    }

    const roleList = (roles || []).map((r) => r.role as string);
    let role = resolveAppRoleFromRows(roleList);
    if (!role) {
      role = await resolveAppRoleViaRpc(user.id);
    }
    const isAdmin = role === "owner";
    const isUser = role === "administrator";

    let implementerName: string | null = null;
    let displayName: string | null = null;

    if (role) {
      const { data: profile } = await supabase
        .from("team_profiles")
        .select("implementer_name,display_name,active")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (profile) {
        implementerName = profile.implementer_name;
        displayName = profile.display_name;
      }
    }

    return { isAdmin, isUser, role, implementerName, displayName };
  }, []);

  useEffect(() => {
    let active = true;

    const refreshAccess = async () => {
      if (!active) return;

      setState((prev) => ({ ...prev, authChecking: true }));

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[useAdminAccess] getUser failed", userError);
        }

        if (!user) {
          setState({ ...initialState, authChecking: false });
          return;
        }

        const access = await resolveAccess(user);
        if (!active) return;
        setState({
          authChecking: false,
          isAdmin: access.isAdmin,
          isUser: access.isUser,
          isCrmUser: isCrmUser(access.role),
          role: access.role,
          userEmail: user.email ?? "",
          userId: user.id,
          implementerName: access.implementerName,
          displayName: access.displayName,
        });
      } catch (error) {
        console.error("[useAdminAccess] resolution failed", error);
        if (active) {
          setState((prev) => ({
            ...prev,
            authChecking: false,
            isAdmin: false,
            isUser: false,
            isCrmUser: false,
            role: null,
            implementerName: null,
            displayName: null,
          }));
        }
      }
    };

    void refreshAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (active) setState({ ...initialState, authChecking: false });
        return;
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          if (!active) return;
          void refreshAccess();
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAccess]);

  return state;
};
