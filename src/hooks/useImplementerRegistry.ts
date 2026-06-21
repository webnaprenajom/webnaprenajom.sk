import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CrmImplementerRow } from "@/lib/admin/implementerRegistry";

export function useImplementerRegistry(enabled = true) {
  const [rows, setRows] = useState<CrmImplementerRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [registryReady, setRegistryReady] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("crm_implementers")
      .select("name,active,created_at")
      .order("name");
    if (err) {
      setError(err.message);
      setRows([]);
      setRegistryReady(false);
    } else {
      setRows((data || []) as CrmImplementerRow[]);
      setRegistryReady(true);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const createName = useCallback(
    async (name: string) => {
      const { error: err } = await supabase.from("crm_implementers").insert({ name, active: true });
      if (err) throw err;
      await load();
    },
    [load],
  );

  const deactivateName = useCallback(
    async (name: string) => {
      const { error: err } = await supabase
        .from("crm_implementers")
        .update({ active: false })
        .eq("name", name);
      if (err) throw err;
      await load();
    },
    [load],
  );

  const reactivateName = useCallback(
    async (name: string) => {
      const { error: err } = await supabase
        .from("crm_implementers")
        .upsert({ name, active: true });
      if (err) throw err;
      await load();
    },
    [load],
  );

  const deleteName = useCallback(
    async (name: string) => {
      const { error: err } = await supabase.from("crm_implementers").delete().eq("name", name);
      if (err) throw err;
      await load();
    },
    [load],
  );

  const activeNames = rows.filter((r) => r.active).map((r) => r.name);

  return {
    rows,
    activeNames,
    loading,
    error,
    registryReady,
    reload: load,
    createName,
    deactivateName,
    reactivateName,
    deleteName,
  };
}
