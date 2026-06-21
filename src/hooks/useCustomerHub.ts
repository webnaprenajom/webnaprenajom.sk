import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCustomerHubAggregate } from "@/lib/customerWorkbench/loadCustomerHubAggregate";
import type { LoadCustomerWorkbenchInput } from "@/lib/customerWorkbench/loadCustomerWorkbench";
import type { CustomerHubAggregate } from "@/lib/customerWorkbench/types";
import { loadCustomerWorkbench } from "@/lib/customerWorkbench/loadCustomerWorkbench";

export function useCustomerHub(input: LoadCustomerWorkbenchInput | null, enabled = true) {
  const [aggregate, setAggregate] = useState<CustomerHubAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !input?.routeValue) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const background = hasLoadedOnceRef.current;

    const load = async () => {
      if (!background) setLoading(true);
      try {
        const result = await loadCustomerHubAggregate(input);
        if (!cancelled) {
          setAggregate(result);
          hasLoadedOnceRef.current = true;
        }
      } finally {
        if (!cancelled && !background) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [input?.routeMode, input?.routeValue, enabled, reloadToken]);

  const sectionErrors = useMemo(() => {
    if (!aggregate) return {} as Record<string, string | null>;
    const out: Record<string, string | null> = {};
    Object.entries(aggregate.sections).forEach(([key, section]) => {
      out[key] = section.error;
    });
    return out;
  }, [aggregate]);

  return {
    aggregate,
    data: aggregate?.workbench ?? null,
    loading,
    reload,
    sectionErrors,
  };
}

/** Re-export for callers that only need workbench data. */
export { loadCustomerWorkbench };
