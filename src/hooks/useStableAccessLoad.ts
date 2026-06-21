import { useEffect, useRef } from "react";
import type { AppRole } from "@/lib/rbac/permissions";

/**
 * Run `load` once per distinct userId+role after auth resolves.
 * Tab focus / token refresh must not re-fetch page lists.
 */
export function useStableAccessLoad(
  authChecking: boolean,
  userId: string | null,
  role: AppRole | null,
  load: () => void | Promise<void>,
) {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (authChecking || !userId) return;
    const key = `${userId}:${role ?? ""}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    void load();
  }, [authChecking, userId, role, load]);
}
