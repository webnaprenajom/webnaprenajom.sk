import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CustomerWorkbench } from "@/components/admin/customerWorkbench/CustomerWorkbench";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";
import { computeWorkbenchSummary } from "@/lib/customerWorkbench/summary";
import { parseCustomerRouteKey } from "@/lib/adminNav";
import { confirmAdminSignOut } from "@/lib/adminSignOut";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useCustomerHub } from "@/hooks/useCustomerHub";
import { canAccessOperationalCrm } from "@/lib/rbac/permissions";

const emptyData = (): CustomerWorkbenchData => ({
  canonicalCustomer: null,
  viewMode: "email",
  leads: [],
  tasks: [],
  rentals: [],
  signatures: [],
  notes: [],
  marketing: [],
  hosting: [],
  credentials: [],
  wheels: [],
  designs: [],
  logs: [],
  commEvents: [],
  commissions: [],
  commLoadError: null,
  paymentRecords: [],
  costRecords: [],
  payoutRecords: [],
  rentalPayments: [],
  paymentRecordsError: null,
  costRecordsError: null,
  payoutRecordsError: null,
});

const AdminCustomer = () => {
  const navigate = useNavigate();
  const { customerKey = "", customerId: customerIdParam = "" } = useParams();
  const route = parseCustomerRouteKey(customerIdParam || customerKey);
  const { authChecking, isCrmUser, role, userEmail, userId } = useAdminAccess();

  const canLoad = canAccessOperationalCrm(role) && !!route.value;
  const { data: hubData, loading, reload, sectionErrors } = useCustomerHub(
    canLoad ? { routeMode: route.mode, routeValue: route.value } : null,
    canLoad,
  );

  const data = hubData ?? emptyData();
  const summary = computeWorkbenchSummary(data, route.value);

  useEffect(() => {
    document.title = `Zákazník · ${summary.displayName || route.value} | CRM`;
  }, [summary.displayName, route.value]);

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

  if (!isCrmUser) {
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
        onReload={reload}
        sectionErrors={sectionErrors}
      />
    </AdminLayout>
  );
};

export default AdminCustomer;
