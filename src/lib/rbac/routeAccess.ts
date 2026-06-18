/**
 * Route-level access rules (Batch RC6.5 / RC6.6 / Phase 4a).
 */

import type { AppRole } from "@/lib/rbac/permissions";
import {
  canAccessAdminDiagnostics,
  canAccessOperationalCrm,
  canAccessSettings,
  isAdministrator,
  isOwner,
} from "@/lib/rbac/permissions";

/** Paths that require owner role (operational CRM + diagnostics). */
const ADMIN_ONLY_PREFIXES = [
  "/admin",
  "/admin/today",
  "/admin/clients",
  "/admin/tasks",
  "/admin/projects",
  "/admin/rentals",
  "/admin/hosting",
  "/admin/marketing",
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

function isDiagnosticsRoute(pathname: string): boolean {
  return (
    pathname.includes("rollout-health") ||
    pathname.includes("communication-ops") ||
    matchesPrefix(pathname, "/admin/debug")
  );
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function canAccessRoute(pathname: string, role: AppRole | null): boolean {
  if (isOwner(role)) return true;
  if (!isAdministrator(role)) return false;
  if (!canAccessOperationalCrm(role)) return false;
  if (matchesPrefix(pathname, "/admin/settings")) return false;
  if (!canAccessAdminDiagnostics(role) && isDiagnosticsRoute(pathname)) return false;
  return pathname.startsWith("/admin");
}

export function redirectPathForRole(role: AppRole | null): string {
  if (isAdministrator(role)) return "/admin/today";
  return "/admin/today";
}

export function routeAccessDeniedMessage(pathname: string, role: AppRole | null): string {
  if (isAdministrator(role) && matchesPrefix(pathname, "/admin/settings")) {
    return "Nastavenia môže meniť len owner.";
  }
  if (isAdministrator(role) && isDiagnosticsRoute(pathname)) {
    return "Diagnostické nástroje sú len pre ownera.";
  }
  if (isAdministrator(role) && !canAccessRoute(pathname, role)) {
    return "Nemáte prístup k tejto sekcii.";
  }
  return "Nemáte prístup k tejto sekcii.";
}

export { canAccessSettings, canAccessOperationalCrm, canAccessAdminDiagnostics };
