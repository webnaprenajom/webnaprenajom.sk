import { Link, useLocation } from "react-router-dom";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/adminNavConfig";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useCrmUserDirectory } from "@/hooks/useCrmUserDirectory";
import {
  PENDING_AUTH_USER_REVIEW_HASH,
  pendingAuthUserReviewMessage,
} from "@/lib/admin/crmUserDirectory";
import { canAccessOperationalCrm, canAccessSettings } from "@/lib/rbac/permissions";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

export function AdminSidebarNav() {
  const { pathname } = useLocation();
  const { role } = useAdminAccess();
  const ownerSettings = canAccessSettings(role);
  const { withoutRole } = useCrmUserDirectory({ enabled: ownerSettings });
  const pendingAuthReviewCount = ownerSettings ? withoutRole.length : 0;
  const pendingAuthReviewMessage = pendingAuthUserReviewMessage(pendingAuthReviewCount);

  const groups = canAccessOperationalCrm(role)
    ? ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.devOnly) return false;
          if (item.href === "/admin/settings" && !canAccessSettings(role)) return false;
          return true;
        }),
      })).filter((g) => g.items.length > 0)
    : [
        {
          id: "finance",
          label: "Prehľad",
          items: [{ href: "/admin/finance", label: "Financie", icon: BarChart3 }],
        },
      ];

  return (
    <SidebarContent className="gap-0.5 py-1">
      {groups.map((group) => (
        <SidebarGroup key={group.id} className="py-0.5">
          {group.label && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wide px-2 py-1">
              {group.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = isAdminNavActive(pathname, href, exact);
                const isSettings = href === "/admin/settings";
                const settingsHref =
                  isSettings && pendingAuthReviewCount > 0
                    ? `${href}#${PENDING_AUTH_USER_REVIEW_HASH}`
                    : href;
                const tooltip =
                  isSettings && pendingAuthReviewMessage ? pendingAuthReviewMessage : label;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={tooltip} size="sm">
                      <Link to={settingsHref} className="flex items-center gap-2 min-h-8">
                        <Icon className="size-3.5 shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        {isSettings && pendingAuthReviewCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-5 shrink-0 px-1.5 text-[10px] tabular-nums"
                            title={pendingAuthReviewMessage ?? undefined}
                          >
                            {pendingAuthReviewCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}
