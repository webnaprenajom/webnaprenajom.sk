import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FileSignature,
  FolderKanban,
  History,
  Inbox,
  KeyRound,
  ListTodo,
  Palette,
  Server,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exact match only (e.g. /admin pipeline) */
  exact?: boolean;
  /** Hidden from default sidebar — route remains accessible (internal/dev tools). */
  devOnly?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label?: string;
  items: AdminNavItem[];
};

/** Single source of truth for CRM admin sidebar navigation. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "operativa",
    items: [
      { href: "/admin/today", label: "Dnes", icon: Sun },
      { href: "/admin", label: "Leady", icon: Users, exact: true },
      { href: "/admin/clients", label: "Klienti", icon: UserRound },
      { href: "/admin/tasks", label: "Úlohy", icon: ListTodo },
    ],
  },
  {
    id: "dodavky",
    label: "Dodávky",
    items: [
      { href: "/admin/projects", label: "Projekty", icon: FolderKanban },
      { href: "/admin/rentals", label: "Prenájmy", icon: Wallet },
      { href: "/admin/hosting", label: "Hosting", icon: Server },
    ],
  },
  {
    id: "finance",
    items: [{ href: "/admin/finance", label: "Financie", icon: BarChart3 }],
  },
  {
    id: "nastroje",
    label: "Nástroje",
    items: [
      { href: "/admin/signatures", label: "Podpisy", icon: FileSignature },
      { href: "/admin/designs", label: "Dizajny", icon: Palette },
      { href: "/admin/wheel-leads", label: "Koleso", icon: Sparkles },
      { href: "/admin/logs", label: "História", icon: History },
      { href: "/admin/rollout-health", label: "Stav CRM", icon: ClipboardList, devOnly: true },
      { href: "/admin/communication-ops", label: "Komunikácia", icon: Inbox, devOnly: true },
      { href: "/admin/passwords", label: "Heslá", icon: KeyRound },
    ],
  },
  {
    id: "nastavenia",
    label: "Nastavenia",
    items: [{ href: "/admin/settings", label: "Nastavenia", icon: Settings }],
  },
];

/** Nav groups visible in production sidebar (excludes devOnly items). */
export function visibleAdminNavGroups(): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.devOnly),
  })).filter((group) => group.items.length > 0);
}

export function isAdminNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === "/admin" || exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
