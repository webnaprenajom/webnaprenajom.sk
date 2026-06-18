import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAccessContext } from "@/hooks/useAccessContext";
import { isAdministrator, isCrmUser } from "@/lib/rbac/permissions";
import { canAccessRoute, redirectPathForRole, routeAccessDeniedMessage } from "@/lib/rbac/routeAccess";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { useNavigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
  /** @deprecated Router-level ProtectedAdminOutlet preferred */
  requireOperational?: boolean;
  redirectInstead?: boolean;
}

/** Optional per-page guard — primary enforcement is ProtectedAdminOutlet in App.tsx. */
export function AdminOnlyGate({ children, redirectInstead = false }: Props) {
  const { pathname } = useLocation();
  const ctx = useAccessContext();
  const navigate = useNavigate();

  if (ctx.authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!isCrmUser(ctx.role)) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Nemáte prístup</h1>
          <Button onClick={() => confirmAdminSignOut(navigate)} variant="outline">
            Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  if (!canAccessRoute(pathname, ctx.role)) {
    if (redirectInstead && isAdministrator(ctx.role)) {
      return <Navigate to={redirectPathForRole(ctx.role)} replace />;
    }
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Prístup obmedzený</h1>
          <p className="text-sm text-muted-foreground">{routeAccessDeniedMessage(pathname, ctx.role)}</p>
          {isAdministrator(ctx.role) && (
            <Button onClick={() => navigate("/admin/today")} variant="default">
              Prejsť na CRM
            </Button>
          )}
          <Button onClick={() => confirmAdminSignOut(navigate)} variant="outline">
            Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
