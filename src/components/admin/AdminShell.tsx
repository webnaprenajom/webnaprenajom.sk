import type { ReactNode } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

export interface AdminShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** @deprecated Sidebar navigation replaces back links */
  backTo?: { label: string; href: string };
  children: ReactNode;
}

/** Thin page wrapper — delegates to AdminLayout with sidebar. */
export function AdminShell({ title, subtitle, actions, children }: AdminShellProps) {
  return (
    <AdminLayout title={title} subtitle={subtitle} actions={actions}>
      {children}
    </AdminLayout>
  );
}
