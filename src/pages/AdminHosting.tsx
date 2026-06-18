import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { FinanceHostingPanel } from "@/components/admin/finance/FinanceHostingPanel";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAccessContext } from "@/hooks/useAccessContext";
import { filterHostingForUser } from "@/lib/rbac/scopeHelpers";

export default function AdminHosting() {
  const [loading, setLoading] = useState(true);
  const [hostingRecords, setHostingRecords] = useState<HostingRecordRow[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
  const accessCtx = useAccessContext();

  useEffect(() => {
    document.title = "Hosting | CRM";
  }, []);

  useEffect(() => {
    if (accessCtx.authChecking) return;
    void load();
  }, [accessCtx.authChecking, accessCtx.role]);

  const load = async () => {
    setLoading(true);
    const [hosting, payments] = await Promise.all([
      supabase.from("hosting_records").select("*").order("created_at", { ascending: false }),
      supabase.from("payment_records").select("*").order("paid_at", { ascending: false }),
    ]);
    if (hosting.error) {
      toast({ title: "Chyba", description: hosting.error.message, variant: "destructive" });
    } else {
      setHostingRecords(
        filterHostingForUser((hosting.data || []) as HostingRecordRow[], accessCtx),
      );
    }
    setPaymentRecords(payments.error ? [] : payments.data || []);
    setLoading(false);
  };

  const ctx = useMemo(
    () => ({
      commissions: [],
      expenses: [],
      websites: [],
      payments: [],
      paymentRecords,
      payoutRecords: [],
      costRecords: [],
    }),
    [paymentRecords],
  );

  return (
    <AdminShell
      title="Hosting"
      subtitle="Domény a hosting u nás — s projektom aj bez neho"
    >
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <FinanceHostingPanel records={hostingRecords} ctx={ctx} onSaved={() => void load()} />
      )}
    </AdminShell>
  );
}
