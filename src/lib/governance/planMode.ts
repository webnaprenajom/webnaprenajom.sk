/**
 * CRM governance — Plan Mode registry & lightweight guardrails.
 * @see GOVERNANCE.md at repo root (ownership, scoping, when Plan Mode is mandatory).
 *
 * ponytail: dev-only warn via VITE_PLAN_MODE=1; no runtime enforcement in production.
 */

export type CriticalDomainId =
  | "leads"
  | "customer_hub"
  | "finance"
  | "rentals"
  | "commissions"
  | "identity"
  | "rbac"
  | "destructive_delete";

export type SaferDomainId =
  | "tasks"
  | "today"
  | "wheel_leads"
  | "projects"
  | "hosting"
  | "designs"
  | "signatures"
  | "communication"
  | "rollout_health"
  | "clients"
  | "logs"
  | "passwords"
  | "settings"
  | "debug";

export type DomainId = CriticalDomainId | SaferDomainId;

export type CriticalDomain = {
  id: CriticalDomainId;
  label: string;
  /** Primary route(s) — not exhaustive for nested detail pages. */
  routes: string[];
  owner: string;
  revenueCritical: boolean;
};

/** Business-critical domains — Plan Mode required for multi-file or canonical changes. */
export const CRITICAL_DOMAINS: readonly CriticalDomain[] = [
  {
    id: "leads",
    label: "Leads pipeline",
    routes: ["/admin"],
    owner: "Maroš (owner) · future: operational CRM dev",
    revenueCritical: true,
  },
  {
    id: "customer_hub",
    label: "Customer Hub",
    routes: ["/admin/customer/:key"],
    owner: "Maroš · future: customer/identity dev",
    revenueCritical: true,
  },
  {
    id: "finance",
    label: "Finance (snapshot, records, reconciliation)",
    routes: ["/admin/finance"],
    owner: "Maroš · future: finance dev",
    revenueCritical: true,
  },
  {
    id: "rentals",
    label: "Rental websites & MRR",
    routes: ["/admin/rentals"],
    owner: "Maroš · future: rentals/revenue dev",
    revenueCritical: true,
  },
  {
    id: "commissions",
    label: "Commissions & expenses",
    routes: ["/admin/commissions"],
    owner: "Maroš · future: commissions dev",
    revenueCritical: true,
  },
  {
    id: "identity",
    label: "Customer identity (customers FK, crmLookup)",
    routes: [],
    owner: "Maroš · future: identity dev",
    revenueCritical: true,
  },
  {
    id: "rbac",
    label: "RBAC & route access",
    routes: [],
    owner: "Maroš only (security)",
    revenueCritical: true,
  },
  {
    id: "destructive_delete",
    label: "Destructive delete RPCs",
    routes: [],
    owner: "Maroš · future: platform dev",
    revenueCritical: true,
  },
] as const;

/** Canonical modules — change only in Plan Mode. Paths are repo-relative prefixes. */
export const CANONICAL_MODULE_PREFIXES = [
  "src/lib/finance/buildFinanceSnapshot.ts",
  "src/lib/finance/",
  "src/lib/profit/",
  "src/lib/customerWorkbench/loadCustomerHubAggregate.ts",
  "src/lib/customerWorkbench/",
  "src/lib/rbac/",
  "src/lib/crmLookup/customers.ts",
  "src/lib/crmLookup/resolveFormCustomerLink.ts",
  "src/lib/destructive/",
  "src/lib/audit/auditLog.ts",
  "src/components/admin/finance/TruthLevelBadge.tsx",
  "src/components/admin/finance/FinanceRecordsCrud.tsx",
  "src/components/admin/AdminDialog.tsx",
  "src/hooks/useAdminCloseGuard.tsx",
  "src/hooks/useUnsavedChangesGuard.ts",
  "src/hooks/useDestructiveAction.ts",
  "src/lib/crmPersistence/",
] as const;

/**
 * Pages with known inline `supabase.from()` — do not grow query surface without
 * extracting to `src/lib/**` loaders (Plan Mode + tests).
 */
export const INLINE_QUERY_PAGE_PREFIXES = [
  "src/pages/Admin.tsx",
  "src/pages/AdminFinance.tsx",
  "src/pages/AdminRentals.tsx",
  "src/pages/AdminCommissions.tsx",
  "src/pages/AdminTasks.tsx",
] as const;

/** DB tables that must not receive ad-hoc writes outside canonical modules / RPCs. */
export const PROTECTED_WRITE_TABLES = [
  "payment_records",
  "payout_records",
  "cost_records",
  "customers",
  "commission_rules",
  "commission_rule_overrides",
] as const;

export const PLAN_MODE_ENV_FLAG = "VITE_PLAN_MODE";

/** True when session explicitly opted into Plan Mode (local dev / agent). */
export function isPlanModeSession(): boolean {
  return import.meta.env[PLAN_MODE_ENV_FLAG] === "1";
}

export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isCanonicalModulePath(path: string): boolean {
  const p = normalizeRepoPath(path);
  return CANONICAL_MODULE_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? p.startsWith(prefix) : p === prefix || p.startsWith(prefix.replace(/\.ts$/, "")),
  );
}

export function isInlineQueryPagePath(path: string): boolean {
  const p = normalizeRepoPath(path);
  return INLINE_QUERY_PAGE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

export type PlanModeScopeResult = {
  requiresPlanMode: boolean;
  reasons: string[];
};

/**
 * Heuristic: should this changeset require Plan Mode before merge?
 * Used by agents/devs — not CI enforcement (yet).
 */
export function evaluatePlanModeScope(changedFiles: string[]): PlanModeScopeResult {
  const reasons: string[] = [];
  const normalized = changedFiles.map(normalizeRepoPath);
  const canonicalHits = normalized.filter(isCanonicalModulePath);
  const inlinePageHits = normalized.filter(isInlineQueryPagePath);

  if (canonicalHits.length > 0) {
    reasons.push(`canonical module(s): ${canonicalHits.slice(0, 3).join(", ")}${canonicalHits.length > 3 ? "…" : ""}`);
  }

  const domainFileCounts = new Map<string, number>();
  for (const f of normalized) {
    if (f.startsWith("src/pages/AdminFinance") || f.includes("/finance/")) domainFileCounts.set("finance", (domainFileCounts.get("finance") ?? 0) + 1);
    if (f.startsWith("src/pages/AdminRentals") || f.includes("/rentals/")) domainFileCounts.set("rentals", (domainFileCounts.get("rentals") ?? 0) + 1);
    if (f.startsWith("src/pages/Admin.tsx") || f.includes("/leads/")) domainFileCounts.set("leads", (domainFileCounts.get("leads") ?? 0) + 1);
    if (f.startsWith("src/pages/AdminCustomer") || f.includes("customerWorkbench")) domainFileCounts.set("customer_hub", (domainFileCounts.get("customer_hub") ?? 0) + 1);
    if (f.startsWith("src/pages/AdminCommissions") || f.includes("/commissions/")) domainFileCounts.set("commissions", (domainFileCounts.get("commissions") ?? 0) + 1);
  }

  for (const [domain, count] of domainFileCounts) {
    if (count >= 3) reasons.push(`3+ files in domain "${domain}"`);
  }

  if (normalized.some((f) => f.includes("supabase/migrations/"))) {
    reasons.push("database migration");
  }

  if (inlinePageHits.length > 0 && normalized.length >= 2) {
    reasons.push(`inline-query page(s) touched: ${inlinePageHits.join(", ")}`);
  }

  return { requiresPlanMode: reasons.length > 0, reasons };
}

/**
 * Dev-only soft stop when editing critical areas outside Plan Mode.
 * Set VITE_PLAN_MODE=1 in .env.local when executing an approved plan.
 */
export function assertPlanModeAcknowledged(context: string): void {
  if (!import.meta.env.DEV) return;
  if (isPlanModeSession()) return;
  console.warn(
    `[governance] ${context}: critical area — use Plan Mode (see GOVERNANCE.md). ` +
      `Set ${PLAN_MODE_ENV_FLAG}=1 when intentional.`,
  );
}

/** Standard file header for canonical modules (copy into new critical files). */
export const GOVERNANCE_FILE_BANNER =
  "CRITICAL: change only in Plan Mode — see GOVERNANCE.md and CLAUDE.md hard constraints.";
