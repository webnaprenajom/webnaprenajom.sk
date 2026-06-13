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
import { canAccessOperationalCrm, canAccessSettings } from "@/lib/rbac/permissions";
import { BarChart3 } from "lucide-react";

export function AdminSidebarNav() {
  const { pathname } = useLocation();
  const { role } = useAdminAccess();

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
    <SidebarContent>
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({ href, label, icon: Icon, exact }) => {
                const active = isAdminNavActive(pathname, href, exact);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link to={href}>
                        <Icon />
                        <span>{label}</span>
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
