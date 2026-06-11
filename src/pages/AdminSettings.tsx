import { AdminShell } from "@/components/admin/AdminShell";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { useAdminAccess } from "@/hooks/useAdminAccess";

export default function AdminSettings() {
  const { userEmail } = useAdminAccess();

  return (
    <AdminShell title="Nastavenia" subtitle="Vzhľad a účet">
      <div className="max-w-md space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Účet</h2>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Vzhľad</h2>
          <p className="text-xs text-muted-foreground">Prepínač svetlého / tmavého režimu</p>
          <AdminThemeToggle />
        </section>
      </div>
    </AdminShell>
  );
}
