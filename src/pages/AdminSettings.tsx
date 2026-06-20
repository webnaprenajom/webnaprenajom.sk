import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { EmailAccountSettings } from "@/components/admin/settings/EmailAccountSettings";
import { UserManagementPanel } from "@/components/admin/settings/UserManagementPanel";
import { OwnerPasswordChangePanel } from "@/components/admin/settings/OwnerPasswordChangePanel";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { canAccessSettings } from "@/lib/rbac/permissions";
import { Badge } from "@/components/ui/badge";
import { TeamSetupDiagnostics } from "@/components/admin/settings/TeamSetupDiagnostics";
import { TeamProfileNotice } from "@/components/admin/rbac/TeamProfileNotice";
import { AccessReviewPanel } from "@/components/admin/settings/AccessReviewPanel";
import { AuditLogPanel } from "@/components/admin/settings/AuditLogPanel";

const settingsSectionClass = "rounded-xl border border-border bg-card p-3 space-y-2.5";

export default function AdminSettings() {
  const access = useAdminAccess();

  if (!access.authChecking && access.userId && !canAccessSettings(access.role)) {
    return <Navigate to="/admin/finance" replace />;
  }

  return (
    <AdminShell
      title="Nastavenia"
      subtitle={
        access.isAdmin
          ? "Účet, tím, e-mail a vzhľad"
          : "Účet a vzhľad — správa tímu len pre admina"
      }
    >
      <div className="max-w-5xl space-y-4">
        <TeamProfileNotice />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className={settingsSectionClass}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Účet</h2>
              {access.role && (
                <Badge variant="outline" className="text-[10px]">
                  {access.role}
                  {access.implementerName ? ` · ${access.implementerName}` : ""}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{access.userEmail}</p>
            {access.displayName && (
              <p className="text-xs text-muted-foreground">Profil: {access.displayName}</p>
            )}
            {access.userEmail && <OwnerPasswordChangePanel email={access.userEmail} />}
          </section>

          <section className={settingsSectionClass}>
            <h2 className="text-sm font-semibold">Vzhľad</h2>
            <p className="text-xs text-muted-foreground">Prepínač svetlého / tmavého režimu</p>
            <AdminThemeToggle />
          </section>
        </div>

        {access.userId && (
          <section className={settingsSectionClass}>
            <h2 className="text-sm font-semibold">E-mail a synchronizácia</h2>
            <EmailAccountSettings userId={access.userId} />
          </section>
        )}

        {access.isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={settingsSectionClass}>
              <h2 className="text-sm font-semibold">Kontrola prístupov</h2>
              <p className="text-xs text-muted-foreground">
                Prehľad účtov, rolí a team profile mapovania — vhodné pred auditom alebo onboardingom.
              </p>
              <AccessReviewPanel />
            </section>

            <section className={settingsSectionClass}>
              <h2 className="text-sm font-semibold">Auditný denník</h2>
              <p className="text-xs text-muted-foreground">
                Posledné citlivé admin akcie (role, profily, provízie).
              </p>
              <AuditLogPanel />
            </section>
          </div>
        )}

        {access.isAdmin && (
          <section className={settingsSectionClass}>
            <h2 className="text-sm font-semibold">Diagnostika tímu a provízií</h2>
            <p className="text-xs text-muted-foreground">Len pre admina — soft kontroly kvality nastavenia.</p>
            <TeamSetupDiagnostics />
          </section>
        )}

        {access.isAdmin && (
          <section className={settingsSectionClass}>
            <h2 className="text-sm font-semibold">Správa používateľov</h2>
            <UserManagementPanel />
          </section>
        )}
      </div>
    </AdminShell>
  );
}
