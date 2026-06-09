import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { FinanceRecordsCrud } from "@/components/admin/finance/FinanceRecordsCrud";
import { FinanceReconciliation } from "@/components/admin/finance/FinanceReconciliation";
import { FinanceSettlementDrafts } from "@/components/admin/finance/FinanceSettlementDrafts";
import { PayrollExportPanel } from "@/components/admin/finance/PayrollExportPanel";
import { FinanceGovernance } from "@/components/admin/finance/FinanceGovernance";
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
import { Loader2, Download, ExternalLink } from "lucide-react";
import {
  buildFinanceSnapshot,
  downloadFinanceCsv,
} from "@/lib/finance/buildFinanceSnapshot";
import { FINANCE_TRUTH_DISCLAIMER, TRUTH_LEVEL_LABELS } from "@/lib/finance/labels";
import type { FinanceTruthLevel } from "@/lib/finance/types";

const AdminFinance = () => {
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
    document.title = "Finance prehľad | CRM";
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
    if (pr.error || po.error || cr.error) {
      toast({
        title: "Canonical tabuľky ešte nie sú plne nasadené",
        description:
          pr.error?.message || po.error?.message || cr.error?.message ||
          "Spustite DB migrácie Phase 2B/2C.",
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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

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

  return (
    <AdminShell
      title="Finance prehľad"
      subtitle="Canonical records, reconciliation a legacy workflow"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <>
          <select
            value={year}
            onChange={(ev) => setYear(Number(ev.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Prenájmy {y}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || snapshot.rows.length === 0}
            onClick={() => downloadFinanceCsv(snapshot)}
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
          {FINANCE_TRUTH_DISCLAIMER}
        </p>

        <div className="flex flex-wrap gap-2 text-xs items-center">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/commissions">Provízie & náklady</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/rentals">Prenájmy</Link>
          </Button>
          {snapshot.meta.paymentRecordCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {snapshot.meta.paymentRecordCount} platieb
            </Badge>
          )}
          {snapshot.meta.payoutRecordCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {snapshot.meta.payoutRecordCount} výplat
            </Badge>
          )}
          {snapshot.meta.costRecordCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {snapshot.meta.costRecordCount} nákladov
            </Badge>
          )}
          {activeIssueCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {activeIssueCount} issues
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Prehľad</TabsTrigger>
              <TabsTrigger value="records">Záznamy</TabsTrigger>
              <TabsTrigger value="reconciliation">
                Reconciliation
                {activeIssueCount > 0 && (
                  <span className="ml-1 text-amber-500">({activeIssueCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="settlement">Settlement drafts</TabsTrigger>
              <TabsTrigger value="governance">
                Governance
                {pendingReviewCount > 0 && (
                  <span className="ml-1 text-amber-500">({pendingReviewCount})</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Príjmy (platby)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Potvrdené platby" value={snapshot.totals.paymentsConfirmed} accent="text-green-600" />
                  <StatCard label="Legacy import platieb" value={snapshot.totals.paymentsLegacyImport} accent="text-green-500/80" />
                  <StatCard label={`Prenájmy iba workflow (${year})`} value={snapshot.totals.workflowOnlyIn} accent="text-muted-foreground" hint="Bez payment_records" />
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Výdavky (výplaty / náklady)
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Potvrdené výplaty" value={snapshot.totals.payoutsConfirmed} accent="text-red-600" />
                  <StatCard label="Legacy import výplat" value={snapshot.totals.payoutsLegacyImport} accent="text-red-500/80" />
                  <StatCard label="Potvrdené náklady" value={snapshot.totals.costsConfirmed} accent="text-red-600" />
                  <StatCard label="Legacy import nákladov" value={snapshot.totals.costsLegacyImport} accent="text-red-500/80" />
                  <StatCard label="Iba workflow flag (out)" value={snapshot.totals.workflowOnlyOut} accent="text-muted-foreground" hint="Bez payout/cost records" />
                </div>
              </section>

              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label={`Prenájmy faktúra (${year})`} value={snapshot.totals.rentalMarkedInvoiced} />
                <StatCard label={`Prenájmy nezaplatené (${year})`} value={snapshot.totals.rentalMarkedUnpaid} />
                <StatCard label={`Prenájmy potenciál (${year})`} value={snapshot.totals.rentalPotential} accent="text-primary" />
                <StatCard label="AI kredity (odvodené)" value={snapshot.totals.rentalCreditsCostDerived} />
              </section>

              <LedgerTable snapshot={snapshot} />
              <PayrollExportPanel payoutRecords={raw.payoutRecords} />
            </TabsContent>

            <TabsContent value="records" className="mt-4">
              <FinanceRecordsCrud
                paymentRecords={raw.paymentRecords}
                payoutRecords={raw.payoutRecords}
                costRecords={raw.costRecords}
                onSaved={() => void load()}
              />
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-4">
              <FinanceReconciliation
                snapshot={snapshot}
                ctx={financeCtx}
                year={year}
                dismissals={dismissals}
                onSaved={() => void load()}
              />
            </TabsContent>

            <TabsContent value="settlement" className="mt-4">
              <FinanceSettlementDrafts
                ctx={financeCtx}
                rules={commissionRules}
                overrides={commissionOverrides}
                onSaved={() => void load()}
              />
            </TabsContent>

            <TabsContent value="governance" className="mt-4">
              <FinanceGovernance
                rules={commissionRules}
                overrides={commissionOverrides}
                hostingRecords={hostingRecords}
                dismissals={dismissals}
                settlementDrafts={settlementDraftsForGov}
                reviewStatuses={reviewStatuses as any}
                policies={policySettings}
                financeCtx={financeCtx}
                pendingReviewCount={pendingReviewCount}
                onSaved={() => void load()}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminShell>
  );
};

function LedgerTable({ snapshot }: { snapshot: ReturnType<typeof buildFinanceSnapshot> }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Unified ledger view</h2>
        <span className="text-xs text-muted-foreground">{snapshot.rows.length} riadkov</span>
      </div>
      {snapshot.rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Žiadne finance riadky</div>
      ) : (
        <div className="overflow-x-auto max-h-[520px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Názov</TableHead>
                <TableHead className="text-right">Suma</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Truth</TableHead>
                <TableHead>Zdroj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.rows.slice(0, 200).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{r.date}</TableCell>
                  <TableCell className="text-xs">{r.kind}</TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">{r.title}</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${r.direction === "out" ? "text-red-500" : "text-green-500"}`}>
                    {r.direction === "out" ? "−" : "+"}
                    {r.amount.toFixed(2)} €
                  </TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{r.statusLabel}</TableCell>
                  <TableCell>
                    <TruthBadge level={r.truthLevel} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.sourceTable}
                    <ExternalLink className="w-3 h-3 inline ml-1 opacity-40" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {snapshot.rows.length > 200 && (
        <p className="text-xs text-muted-foreground p-3 border-t border-border">
          Zobrazených prvých 200 riadkov — plný export cez CSV.
        </p>
      )}
    </section>
  );
}

function TruthBadge({ level }: { level: FinanceTruthLevel }) {
  const variant =
    level === "payment_fact" || level === "payout_fact" || level === "cost_fact"
      ? "default"
      : level === "legacy_import"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} className="text-[10px]">
      {TRUTH_LEVEL_LABELS[level] ?? level}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  accent = "text-foreground",
  hint,
}: {
  label: string;
  value: number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${accent}`}>{value.toFixed(2)} €</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

export default AdminFinance;
