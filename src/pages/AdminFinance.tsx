import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { FinanceRecordsCrud } from "@/components/admin/finance/FinanceRecordsCrud";
import { FinanceReconciliation } from "@/components/admin/finance/FinanceReconciliation";
import { FinanceSettlementDrafts } from "@/components/admin/finance/FinanceSettlementDrafts";
import { FinanceGovernance } from "@/components/admin/finance/FinanceGovernance";
import { CommissionsExpensesContent } from "@/pages/AdminCommissions";
import { loadIssueDismissals, type IssueDismissalRow } from "@/lib/finance/dismissals";
import { filterActiveIssues } from "@/lib/finance/issueKeys";
import { buildSettlementDrafts } from "@/lib/finance/buildSettlementDrafts";
import { buildReviewQueue } from "@/lib/finance/buildReviewQueue";
import { loadReviewStatuses } from "@/lib/finance/reviewGovernance";
import type { CommissionRule, CommissionRuleOverride } from "@/lib/finance/commissionRules";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import type { PayoutPolicySetting } from "@/lib/finance/payoutPolicy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { buildFinanceSnapshot } from "@/lib/finance/buildFinanceSnapshot";
import { FINANCE_TRUTH_DISCLAIMER } from "@/lib/finance/labels";
import { FinanceImplementerDetailDialog } from "@/components/admin/finance/FinanceImplementerDetailDialog";
import type { CommissionRow } from "@/lib/commissionSource";

const AdminFinance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const advanced = searchParams.get("advanced") === "1";
  const legacyCommissions = searchParams.get("legacy") === "commissions";

  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [raw, setRaw] = useState({
    commissions: [] as any[],
    expenses: [] as any[],
    websites: [] as any[],
    payments: [] as any[],
    paymentRecords: [] as any[],
    payoutRecords: [] as any[],
    costRecords: [] as any[],
  });
  const [dismissals, setDismissals] = useState<IssueDismissalRow[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [commissionOverrides, setCommissionOverrides] = useState<CommissionRuleOverride[]>([]);
  const [hostingRecords, setHostingRecords] = useState<HostingRecordRow[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<Array<{ item_key: string; item_type: string; status: string; review_note: string | null; reviewed_at: string | null }>>([]);
  const [policySettings, setPolicySettings] = useState<PayoutPolicySetting[]>([]);
  const [govMonth] = useState(new Date().getMonth() + 1);
  const [govYear] = useState(new Date().getFullYear());

  useEffect(() => {
    document.title = "Financie | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [c, e, w, p, pr, po, cr, dis, rules, overrides, hosting, reviews, policies] = await Promise.all([
      supabase.from("commissions").select("*").order("date", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      (supabase as any).from("rental_websites").select("*"),
      (supabase as any).from("rental_payments").select("*"),
      supabase.from("payment_records").select("*").order("paid_at", { ascending: false }),
      supabase.from("payout_records").select("*").order("paid_at", { ascending: false }),
      supabase.from("cost_records").select("*").order("paid_at", { ascending: false }),
      loadIssueDismissals().catch(() => [] as IssueDismissalRow[]),
      supabase.from("commission_rules").select("*").order("revenue_stream_kind"),
      supabase.from("commission_rule_overrides").select("*").order("created_at", { ascending: false }),
      supabase.from("hosting_records").select("*").order("created_at", { ascending: false }),
      loadReviewStatuses().catch(() => []),
      supabase.from("finance_policy_settings").select("*").order("policy_key"),
    ]);
    if (c.error || e.error) {
      toast({
        title: "Chyba načítania",
        description: c.error?.message || e.error?.message,
        variant: "destructive",
      });
    }
    setRaw({
      commissions: c.data || [],
      expenses: e.data || [],
      websites: w.data || [],
      payments: p.data || [],
      paymentRecords: pr.error ? [] : pr.data || [],
      payoutRecords: po.error ? [] : po.data || [],
      costRecords: cr.error ? [] : cr.data || [],
    });
    setDismissals(dis);
    setCommissionRules(rules.error ? [] : (rules.data as CommissionRule[]) ?? []);
    setCommissionOverrides(overrides.error ? [] : (overrides.data as CommissionRuleOverride[]) ?? []);
    setHostingRecords(hosting.error ? [] : (hosting.data as HostingRecordRow[]) ?? []);
    setReviewStatuses(reviews);
    setPolicySettings(policies.error ? [] : (policies.data as PayoutPolicySetting[]) ?? []);
    setLoading(false);
  };

  const snapshot = useMemo(
    () =>
      buildFinanceSnapshot({
        commissions: raw.commissions,
        expenses: raw.expenses,
        websites: raw.websites,
        payments: raw.payments,
        paymentRecords: raw.paymentRecords,
        payoutRecords: raw.payoutRecords,
        costRecords: raw.costRecords,
        filterYear: year,
      }),
    [raw, year],
  );

  const financeCtx = useMemo(
    () => ({
      commissions: raw.commissions,
      expenses: raw.expenses,
      websites: raw.websites,
      payments: raw.payments,
      paymentRecords: raw.paymentRecords,
      payoutRecords: raw.payoutRecords,
      costRecords: raw.costRecords,
    }),
    [raw],
  );

  const activeIssueCount = useMemo(() => {
    const keys = new Set(dismissals.map((d) => d.issue_key));
    return filterActiveIssues(snapshot.reconciliation.issues, keys).length;
  }, [snapshot, dismissals]);

  const dailyKpis = useMemo(() => {
    const yearPayments = raw.payments.filter((p: any) => p.year === year);
    const paidInvoices = yearPayments.filter((p: any) => p.status === "paid" || p.paid).length;
    const unpaidInvoices = yearPayments.filter(
      (p: any) => p.status === "unpaid" || p.status === "invoice",
    ).length;
    const receivedSum = snapshot.totals.paymentsConfirmed + snapshot.totals.paymentsLegacyImport;
    const pendingSum = snapshot.totals.rentalMarkedUnpaid + snapshot.totals.rentalMarkedInvoiced;
    return { paidInvoices, unpaidInvoices, receivedSum, pendingSum };
  }, [raw.payments, snapshot, year]);

  const implementerTotals = useMemo(() => {
    const map = new Map<string, { paid: number; unpaid: number; count: number }>();
    for (const c of raw.commissions) {
      const key = (c.implementer || "").trim();
      if (!key) continue;
      const cur = map.get(key) || { paid: 0, unpaid: 0, count: 0 };
      const amt = Number(c.amount || 0);
      if (c.payment_status === "paid") cur.paid += amt;
      else cur.unpaid += amt;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1].paid + b[1].unpaid - (a[1].paid + a[1].unpaid),
    );
  }, [raw.commissions]);

  const settlementDraftsForGov = useMemo(
    () =>
      buildSettlementDrafts({
        commissions: raw.commissions,
        payoutRecords: raw.payoutRecords,
        year: govYear,
        month: govMonth,
        rules: commissionRules,
        overrides: commissionOverrides,
        websites: raw.websites,
      }),
    [raw.commissions, raw.payoutRecords, raw.websites, govYear, govMonth, commissionRules, commissionOverrides],
  );

  const pendingReviewCount = useMemo(
    () =>
      buildReviewQueue({
        dismissals,
        overrides: commissionOverrides,
        hostingRecords,
        settlementDrafts: settlementDraftsForGov,
        reviewStatuses: reviewStatuses as any,
        rules: commissionRules,
      }).filter((q) => q.status === "pending" || q.status === "reopened").length,
    [dismissals, commissionOverrides, hostingRecords, settlementDraftsForGov, reviewStatuses, commissionRules],
  );

  const toggleAdvanced = () => {
    const next = new URLSearchParams(searchParams);
    if (advanced) {
      next.delete("advanced");
      next.delete("legacy");
      next.delete("tab");
    } else {
      next.set("advanced", "1");
    }
    setSearchParams(next, { replace: true });
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <AdminShell
      title="Financie"
      subtitle={advanced ? "Pokročilé nástroje a audit" : "Denný prehľad platieb a provízií"}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={year}
            onChange={(ev) => setYear(Number(ev.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Rok {y}
              </option>
            ))}
          </select>
          <Button size="sm" variant={advanced ? "default" : "outline"} onClick={toggleAdvanced}>
            {advanced ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Skryť pokročilé
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> Pokročilé
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {legacyCommissions && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Provízie už nie sú samostatná sekcia v menu.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Správa provízií a nákladov je v pokročilom režime Financií. Top-level route{" "}
                <code className="text-[10px]">/admin/commissions</code> presmerováva sem.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : advanced ? (
          <AdvancedFinanceView
            snapshot={snapshot}
            financeCtx={financeCtx}
            raw={raw}
            year={year}
            dismissals={dismissals}
            commissionRules={commissionRules}
            commissionOverrides={commissionOverrides}
            hostingRecords={hostingRecords}
            reviewStatuses={reviewStatuses}
            policySettings={policySettings}
            activeIssueCount={activeIssueCount}
            pendingReviewCount={pendingReviewCount}
            settlementDraftsForGov={settlementDraftsForGov}
            legacyCommissions={legacyCommissions}
            onSaved={() => void load()}
          />
        ) : (
          <DailyFinanceView
            dailyKpis={dailyKpis}
            implementerTotals={implementerTotals}
            commissions={raw.commissions as CommissionRow[]}
            activeIssueCount={activeIssueCount}
            onOpenAdvanced={() => {
              const next = new URLSearchParams(searchParams);
              next.set("advanced", "1");
              setSearchParams(next, { replace: true });
            }}
          />
        )}
      </div>
    </AdminShell>
  );
};

function DailyFinanceView({
  dailyKpis,
  implementerTotals,
  commissions,
  activeIssueCount,
  onOpenAdvanced,
}: {
  dailyKpis: { paidInvoices: number; unpaidInvoices: number; receivedSum: number; pendingSum: number };
  implementerTotals: [string, { paid: number; unpaid: number; count: number }][];
  commissions: CommissionRow[];
  activeIssueCount: number;
  onOpenAdvanced: () => void;
}) {
  const [detailImplementer, setDetailImplementer] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Zaplatené faktúry" value={String(dailyKpis.paidInvoices)} hint="Prenájmy — mesačné záznamy" />
        <KpiCard label="Nezaplatené / fakturované" value={String(dailyKpis.unpaidInvoices)} hint="Čaká na úhradu" accent="text-amber-600" />
        <KpiCard label="Prijaté platby" value={`${dailyKpis.receivedSum.toFixed(0)} €`} accent="text-green-600" />
        <KpiCard label="Čakajúce platby" value={`${dailyKpis.pendingSum.toFixed(0)} €`} accent="text-orange-500" />
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Provízie podľa realizátora</h2>
          <span className="text-xs text-muted-foreground">zo všetkých zdrojov (workflow)</span>
        </div>
        {implementerTotals.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Žiadne provízne záznamy.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Realizátor</TableHead>
                <TableHead className="text-right">Vyplatené</TableHead>
                <TableHead className="text-right">Nezaplatené</TableHead>
                <TableHead className="text-right">Počet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {implementerTotals.map(([name, t]) => (
                <TableRow
                  key={name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetailImplementer(name)}
                >
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-right text-green-600">{t.paid.toFixed(2)} €</TableCell>
                  <TableCell className="text-right text-amber-600">{t.unpaid.toFixed(2)} €</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <div className="flex flex-wrap gap-2 items-center">
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/rentals">Prenájmy</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/hosting">Hosting</Link>
        </Button>
        {activeIssueCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {activeIssueCount} nevyriešených položiek v audite
          </Badge>
        )}
        <Button size="sm" variant="ghost" className="text-xs" onClick={onOpenAdvanced}>
          Otvoriť pokročilé financie →
        </Button>
      </div>

      <FinanceImplementerDetailDialog
        open={!!detailImplementer}
        onOpenChange={(o) => !o && setDetailImplementer(null)}
        implementer={detailImplementer || ""}
        commissions={commissions}
      />
    </div>
  );
}

function AdvancedFinanceView({
  snapshot,
  financeCtx,
  raw,
  year,
  dismissals,
  commissionRules,
  commissionOverrides,
  hostingRecords,
  reviewStatuses,
  policySettings,
  activeIssueCount,
  pendingReviewCount,
  settlementDraftsForGov,
  legacyCommissions,
  onSaved,
}: {
  snapshot: ReturnType<typeof buildFinanceSnapshot>;
  financeCtx: any;
  raw: any;
  year: number;
  dismissals: IssueDismissalRow[];
  commissionRules: CommissionRule[];
  commissionOverrides: CommissionRuleOverride[];
  hostingRecords: HostingRecordRow[];
  reviewStatuses: any[];
  policySettings: PayoutPolicySetting[];
  activeIssueCount: number;
  pendingReviewCount: number;
  settlementDraftsForGov: ReturnType<typeof buildSettlementDrafts>;
  legacyCommissions: boolean;
  onSaved: () => void;
}) {
  const defaultTab = legacyCommissions ? "provizie" : "prehlad";

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
        {FINANCE_TRUTH_DISCLAIMER}
      </p>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="prehlad">Detailný prehľad</TabsTrigger>
          <TabsTrigger value="provizie">Provízie & náklady</TabsTrigger>
          <TabsTrigger value="records">Záznamy</TabsTrigger>
          <TabsTrigger value="reconciliation">
            Zladenie
            {activeIssueCount > 0 && <span className="ml-1 text-amber-500">({activeIssueCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="settlement">Vyúčtovanie</TabsTrigger>
          <TabsTrigger value="governance">
            Kontrola
            {pendingReviewCount > 0 && <span className="ml-1 text-amber-500">({pendingReviewCount})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prehlad" className="space-y-4 mt-4">
          <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Potvrdené platby" value={snapshot.totals.paymentsConfirmed} accent="text-green-600" />
            <StatCard label="Potvrdené výplaty" value={snapshot.totals.payoutsConfirmed} accent="text-red-600" />
            <StatCard label="Potvrdené náklady" value={snapshot.totals.costsConfirmed} accent="text-red-600" />
            <StatCard label={`Prenájmy faktúra (${year})`} value={snapshot.totals.rentalMarkedInvoiced} />
            <StatCard label={`Prenájmy nezaplatené (${year})`} value={snapshot.totals.rentalMarkedUnpaid} />
            <StatCard label={`Prenájmy potenciál (${year})`} value={snapshot.totals.rentalPotential} accent="text-primary" />
          </section>
        </TabsContent>

        <TabsContent value="provizie" className="mt-4">
          <CommissionsExpensesContent />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <FinanceRecordsCrud
            paymentRecords={raw.paymentRecords}
            payoutRecords={raw.payoutRecords}
            costRecords={raw.costRecords}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <FinanceReconciliation
            snapshot={snapshot}
            ctx={financeCtx}
            year={year}
            dismissals={dismissals}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <FinanceSettlementDrafts
            ctx={financeCtx}
            rules={commissionRules}
            overrides={commissionOverrides}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="governance" className="mt-4">
          <FinanceGovernance
            rules={commissionRules}
            overrides={commissionOverrides}
            hostingRecords={hostingRecords}
            dismissals={dismissals}
            settlementDrafts={settlementDraftsForGov}
            reviewStatuses={reviewStatuses}
            policies={policySettings}
            financeCtx={financeCtx}
            pendingReviewCount={pendingReviewCount}
            onSaved={onSaved}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent}`}>{value.toFixed(2)} €</div>
    </div>
  );
}

export default AdminFinance;
