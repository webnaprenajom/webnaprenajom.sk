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
  /** Tailwind text color class for icon tint */
  iconColor?: string;
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
      { href: "/admin/today", label: "Dnes", icon: Sun, iconColor: "text-amber-500" },
      { href: "/admin", label: "Leady", icon: Users, exact: true, iconColor: "text-sky-500" },
      { href: "/admin/clients", label: "Klienti", icon: UserRound, iconColor: "text-indigo-500" },
      { href: "/admin/tasks", label: "Úlohy", icon: ListTodo, iconColor: "text-orange-500" },
    ],
  },
  {
    id: "dodavky",
    label: "Dodávky",
    items: [
      { href: "/admin/projects", label: "Projekty", icon: FolderKanban, iconColor: "text-violet-500" },
      { href: "/admin/rentals", label: "Prenájmy", icon: Wallet, iconColor: "text-emerald-500" },
      { href: "/admin/hosting", label: "Hosting", icon: Server, iconColor: "text-cyan-500" },
    ],
  },
  {
    id: "finance",
    items: [{ href: "/admin/finance", label: "Financie", icon: BarChart3, iconColor: "text-green-500" }],
  },
  {
    id: "nastroje",
    label: "Nástroje",
    items: [
      { href: "/admin/signatures", label: "Podpisy", icon: FileSignature, iconColor: "text-rose-500" },
      { href: "/admin/designs", label: "Dizajny", icon: Palette, iconColor: "text-pink-500" },
      { href: "/admin/wheel-leads", label: "Koleso", icon: Sparkles, iconColor: "text-yellow-500" },
      { href: "/admin/logs", label: "História", icon: History, iconColor: "text-slate-500" },
      { href: "/admin/rollout-health", label: "Stav CRM", icon: ClipboardList, devOnly: true, iconColor: "text-teal-500" },
      { href: "/admin/communication-ops", label: "Komunikácia", icon: Inbox, devOnly: true, iconColor: "text-blue-500" },
      { href: "/admin/passwords", label: "Heslá", icon: KeyRound, iconColor: "text-fuchsia-500" },
    ],
  },
  {
    id: "nastavenia",
    label: "Nastavenia",
    items: [{ href: "/admin/settings", label: "Nastavenia", icon: Settings, iconColor: "text-zinc-500" }],
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
