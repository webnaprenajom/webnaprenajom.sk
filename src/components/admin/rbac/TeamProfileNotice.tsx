import { AlertTriangle } from "lucide-react";
import { useAccessContext } from "@/hooks/useAccessContext";
import { userMissingTeamProfile } from "@/lib/rbac/permissions";

/** Shown to role=user when team_profiles mapping is missing (RC6.5). */
export function TeamProfileNotice() {
  const ctx = useAccessContext();
  if (ctx.authChecking || !userMissingTeamProfile(ctx)) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex gap-3 text-sm">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          Váš účet nie je prepojený s realizátorom
        </p>
        <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
          Provízie a financie sa zobrazujú podľa mena realizátora v team profile. Požiadajte administrátora o
          doplnenie v Nastaveniach → Správa používateľov.
        </p>
      </div>
    </div>
  );
}
