import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CustomerWorkbench } from "@/components/admin/customerWorkbench/CustomerWorkbench";
import { loadCustomerWorkbench } from "@/lib/customerWorkbench/loadCustomerWorkbench";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";
import { computeWorkbenchSummary } from "@/lib/customerWorkbench/summary";
import { parseCustomerRouteKey } from "@/lib/adminNav";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const emptyData = (): CustomerWorkbenchData => ({
  canonicalCustomer: null,
  viewMode: "email",
  leads: [],
  tasks: [],
  rentals: [],
  signatures: [],
  notes: [],
  hosting: [],
  wheels: [],
  designs: [],
  logs: [],
  commEvents: [],
  commissions: [],
  commLoadError: null,
});

const AdminCustomer = () => {
  const navigate = useNavigate();
  const { customerKey = "", customerId: customerIdParam = "" } = useParams();
  const route = parseCustomerRouteKey(customerIdParam || customerKey);
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();

  const [data, setData] = useState<CustomerWorkbenchData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const summary = computeWorkbenchSummary(data, route.value);

  useEffect(() => {
    document.title = `Zákazník · ${summary.displayName || route.value} | CRM`;
  }, [summary.displayName, route.value]);

  useEffect(() => {
    if (authChecking) return;
    if (!userId) navigate("/auth", { replace: true });
  }, [authChecking, userId, navigate]);

  useEffect(() => {
    if (!isAdmin || (!route.value && !customerIdParam && !customerKey)) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await loadCustomerWorkbench({
          routeMode: route.mode,
          routeValue: route.value,
        });
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, route.value, route.mode, customerIdParam, customerKey, reloadToken]);

  const handleSignOut = () => confirmAdminSignOut(navigate);
  const handleReload = () => setReloadToken((n) => n + 1);

  if (authChecking) {
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
            Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu.
          </p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <AdminLayout
      title="Klientsky workspace"
      subtitle={summary.displayName || route.value}
      hidePageHeader={false}
    >
      <CustomerWorkbench
        data={data}
        routeValue={route.value}
        loading={loading}
        onReload={handleReload}
      />
    </AdminLayout>
  );
};

export default AdminCustomer;
