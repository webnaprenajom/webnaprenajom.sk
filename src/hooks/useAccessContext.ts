import { useMemo } from "react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { accessContextFromState, type AccessContext } from "@/lib/rbac/permissions";

/** Shared AccessContext for RBAC helpers — single source from session. */
export function useAccessContext(): AccessContext & {
  authChecking: boolean;
  isAdmin: boolean;
  isUser: boolean;
  userId: string | null;
} {
  const access = useAdminAccess();
  return useMemo(
    () => ({
      ...accessContextFromState(access),
      authChecking: access.authChecking,
      isAdmin: access.isAdmin,
      isUser: access.isUser,
      userId: access.userId,
    }),
    [
      access.authChecking,
      access.role,
      access.userId,
      access.implementerName,
      access.isAdmin,
      access.isUser,
    ],
  );
}
