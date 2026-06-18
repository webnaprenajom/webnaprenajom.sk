import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAccessContext } from "@/hooks/useAccessContext";
import { isAdministrator, isCrmUser } from "@/lib/rbac/permissions";
import { canAccessRoute, redirectPathForRole, routeAccessDeniedMessage } from "@/lib/rbac/routeAccess";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { useNavigate } from "react-router-dom";

/**
 * Single route-level guard for all /admin/* routes (RC6.6).
 * Deep links cannot bypass — checks pathname against shared routeAccess rules.
 */
export function ProtectedAdminOutlet() {
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

  if (!ctx.userId) {
    return <Navigate to="/auth" replace state={{ from: pathname }} />;
  }

  if (!isCrmUser(ctx.role)) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Nemáte prístup</h1>
          <p className="text-sm text-muted-foreground">
            Váš účet nemá rolu owner ani administrator. Kontaktujte správcu CRM.
          </p>
          <Button onClick={() => confirmAdminSignOut(navigate)} variant="outline">
            Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  if (!canAccessRoute(pathname, ctx.role)) {
    if (isAdministrator(ctx.role)) {
      return <Navigate to={redirectPathForRole(ctx.role)} replace />;
    }
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Prístup obmedzený</h1>
          <p className="text-sm text-muted-foreground">{routeAccessDeniedMessage(pathname, ctx.role)}</p>
          <Button onClick={() => confirmAdminSignOut(navigate)} variant="outline">
            Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return <Outlet />;
}
