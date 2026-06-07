import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminAccessState {
  authChecking: boolean;
  isAdmin: boolean;
  userEmail: string;
  userId: string | null;
}

const initialState: AdminAccessState = {
  authChecking: true,
  isAdmin: false,
  userEmail: "",
  userId: null,
};

export const useAdminAccess = () => {
  const [state, setState] = useState<AdminAccessState>(initialState);

  const resolveAdminAccess = useCallback(async (user: { id: string; email?: string | null }) => {
    // Direct table read (covered by RLS: users can view their own roles)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("[useAdminAccess] role table read failed", roleError);
    }

    return !!roleData;
  }, []);

  useEffect(() => {
    let active = true;

    const applySession = async (session: { user: { id: string; email?: string | null } } | null) => {
      if (!active) return;

      const user = session?.user;

      if (!user) {
        setState({
          authChecking: false,
          isAdmin: false,
          userEmail: "",
          userId: null,
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        authChecking: true,
        userEmail: user.email ?? "",
        userId: user.id,
      }));

      let admin = false;

      try {
        admin = await resolveAdminAccess(user);
      } catch (error) {
        console.error("[useAdminAccess] admin resolution failed", error);
      }

      if (!active) return;

      console.info("[useAdminAccess] resolved", {
        userId: user.id,
        email: user.email,
        isAdmin: admin,
      });

      setState({
        authChecking: false,
        isAdmin: admin,
        userEmail: user.email ?? "",
        userId: user.id,
      });
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Admin session restore failed", error);
      }

      void applySession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!active) return;
        void applySession(session as { user: { id: string; email?: string | null } } | null);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAdminAccess]);

  return state;
};