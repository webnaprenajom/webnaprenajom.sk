import type { AppRole } from "@/lib/rbac/permissions";
import { isAdministrator, isOwner } from "@/lib/rbac/permissions";

export type LeadLogsLoadState = "loading" | "ok" | "empty" | "error" | "no_access";

export function isLeadLogsPermissionError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("permission") || m.includes("row-level") || m.includes("42501");
}

export function resolveLeadLogsLoadState(opts: {
  loading: boolean;
  error: string | null;
  rowCount: number;
  role: AppRole | null;
}): LeadLogsLoadState {
  if (opts.loading) return "loading";
  if (opts.error) {
    return isLeadLogsPermissionError(opts.error) ? "no_access" : "error";
  }
  if (opts.rowCount === 0) return "empty";
  return "ok";
}

export function leadLogsScopeDescription(role: AppRole | null): string {
  if (isOwner(role)) {
    return "Zdroj: tabuľka lead_logs — zmeny leadov (status, typ, priradenie, poznámky), notifikácie a koleso. Nezahŕňa projekty, financie, hosting ani admin_audit_log zo Settings. Export = aktuálne filtrovaný zoznam (max. 1000 načítaných záznamov).";
  }
  if (isAdministrator(role)) {
    return "Zobrazujú sa logy len pre leady priradené vášmu menu realizátora (team profile). Ostatné záznamy nie sú viditeľné.";
  }
  return "História leadov je dostupná len pre CRM používateľov s oprávnením.";
}

export function leadLogsEmptyMessage(role: AppRole | null, filtered: boolean): string {
  if (filtered) return "Žiadna zhoda pre filter.";
  if (isOwner(role)) return "Zatiaľ žiadne záznamy v histórii leadov.";
  if (isAdministrator(role)) {
    return "Žiadne logy pre vaše priradené leady — skontrolujte team profile a priradenie „Kto rieši“.";
  }
  return "Žiadne logy.";
}

export function leadLogsNoAccessMessage(role: AppRole | null): string {
  if (isAdministrator(role)) {
    return "Nemáte oprávnenie na globálnu históriu. Ak máte team profile, uvidíte len logy priradených leadov.";
  }
  return "Nemáte oprávnenie čítať históriu leadov.";
}
