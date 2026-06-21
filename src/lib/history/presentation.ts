import type { AppRole } from "@/lib/rbac/permissions";
import { isAdministrator, isOwner } from "@/lib/rbac/permissions";

export type HistoryLoadState = "loading" | "ok" | "empty" | "error" | "no_access";

export function resolveHistoryLoadState(opts: {
  loading: boolean;
  error: string | null;
  rowCount: number;
  role: AppRole | null;
}): HistoryLoadState {
  if (opts.loading) return "loading";
  if (opts.error && opts.rowCount === 0) {
    const m = opts.error.toLowerCase();
    if (m.includes("permission") || m.includes("row-level") || m.includes("42501")) {
      return "no_access";
    }
    return "error";
  }
  if (opts.rowCount === 0 && !opts.error) return "empty";
  return "ok";
}

export function historyScopeDescription(role: AppRole | null, auditIncluded: boolean): string {
  if (isOwner(role)) {
    const audit = auditIncluded
      ? "Zahŕňa lead_logs (automatické zmeny leadov) a admin_audit_log (admin akcie, mazania, financie, nastavenia)."
      : "Zahŕňa lead_logs. Admin audit sa nepodarilo načítať.";
    return `${audit} Export = aktuálne filtrovaný zoznam (max. 1000 načítaných záznamov na zdroj).`;
  }
  if (isAdministrator(role)) {
    return "Zobrazujú sa logy leadov priradených vášmu menu realizátora. Globálny admin audit je len pre ownera.";
  }
  return "História CRM je dostupná len pre oprávnených používateľov.";
}

export function historyEmptyMessage(role: AppRole | null, filtered: boolean): string {
  if (filtered) return "Žiadna zhoda pre filter.";
  if (isOwner(role)) return "Zatiaľ žiadne záznamy v histórii CRM.";
  if (isAdministrator(role)) {
    return "Žiadne logy pre vaše priradené leady — skontrolujte team profile a priradenie „Kto rieši“.";
  }
  return "Žiadne záznamy.";
}

export function historyNoAccessMessage(role: AppRole | null): string {
  if (isAdministrator(role)) {
    return "Nemáte oprávnenie na globálnu históriu. Ak máte team profile, uvidíte len logy priradených leadov.";
  }
  return "Nemáte oprávnenie čítať históriu CRM.";
}
