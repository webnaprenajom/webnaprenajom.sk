import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { ArrowLeft, Loader2, LogOut, RefreshCw, ShieldAlert } from "lucide-react";

export interface AdminLayoutProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Skip page header row (e.g. pipeline with own title) */
  hidePageHeader?: boolean;
}

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
  hidePageHeader = false,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.pathname !== "/admin" && location.pathname !== "/admin/";
  const { authChecking, isCrmUser, isAdmin, userEmail, userId } = useAdminAccess();

  useEffect(() => {
    if (authChecking) return;
    if (!userId) navigate("/auth", { replace: true });
  }, [authChecking, userId, navigate]);

  const handleSignOut = () => confirmAdminSignOut(navigate);

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

  if (!isCrmUser) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Nemáte prístup</h1>
          <p className="text-muted-foreground">
            Účet <strong>{userEmail}</strong> nemá pridelenú rolu admin ani user. Kontaktujte správcu.
          </p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" forceStatic>
        <SidebarHeader className="border-b border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="flex flex-col items-start w-full text-left px-1 py-0.5 rounded-md hover:bg-sidebar-accent/50 transition-colors"
          >
            <span className="text-base font-bold">
              <span className="text-primary">CRM</span>
            </span>
            <span className="text-[10px] text-muted-foreground truncate w-full">{userEmail}</span>
          </button>
        </SidebarHeader>
        <AdminSidebarNav />
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1 min-w-0" />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Obnoviť stránku"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <NotificationBell />
          <AdminThemeToggle />
        </header>
        {!hidePageHeader && title && (
          <div className="border-b border-border/60 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              {canGoBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 -ml-1"
                  onClick={() => navigate(-1)}
                  title="Späť"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        )}
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
