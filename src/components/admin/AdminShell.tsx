import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  FileSignature,
  History,
  KanbanSquare,
  ListTodo,
  Loader2,
  LogOut,
  Menu,
  Palette,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
  Wallet,
  BarChart3,
} from "lucide-react";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Leady", icon: Users },
  { href: "/admin/today", label: "Dnes", icon: Sun },
  { href: "/admin/tasks", label: "TO DO", icon: ListTodo },
  { href: "/admin/rentals", label: "Prenájmy", icon: Wallet },
  { href: "/admin/commissions", label: "Provízie", icon: Wallet },
  { href: "/admin/finance", label: "Finance", icon: BarChart3 },
  { href: "/admin/notes", label: "Projekty & heslá", icon: KanbanSquare },
  { href: "/admin/wheel-leads", label: "Wheel", icon: Sparkles },
  { href: "/admin/logs", label: "Logy", icon: History },
  { href: "/admin/signatures", label: "Podpisy", icon: FileSignature },
  { href: "/admin/designs", label: "Dizajny", icon: Palette },
] as const;

export interface AdminShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: { label: string; href: string };
  children: ReactNode;
}

export function AdminShell({ title, subtitle, actions, backTo, children }: AdminShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();

  useEffect(() => {
    if (authChecking) return;
    if (!userId) navigate("/auth", { replace: true });
  }, [authChecking, userId, navigate]);

  const handleSignOut = () => confirmAdminSignOut(navigate);

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const navButtonClass = (href: string) =>
    cn(
      "shrink-0",
      isActive(href) && "border-primary/50 bg-primary/5 text-primary",
    );

  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Nemáte prístup</h1>
          <p className="text-muted-foreground">
            Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu. Kontaktujte správcu.
          </p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="text-base sm:text-lg font-bold truncate hover:opacity-80 transition-opacity text-left"
            >
              <span className="text-primary">CRM</span>
            </button>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 flex-wrap justify-end max-w-[70%]">
            <NotificationBell />
            <AdminThemeToggle />
            {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Button
                key={href}
                onClick={() => navigate(href)}
                variant="outline"
                size="sm"
                className={navButtonClass(href)}
              >
                <Icon className="w-4 h-4 mr-1.5 shrink-0" />
                {label}
              </Button>
            ))}
            <Button onClick={handleSignOut} variant="outline" size="sm" className="shrink-0">
              <LogOut className="w-4 h-4 mr-1.5" /> Odhlásiť
            </Button>
          </div>

          <div className="flex xl:hidden items-center gap-1">
            <NotificationBell />
            <AdminThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Menu">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <DropdownMenuItem key={href} onClick={() => navigate(href)}>
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="container mx-auto px-3 sm:px-4 py-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {backTo && (
              <Button variant="ghost" size="sm" onClick={() => navigate(backTo.href)} className="shrink-0">
                <ArrowLeft className="w-4 h-4 mr-1" /> {backTo.label}
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</div>
    </main>
  );
}
