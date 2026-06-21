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
import type { ReactNode } from "react";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "muted" | "admin";
};

function SettingsSection({ title, description, children, tone = "default" }: SettingsSectionProps) {
  const toneClass =
    tone === "muted"
      ? "border-border/60 bg-muted/15"
      : tone === "admin"
        ? "border-primary/15 bg-card"
        : "border-border bg-card";

  return (
    <section className={`rounded-lg border ${toneClass} p-4 space-y-3`}>
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground leading-snug">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

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
          ? "Účet, tím a prístupy"
          : "Účet a vzhľad — správa tímu len pre ownera"
      }
    >
      <div className="max-w-4xl space-y-5">
        <TeamProfileNotice />

        <SettingsSection title="Môj účet" description="Prihlásený profil a heslo.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Identita</p>
                {access.role && (
                  <Badge variant="outline" className="text-[10px]">
                    {access.role}
                    {access.implementerName ? ` · ${access.implementerName}` : ""}
                  </Badge>
                )}
              </div>
              <p className="text-sm">{access.userEmail}</p>
              {access.displayName && (
                <p className="text-xs text-muted-foreground">{access.displayName}</p>
              )}
              {access.userEmail && <OwnerPasswordChangePanel email={access.userEmail} />}
            </div>
            <div className="space-y-2 sm:border-l sm:border-border/60 sm:pl-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vzhľad</p>
              <AdminThemeToggle />
            </div>
          </div>
        </SettingsSection>

        {access.userId && (
          <SettingsSection title="E-mail a synchronizácia" tone="muted">
            <EmailAccountSettings userId={access.userId} />
          </SettingsSection>
        )}

        {access.isAdmin && (
          <>
            <div className="space-y-1 pt-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tím a prístupy
              </h2>
              <p className="text-xs text-muted-foreground">
                Role, realizátori a mapovanie na provízie. Zmeny sa zapisujú do Histórie CRM.
              </p>
            </div>

            <SettingsSection
              title="Kontrola prístupov"
              description="Rýchly prehľad pred onboardingom alebo auditom."
              tone="admin"
            >
              <AccessReviewPanel />
            </SettingsSection>

            <SettingsSection
              title="Používatelia, role a realizátori"
              description="Správa CRM účtov, team profilov a katalógu mien realizátorov."
              tone="admin"
            >
              <UserManagementPanel />
            </SettingsSection>

            <SettingsSection
              title="Diagnostika nastavenia"
              description="Soft kontroly — neblokujú prevádzku."
              tone="muted"
            >
              <TeamSetupDiagnostics />
            </SettingsSection>
          </>
        )}
      </div>
    </AdminShell>
  );
}
