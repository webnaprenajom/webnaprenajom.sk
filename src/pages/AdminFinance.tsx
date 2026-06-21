/** governance:inline-queries — do not expand; extract loaders to src/lib/ in Plan Mode (GOVERNANCE.md). */
import { useEffect, useMemo, useState } from "react";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { FinanceRecordsCrud } from "@/components/admin/finance/FinanceRecordsCrud";
import { FinanceReconciliation } from "@/components/admin/finance/FinanceReconciliation";
import { FinanceSettlementDrafts } from "@/components/admin/finance/FinanceSettlementDrafts";
import { loadIssueDismissals, type IssueDismissalRow } from "@/lib/finance/dismissals";
import { summarizeReconciliationIssueCounts, type ReconciliationIssueSummary } from "@/lib/finance/issuePresentation";
import type { CommissionRule, CommissionRuleOverride } from "@/lib/finance/commissionRules";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import {
  normalizeFinanceLegacyDeepLink,
  resolveFinanceDiagnostikaTab,
  type FinanceDiagnostikaTab,
} from "@/lib/finance/financeDiagnostikaNav";
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
import {
  FINANCE_ENTITY_KIND_LABELS,
  type EntityPaymentTotals,
  type FinanceEntityKind,
} from "@/lib/finance/financeSourceLabels";
import { TruthLevelBadge } from "@/components/admin/finance/TruthLevelBadge";
import { FinanceImplementerDetailDialog } from "@/components/admin/finance/FinanceImplementerDetailDialog";
import { FinanceDailyDetailDialog } from "@/components/admin/finance/FinanceDailyDetailDialog";
import type { CommissionRow } from "@/lib/commissionSource";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  canAccessFinanceAdvanced,
  canAccessOperationalCrm,
  canSeeAllCommissions,
  filterCommissionsForUser,
  filterPayoutRecordsForUser,
  resolveScopedCommissionEmpty,
  type AccessContext,
} from "@/lib/rbac/permissions";
import {
  resolveImplementerFinanceTruthLevel,
  type ImplementerFinanceTotals,
} from "@/lib/finance/commissionPayoutStatus";
import { buildImplementerFinanceTotalsWithRentals } from "@/lib/finance/rentalImplementerFinanceTotals";
import {
  buildDailyCommissionDetailRows,
  buildDailyCostDetailRows,
  summarizeDailyCommissionRows,
  summarizeDailyCostRows,
} from "@/lib/finance/dailyFinanceDetail";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { TeamProfileNotice } from "@/components/admin/rbac/TeamProfileNotice";
import { ScopedEmptyState } from "@/components/admin/rbac/ScopedEmptyState";
import { useHistoricalIdentity } from "@/hooks/useHistoricalIdentity";
import { formatImplementerLabel } from "@/lib/identity/historicalIdentity";

const AdminFinance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const access = useAdminAccess();
  const advanced = searchParams.get("advanced") === "1" && canAccessFinanceAdvanced(access.role);
  const diagnostikaTab = resolveFinanceDiagnostikaTab(searchParams.get("tab"));

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
    projects: [] as any[],
    marketing: [] as any[],
    tasks: [] as any[],
  });
  const [dismissals, setDismissals] = useState<IssueDismissalRow[]>([]);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [commissionOverrides, setCommissionOverrides] = useState<CommissionRuleOverride[]>([]);
  const [hostingRecords, setHostingRecords] = useState<HostingRecordRow[]>([]);
  const [loadErrors, setLoadErrors] = useState<{ table: string; message: string }[]>([]);

  useEffect(() => {
    document.title = "Financie | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    // Fáza 1 (stabilizácia): každý z 13 paralelných zdrojov sa hlási samostatne do `errors`,
    // namiesto tichého `error ? [] : data`. Dáta sa stále degradujú na [] (stránka nespadne),
    // ale chyba sa nestratí — zobrazí sa konsolidovaný toast + banner (pozri loadErrors nižšie).
    const errors: { table: string; message: string }[] = [];

    const [c, e, w, p, pr, po, cr, dis, rules, overrides, hosting, proj, mkt, tsk] =
      await Promise.all([
      supabase.from("commissions").select("*").order("date", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("rental_websites").select("*"),
      supabase.from("rental_payments").select("*"),
      supabase.from("payment_records").select("*").order("paid_at", { ascending: false }),
      supabase.from("payout_records").select("*").order("paid_at", { ascending: false }),
      supabase.from("cost_records").select("*").order("paid_at", { ascending: false }),
      loadIssueDismissals().catch((err) => {
        errors.push({ table: "finance_issue_dismissals", message: err?.message || String(err) });
        return [] as IssueDismissalRow[];
      }),
      supabase.from("commission_rules").select("*").order("revenue_stream_kind"),
      supabase.from("commission_rule_overrides").select("*").order("created_at", { ascending: false }),
      supabase.from("hosting_records").select("*").order("created_at", { ascending: false }),
      supabase
        .from("project_notes")
        .select("id,title,client_name,customer_email,agreed_fee,status"),
      supabase
        .from("marketing_records")
        .select("id,title,client_name,customer_email,agreed_fee,status"),
      supabase
        .from("tasks")
        .select("id,title,client_name,amount,deposit,status"),
    ]);

    // Priame supabase.from(...) výsledky — každý sa skontroluje samostatne, žiadny sa nezahodí tichom.
    const directResults: { table: string; result: { data: any; error: any } }[] = [
      { table: "commissions", result: c },
      { table: "expenses", result: e },
      { table: "rental_websites", result: w },
      { table: "rental_payments", result: p },
      { table: "payment_records", result: pr },
      { table: "payout_records", result: po },
      { table: "cost_records", result: cr },
      { table: "commission_rules", result: rules },
      { table: "commission_rule_overrides", result: overrides },
      { table: "hosting_records", result: hosting },
      { table: "project_notes", result: proj },
      { table: "marketing_records", result: mkt },
      { table: "tasks", result: tsk },
    ];
    for (const { table, result } of directResults) {
      if (result.error) {
        errors.push({ table, message: result.error.message });
      }
    }

    setRaw({
      commissions: c.data || [],
      expenses: e.data || [],
      websites: w.data || [],
      payments: p.data || [],
      paymentRecords: pr.data || [],
      payoutRecords: po.data || [],
      costRecords: cr.data || [],
      projects: proj.data || [],
      marketing: mkt.data || [],
      tasks: tsk.data || [],
    });
    setDismissals(dis);
    setCommissionRules((rules.data as CommissionRule[]) ?? []);
    setCommissionOverrides((overrides.data as CommissionRuleOverride[]) ?? []);
    setHostingRecords((hosting.data as HostingRecordRow[]) ?? []);
    setLoadErrors(errors);

    if (errors.length > 0) {
      toast({
        title: `Chyba načítania (${errors.length} ${errors.length === 1 ? "zdroj zlyhal" : "zdrojov zlyhalo"})`,
        description: errors.map((er) => `${er.table}: ${er.message}`).join(" · "),
        variant: "destructive",
      });
    }

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
        projects: raw.projects,
        marketing: raw.marketing,
        tasks: raw.tasks,
        hosting: hostingRecords,
        filterYear: year,
      }),
    [raw, hostingRecords, year],
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
      projects: raw.projects,
      marketing: raw.marketing,
      tasks: raw.tasks,
      hosting: hostingRecords,
    }),
    [raw, hostingRecords],
  );

  const reconciliationSummary = useMemo(() => {
    const keys = new Set(dismissals.map((d) => d.issue_key));
    return summarizeReconciliationIssueCounts(snapshot.reconciliation.issues, keys, financeCtx, accessCtx);
  }, [snapshot, dismissals, financeCtx]);

  const dailyKpis = useMemo(() => {
    const yearPayments = raw.payments.filter((p: any) => p.year === year);
    const paidInvoices = yearPayments.filter((p: any) => p.status === "paid" || p.paid).length;
    const unpaidInvoices = yearPayments.filter(
      (p: any) => p.status === "unpaid" || p.status === "invoice",
    ).length;
    const paymentsConfirmed = snapshot.totals.paymentsConfirmed;
    const paymentsLegacyImport = snapshot.totals.paymentsLegacyImport;
    const receivedSum = paymentsConfirmed + paymentsLegacyImport;
    const pendingSum = snapshot.totals.rentalMarkedUnpaid + snapshot.totals.rentalMarkedInvoiced;
    return { paidInvoices, unpaidInvoices, receivedSum, pendingSum, paymentsConfirmed, paymentsLegacyImport };
  }, [raw.payments, snapshot, year]);

  const accessCtx: AccessContext = useMemo(
    () => ({
      role: access.role,
      userId: access.userId,
      implementerName: access.implementerName,
    }),
    [access.role, access.userId, access.implementerName],
  );

  const scopedCommissions = useMemo(
    () => filterCommissionsForUser(raw.commissions, accessCtx),
    [raw.commissions, accessCtx],
  );

  const scopedPayoutRecords = useMemo(
    () => filterPayoutRecordsForUser(raw.payoutRecords, accessCtx),
    [raw.payoutRecords, accessCtx],
  );

  const scopedCommissionsForYear = useMemo(
    () => scopedCommissions.filter((c) => String(c.date || "").startsWith(String(year))),
    [scopedCommissions, year],
  );

  const scopeImplementer = canSeeAllCommissions(accessCtx.role) ? null : accessCtx.implementerName;

  const dailyCommissionDetail = useMemo(() => {
    const rows = buildDailyCommissionDetailRows({
      year,
      commissions: scopedCommissions as CommissionRow[],
      payoutRecords: scopedPayoutRecords,
      websites: raw.websites,
      payments: raw.payments,
      scopeImplementer,
    });
    return { rows, summary: summarizeDailyCommissionRows(rows) };
  }, [year, scopedCommissions, scopedPayoutRecords, raw.websites, raw.payments, scopeImplementer]);

  const dailyCostDetail = useMemo(() => {
    const rows = buildDailyCostDetailRows(raw.costRecords, year);
    return { rows, summary: summarizeDailyCostRows(rows) };
  }, [raw.costRecords, year]);

  const implementerTotals = useMemo(() => {
    return Array.from(
      buildImplementerFinanceTotalsWithRentals(scopedCommissionsForYear, scopedPayoutRecords, {
        websites: raw.websites,
        payments: raw.payments,
        allCommissions: scopedCommissions as CommissionRow[],
        year,
        scopeImplementer,
      }).entries(),
    ).sort(
      (a, b) =>
        b[1].paidAudited + b[1].unpaid - (a[1].paidAudited + a[1].unpaid),
    );
  }, [
    scopedCommissionsForYear,
    scopedPayoutRecords,
    raw.websites,
    raw.payments,
    scopedCommissions,
    year,
    scopeImplementer,
  ]);

  const toggleAdvanced = () => {
    if (!canAccessFinanceAdvanced(access.role)) return;
    const next = new URLSearchParams(searchParams);
    if (advanced) {
      next.delete("advanced");
      next.delete("legacy");
      next.delete("tab");
      next.delete("recordsKind");
    } else {
      next.set("advanced", "1");
      if (!next.get("tab")) next.set("tab", "reconciliation");
    }
    setSearchParams(next, { replace: true });
  };

  // ponytail: FinanceRecordsCrud mounts only in diagnostika — auto-enable when ?record= is present
  useEffect(() => {
    if (!searchParams.get("record")) return;
    if (advanced || !canAccessFinanceAdvanced(access.role)) return;
    const next = new URLSearchParams(searchParams);
    next.set("advanced", "1");
    next.set("tab", "records");
    setSearchParams(next, { replace: true });
  }, [searchParams, advanced, access.role, setSearchParams]);

  useEffect(() => {
    if (!searchParams.get("legacy")) return;
    const normalized = normalizeFinanceLegacyDeepLink(searchParams);
    if (normalized.toString() === searchParams.toString()) return;
    setSearchParams(normalized, { replace: true });
  }, [searchParams, setSearchParams]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const scopedEmpty = useMemo(() => resolveScopedCommissionEmpty(accessCtx), [accessCtx]);
  const showOrgFinance = canAccessOperationalCrm(access.role);

  if (!access.authChecking && searchParams.get("advanced") === "1" && !canAccessFinanceAdvanced(access.role)) {
    return <Navigate to="/admin/finance" replace />;
  }

  return (
    <AdminShell
      title="Financie"
      subtitle={advanced ? "Diagnostika finance" : "Denný prehľad platieb a provízií"}
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
          {canAccessFinanceAdvanced(access.role) && (
            <Button size="sm" variant={advanced ? "default" : "outline"} onClick={toggleAdvanced}>
              {advanced ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" /> Skryť diagnostiku
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" /> Diagnostika
                </>
              )}
            </Button>
          )}
          {canAccessFinanceAdvanced(access.role) ? null : (
            <Badge variant="outline" className="text-[10px]">
              {access.implementerName || "Vlastné provízie"}
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <TeamProfileNotice />
        {loadErrors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {loadErrors.length === 1
                  ? "1 finančný zdroj sa nepodarilo načítať."
                  : `${loadErrors.length} finančných zdrojov sa nepodarilo načítať.`}{" "}
                Zobrazené súčty môžu byť neúplné.
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {loadErrors.map((er) => (
                  <li key={er.table}>
                    <code className="text-[10px]">{er.table}</code>: {er.message}
                  </li>
                ))}
              </ul>
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
            dismissals={dismissals}
            commissionRules={commissionRules}
            commissionOverrides={commissionOverrides}
            reconciliationSummary={reconciliationSummary}
            diagnostikaTab={diagnostikaTab}
            year={year}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            onSaved={() => void load()}
          />
        ) : (
          <DailyFinanceView
            dailyKpis={dailyKpis}
            entityPayments={snapshot.totals.entityPaymentsConfirmed}
            implementerTotals={implementerTotals}
            commissions={scopedCommissions as CommissionRow[]}
            payoutRecords={scopedPayoutRecords}
            websites={raw.websites}
            payments={raw.payments}
            year={year}
            commissionSummary={dailyCommissionDetail.summary}
            costSummary={dailyCostDetail.summary}
            commissionDetailRows={dailyCommissionDetail.rows}
            costDetailRows={dailyCostDetail.rows}
            reconciliationSummary={reconciliationSummary}
            scopedEmpty={scopedEmpty}
            showOrgKpis={showOrgFinance}
            implementerLabel={access.implementerName}
            onOpenReconciliation={() => {
              if (!canAccessFinanceAdvanced(access.role)) return;
              const next = new URLSearchParams(searchParams);
              next.set("advanced", "1");
              next.set("tab", "reconciliation");
              setSearchParams(next, { replace: true });
            }}
            onOpenDiagnostika={() => {
              if (!canAccessFinanceAdvanced(access.role)) return;
              const next = new URLSearchParams(searchParams);
              next.set("advanced", "1");
              if (!next.get("tab")) next.set("tab", "reconciliation");
              setSearchParams(next, { replace: true });
            }}
            showDiagnostikaLink={canAccessFinanceAdvanced(access.role)}
          />
        )}
      </div>
    </AdminShell>
  );
};

function DailyFinanceView({
  dailyKpis,
  entityPayments,
  implementerTotals,
  commissions,
  payoutRecords,
  websites = [],
  payments = [],
  year,
  commissionSummary,
  costSummary,
  commissionDetailRows,
  costDetailRows,
  reconciliationSummary,
  scopedEmpty,
  showOrgKpis,
  implementerLabel,
  onOpenReconciliation,
  onOpenDiagnostika,
  showDiagnostikaLink = true,
}: {
  dailyKpis: {
    paidInvoices: number;
    unpaidInvoices: number;
    receivedSum: number;
    pendingSum: number;
    paymentsConfirmed: number;
    paymentsLegacyImport: number;
  };
  entityPayments: EntityPaymentTotals;
  implementerTotals: [string, ImplementerFinanceTotals][];
  commissions: CommissionRow[];
  payoutRecords: Array<{
    source_table?: string | null;
    source_id?: string | null;
    amount?: number | null;
    paid_at?: string;
    truth_level?: string | null;
    implementer?: string | null;
  }>;
  websites?: Array<{ id: string; name?: string | null; monthly_price?: number | null; implementers?: unknown }>;
  payments?: Array<{
    website_id: string;
    year: number;
    month: number;
    status?: string | null;
    paid?: boolean | null;
    custom_price?: number | null;
    amount?: number | null;
  }>;
  year: number;
  commissionSummary: ReturnType<typeof summarizeDailyCommissionRows>;
  costSummary: ReturnType<typeof summarizeDailyCostRows>;
  commissionDetailRows: ReturnType<typeof buildDailyCommissionDetailRows>;
  costDetailRows: ReturnType<typeof buildDailyCostDetailRows>;
  reconciliationSummary: ReconciliationIssueSummary;
  scopedEmpty: ReturnType<typeof resolveScopedCommissionEmpty>;
  showOrgKpis: boolean;
  implementerLabel: string | null;
  onOpenReconciliation: () => void;
  onOpenDiagnostika: () => void;
  showDiagnostikaLink?: boolean;
}) {
  const [detailImplementer, setDetailImplementer] = useState<string | null>(null);
  const [dailyDetailKind, setDailyDetailKind] = useState<"commission" | "cost" | null>(null);
  const { historicalIdentity } = useHistoricalIdentity(showOrgKpis);

  return (
    <div className="space-y-6">
      {!showOrgKpis && implementerLabel && (
        <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2 bg-muted/20">
          Zobrazujú sa provízie pre realizátora <strong>{implementerLabel}</strong>.
        </p>
      )}

      {/*
        Fáza 3 (Finance Coherence) — RESOLVED gap z AUDIT_FINDINGS.md #4 (pôvodne `// AUDIT (Fáza 1, bod 3)`).
        Disclaimer je teraz viditeľný aj v dennom pohľade (predtým len v Pokročilom), pretože KPI nižšie
        kombinujú viacero truth-levelov (fact/legacy_import/workflow_only).
      */}
      <p className="text-[11px] text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
        {FINANCE_TRUTH_DISCLAIMER}
      </p>
      {showOrgKpis && (
        <p className="text-xs text-muted-foreground">
          Denné Financie — KPI, platby podľa entít a provízie realizátorov podľa auditovaných záznamov.
        </p>
      )}

      {showOrgKpis && <EntityPaymentsKpiGrid totals={entityPayments} />}

      {showOrgKpis && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KpiCard
            label="Provízie celkom"
            value={`${commissionSummary.potential.toFixed(0)} €`}
            accent="text-primary"
            hint="Potenciál podľa kanonickej zákazky — vyplatené z payout_records"
            breakdown={[
              { level: "payout_fact", amount: commissionSummary.paid },
              { level: "workflow_only", amount: commissionSummary.remaining },
            ]}
            onDetail={() => setDailyDetailKind("commission")}
            detailLabel="Detail provízií"
          />
          <KpiCard
            label="Náklady celkom"
            value={`${costSummary.total.toFixed(0)} €`}
            accent="text-orange-600"
            hint="Auditované náklady z cost_records (nie workflow expenses)"
            breakdown={[
              { level: "cost_fact", amount: costSummary.confirmed },
              { level: "legacy_import", amount: costSummary.legacy },
            ]}
            onDetail={() => setDailyDetailKind("cost")}
            detailLabel="Detail nákladov"
          />
        </section>
      )}

      {!showOrgKpis && commissionSummary.rowCount > 0 && (
        <section className="grid grid-cols-1 gap-3">
          <KpiCard
            label="Vaše provízie celkom"
            value={`${commissionSummary.potential.toFixed(0)} €`}
            accent="text-primary"
            hint="Potenciál · vyplatené z payout_records"
            breakdown={[
              { level: "payout_fact", amount: commissionSummary.paid },
              { level: "workflow_only", amount: commissionSummary.remaining },
            ]}
            onDetail={() => setDailyDetailKind("commission")}
            detailLabel="Detail"
          />
        </section>
      )}

      {showOrgKpis && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Zaplatené faktúry"
            value={String(dailyKpis.paidInvoices)}
            hint="Prenájmy — mesačné záznamy (rental_payments)"
            truthLevel="workflow_only"
          />
          <KpiCard
            label="Nezaplatené / fakturované"
            value={String(dailyKpis.unpaidInvoices)}
            hint="Čaká na úhradu"
            accent="text-amber-600"
            truthLevel="workflow_only"
          />
          <KpiCard
            label="Prijaté platby"
            value={`${dailyKpis.receivedSum.toFixed(0)} €`}
            accent="text-green-600"
            hint="Súčet potvrdených platieb a legacy importu — rozpis nižšie"
            breakdown={[
              { level: "payment_fact", amount: dailyKpis.paymentsConfirmed },
              { level: "legacy_import", amount: dailyKpis.paymentsLegacyImport },
            ]}
          />
          <KpiCard
            label="Čakajúce platby"
            value={`${dailyKpis.pendingSum.toFixed(0)} €`}
            accent="text-orange-500"
            hint="Faktúra + nezaplatené (rental_payments)"
            truthLevel="workflow_only"
          />
        </section>
      )}

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold">
            {showOrgKpis ? "Provízie podľa realizátora" : "Vaše provízie"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {showOrgKpis
              ? "commissions + payout_records + prenájom JSON (bez dvojitého počítania)"
              : "len váš implementer záznam"}
          </span>
        </div>
        {implementerTotals.length === 0 ? (
          <div className="p-4">
            <ScopedEmptyState
              reason={scopedEmpty.reason}
              title={scopedEmpty.title}
              body={scopedEmpty.body}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Realizátor</TableHead>
                <TableHead className="text-right">Vyplatené</TableHead>
                <TableHead className="text-right">Nezaplatené</TableHead>
                <TableHead className="text-right">Počet</TableHead>
                <TableHead>Truth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {implementerTotals.map(([name, t]) => {
                const paid = t.paidAudited;
                const truthLevel = resolveImplementerFinanceTruthLevel(t);
                return (
                <TableRow
                  key={name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetailImplementer(name)}
                >
                  <TableCell className="font-medium">
                    {formatImplementerLabel(name, historicalIdentity)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {fmtEur(paid)}
                    {t.paidWorkflowUnaudited > 0 && (
                      <div className="text-[9px] text-muted-foreground font-normal">
                        +{fmtEur(t.paidWorkflowUnaudited)} workflow
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">{fmtEur(t.unpaid)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.lineCount}</TableCell>
                  <TableCell>
                    <TruthLevelBadge level={truthLevel} />
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
          </div>
        )}
        {implementerTotals.length > 0 && (
          <p className="text-[10px] text-muted-foreground px-4 py-2 border-t border-border/60">
            Vyplatené: auditované sumy z <code className="text-[10px]">payout_records</code> (primárna pravda).
            Workflow provízie bez payoutu sú len diagnostika pod sumou. Nezaplatené: zostávajúca suma podľa
            kanonickej zákazky (potenciál mínus vyplatené) + JSON podiely bez materializovanej provízie. Rok{" "}
            {year}. Bez dvojitého započítania.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2 items-center">
        {showOrgKpis && (
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/rentals">Prenájmy</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/hosting">Hosting</Link>
            </Button>
          </>
        )}
        {showOrgKpis && reconciliationSummary.actionableCount > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-[10px] px-2"
            onClick={onOpenReconciliation}
          >
            {reconciliationSummary.actionableCount} položiek vyžaduje akciu v Zladení
          </Button>
        )}
        {showOrgKpis &&
          reconciliationSummary.actionableCount === 0 &&
          reconciliationSummary.advisoryCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] px-2 text-amber-600 border-amber-500/40"
              onClick={onOpenReconciliation}
            >
              {reconciliationSummary.advisoryCount} na kontrolu v Zladení
            </Button>
          )}
        {showDiagnostikaLink && (
          <Button size="sm" variant="ghost" className="text-xs" onClick={onOpenDiagnostika}>
            Diagnostika →
          </Button>
        )}
      </div>

      <FinanceImplementerDetailDialog
        open={!!detailImplementer}
        onOpenChange={(o) => !o && setDetailImplementer(null)}
        implementer={detailImplementer || ""}
        commissions={commissions}
        payoutRecords={payoutRecords}
        websites={websites}
        payments={payments}
        year={year}
      />

      <FinanceDailyDetailDialog
        open={dailyDetailKind === "commission"}
        onOpenChange={(o) => !o && setDailyDetailKind(null)}
        kind="commission"
        title={showOrgKpis ? `Provízie celkom · ${year}` : `Vaše provízie · ${year}`}
        subtitle="Odkiaľ provízia prišla — jeden riadok = jedna zákazka bez dvojitého počítania."
        rows={commissionDetailRows}
        commissionSummary={commissionSummary}
      />

      <FinanceDailyDetailDialog
        open={dailyDetailKind === "cost"}
        onOpenChange={(o) => !o && setDailyDetailKind(null)}
        kind="cost"
        title={`Náklady celkom · ${year}`}
        subtitle="Kam náklad odišiel — len auditované záznamy z cost_records."
        rows={costDetailRows}
        costSummary={costSummary}
      />
    </div>
  );
}

function AdvancedFinanceView({
  snapshot,
  financeCtx,
  raw,
  dismissals,
  commissionRules,
  commissionOverrides,
  reconciliationSummary,
  diagnostikaTab,
  year,
  searchParams,
  setSearchParams,
  onSaved,
}: {
  snapshot: ReturnType<typeof buildFinanceSnapshot>;
  financeCtx: any;
  raw: any;
  dismissals: IssueDismissalRow[];
  commissionRules: CommissionRule[];
  commissionOverrides: CommissionRuleOverride[];
  reconciliationSummary: ReconciliationIssueSummary;
  diagnostikaTab: FinanceDiagnostikaTab;
  year: number;
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams, opts?: { replace?: boolean }) => void;
  onSaved: () => void;
}) {
  const [showSettlement, setShowSettlement] = useState(diagnostikaTab === "settlement");

  const setDiagnostikaTab = (tab: FinanceDiagnostikaTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("advanced", "1");
    next.set("tab", tab);
    if (tab !== "records") next.delete("recordsKind");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
        Nástroje na zladenie výnimiek a výnimočné korekcie. Denné Financie sú v základnom pohľade.
      </p>

      <Tabs
        value={diagnostikaTab}
        onValueChange={(v) => {
          const tab = resolveFinanceDiagnostikaTab(v);
          if (tab === "settlement") setShowSettlement(true);
          setDiagnostikaTab(tab);
        }}
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="reconciliation">
            Zladenie
            {reconciliationSummary.actionableCount > 0 && (
              <span className="ml-1 text-red-500 font-medium">({reconciliationSummary.actionableCount})</span>
            )}
            {reconciliationSummary.actionableCount === 0 && reconciliationSummary.advisoryCount > 0 && (
              <span className="ml-1 text-muted-foreground">({reconciliationSummary.advisoryCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="records">Záznamy (korekcie)</TabsTrigger>
          {showSettlement && <TabsTrigger value="settlement">Vyúčtovanie</TabsTrigger>}
        </TabsList>

        {!showSettlement && (
          <div className="mt-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground"
              onClick={() => {
                setShowSettlement(true);
                setDiagnostikaTab("settlement");
              }}
            >
              Zobraziť hromadné vyúčtovanie
            </Button>
          </div>
        )}

        <TabsContent value="reconciliation" className="mt-4">
          <FinanceReconciliation
            snapshot={snapshot}
            ctx={financeCtx}
            year={year}
            dismissals={dismissals}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <FinanceRecordsCrud
            paymentRecords={raw.paymentRecords}
            payoutRecords={raw.payoutRecords}
            costRecords={raw.costRecords}
            onSaved={onSaved}
          />
        </TabsContent>

        {showSettlement && (
          <TabsContent value="settlement" className="mt-4">
            <FinanceSettlementDrafts
              ctx={financeCtx}
              rules={commissionRules}
              overrides={commissionOverrides}
              onSaved={onSaved}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent = "text-foreground",
  truthLevel,
  breakdown,
  onDetail,
  detailLabel = "Detail",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  /** Jediný truth-level pre celú kartu (napr. "workflow_only"). */
  truthLevel?: string;
  /** Pre kartu, ktorá je z princípu mixovaná — rozpis súm podľa truth-levelu. */
  breakdown?: { level: string; amount: number }[];
  onDetail?: () => void;
  detailLabel?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 ${onDetail ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
      role={onDetail ? "button" : undefined}
      tabIndex={onDetail ? 0 : undefined}
      onClick={onDetail}
      onKeyDown={
        onDetail
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDetail();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {truthLevel && <TruthLevelBadge level={truthLevel} />}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
      {breakdown && breakdown.filter((b) => b.amount > 0).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {breakdown
            .filter((b) => b.amount > 0)
            .map((b) => (
              <span key={b.level} className="inline-flex items-center gap-1">
                <TruthLevelBadge level={b.level} />
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {b.amount.toFixed(0)} €
                </span>
              </span>
            ))}
        </div>
      )}
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      {onDetail && (
        <div className="text-[10px] text-primary mt-2 font-medium">{detailLabel} →</div>
      )}
    </div>
  );
}

const ENTITY_KPI_ORDER: FinanceEntityKind[] = [
  "hosting",
  "project",
  "task",
  "marketing",
  "rental",
  "other",
];

function EntityPaymentsKpiGrid({ totals }: { totals: EntityPaymentTotals }) {
  const totalAmount = ENTITY_KPI_ORDER.reduce((s, k) => s + totals[k].amount, 0);
  const totalCount = ENTITY_KPI_ORDER.reduce((s, k) => s + totals[k].count, 0);
  const hasAny = totalCount > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Potvrdené platby podľa entity</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Len <TruthLevelBadge level="payment_fact" /> z payment_records — nie workflow stavy entít ani legacy
            import.
          </p>
        </div>
        {hasAny && (
          <div className="text-right">
            <div className="text-lg font-bold text-green-600 tabular-nums">{fmtEur(totalAmount)}</div>
            <div className="text-[10px] text-muted-foreground">{totalCount} záznamov</div>
          </div>
        )}
      </div>
      {!hasAny ? (
        <p className="text-xs text-muted-foreground py-2">
          Zatiaľ žiadne entity-linked payment facts (Hosting, Projekty, Úlohy, Marketing, Prenájmy).
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ENTITY_KPI_ORDER.map((kind) => {
            const bucket = totals[kind];
            if (bucket.count === 0) return null;
            return (
              <div key={kind} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">{FINANCE_ENTITY_KIND_LABELS[kind]}</div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400 tabular-nums">
                  {bucket.amount.toFixed(0)} €
                </div>
                <div className="text-[10px] text-muted-foreground">{bucket.count}×</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminFinance;
