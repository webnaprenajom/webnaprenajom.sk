import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadCrmUserArchives } from "@/lib/admin/crmUserRemoval";
import {
  buildHistoricalIdentityContext,
  type HistoricalIdentityContext,
} from "@/lib/identity/historicalIdentity";

/** Loads archive + active implementer sets for historical role labels. */
export function useHistoricalIdentity(enabled = true) {
  const [historicalIdentity, setHistoricalIdentity] = useState<HistoricalIdentityContext | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setHistoricalIdentity(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [archives, registryRes, profilesRes] = await Promise.all([
        loadCrmUserArchives(),
        supabase.from("crm_implementers").select("name,active"),
        supabase.from("team_profiles").select("implementer_name,active").eq("active", true),
      ]);

      if (cancelled) return;

      const registryRows = registryRes.data || [];
      const registryNames = registryRows
        .filter((r) => r.active !== false)
        .map((r) => String(r.name ?? "").trim())
        .filter(Boolean);
      const inactiveRegistryNames = registryRows
        .filter((r) => r.active === false)
        .map((r) => String(r.name ?? "").trim())
        .filter(Boolean);
      const profileNames = (profilesRes.data || [])
        .map((p) => String(p.implementer_name ?? "").trim())
        .filter((n) => n && !n.includes("__off__"));

      setHistoricalIdentity(
        buildHistoricalIdentityContext({
          archives,
          activeImplementerNames: [...registryNames, ...profileNames],
          inactiveRegistryImplementerNames: inactiveRegistryNames,
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { historicalIdentity, loading };
}
