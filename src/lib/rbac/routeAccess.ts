/**
 * Route-level access rules (Batch RC6.5 / RC6.6).
 */

import type { AppRole } from "@/lib/rbac/permissions";
import { canAccessAdminDiagnostics, canAccessOperationalCrm, canAccessSettings } from "@/lib/rbac/permissions";

/** Paths that require admin role (operational CRM + diagnostics). */
const ADMIN_ONLY_PREFIXES = [
  "/admin",
  "/admin/today",
  "/admin/clients",
  "/admin/tasks",
  "/admin/projects",
  "/admin/rentals",
  "/admin/hosting",
  "/admin/logs",
  "/admin/signatures",
  "/admin/designs",
  "/admin/wheel-leads",
  "/admin/passwords",
  "/admin/notes",
  "/admin/customer",
  "/admin/customers",
  "/admin/communication-ops",
  "/admin/rollout-health",
  "/admin/commissions",
  "/admin/settings",
  "/admin/debug",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/admin") return pathname === "/admin";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function canAccessRoute(pathname: string, role: AppRole | null): boolean {
  if (role === "admin") return true;
  if (role !== "user") return false;
  if (matchesPrefix(pathname, "/admin/settings")) return false;
  if (matchesPrefix(pathname, "/admin/finance")) return true;
  return false;
}

export function redirectPathForRole(role: AppRole | null): string {
  if (role === "user") return "/admin/finance";
  return "/admin/today";
}

export function routeAccessDeniedMessage(pathname: string, role: AppRole | null): string {
  if (role === "user" && isAdminOnlyRoute(pathname)) {
    return "Táto sekcia je dostupná len pre administrátora. Vaše provízie nájdete vo Financiách.";
  }
  if (role === "user" && pathname.startsWith("/admin/settings")) {
    return "Nastavenia môže meniť len administrátor.";
  }
  if (canAccessAdminDiagnostics(role) === false && (pathname.includes("rollout-health") || pathname.includes("communication-ops"))) {
    return "Diagnostické nástroje sú len pre administrátora.";
  }
  return "Nemáte prístup k tejto sekcii.";
}

export { canAccessSettings, canAccessOperationalCrm, canAccessAdminDiagnostics };
