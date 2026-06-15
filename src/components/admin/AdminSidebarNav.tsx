import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AdminSidebarNav() {
  const { pathname } = useLocation();
  const { role } = useAdminAccess();
  const [openTasks, setOpenTasks] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .neq("status", "done");
      if (active) setOpenTasks(count ?? 0);
    };
    void load();
    const channel = supabase
      .channel("sidebar-tasks-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

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
          items: [{ href: "/admin/finance", label: "Financie", icon: BarChart3, iconColor: "text-green-500" }],
        },
      ];

  return (
    <SidebarContent>
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({ href, label, icon: Icon, exact, iconColor }) => {
                const active = isAdminNavActive(pathname, href, exact);
                const isTasks = href === "/admin/tasks";
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
                      <Link to={href} className="flex items-center gap-2">
                        <Icon className={cn(iconColor)} />
                        <span className="flex-1">{label}</span>
                        {isTasks && openTasks > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                            {openTasks}
                          </span>
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
