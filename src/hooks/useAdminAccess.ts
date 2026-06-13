import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/rbac/permissions";
import { isCrmUser } from "@/lib/rbac/permissions";

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

    const roleList = (roles || []).map((r) => r.role as AppRole);
    const isAdmin = roleList.includes("admin");
    const isUser = roleList.includes("user");
    const role: AppRole | null = isAdmin ? "admin" : isUser ? "user" : null;

    let implementerName: string | null = null;
    let displayName: string | null = null;

    if (role) {
      const { data: profile } = await supabase
        .from("team_profiles")
        .select("implementer_name,display_name")
        .eq("user_id", user.id)
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

    const applySession = async (session: { user: { id: string; email?: string | null } } | null) => {
      if (!active) return;
      const user = session?.user;

      if (!user) {
        setState({ ...initialState, authChecking: false });
        return;
      }

      setState((prev) => ({
        ...prev,
        authChecking: true,
        userEmail: user.email ?? "",
        userId: user.id,
      }));

      try {
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
          setState({
            authChecking: false,
            isAdmin: false,
            isUser: false,
            isCrmUser: false,
            role: null,
            userEmail: user.email ?? "",
            userId: user.id,
            implementerName: null,
            displayName: null,
          });
        }
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Session restore failed", error);
      void applySession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (!active) return;
        void applySession(session as { user: { id: string; email?: string | null } } | null);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAccess]);

  return state;
};
