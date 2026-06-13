import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTimeline, type TimelineEvent } from "@/components/admin/CustomerTimeline";
import { CustomerCommunicationNote } from "@/components/admin/CustomerCommunicationNote";
import { CanonicalCustomerBadge, HeuristicDataBadge } from "@/components/admin/lookup/LinkStatusBadge";
import {
  CustomerQuickCreateDialogs,
  type QuickCreateKind,
} from "@/components/admin/customerWorkbench/CustomerQuickCreateDialogs";
import { CommunicationSummaryPanel } from "@/components/admin/customerWorkbench/CommunicationSummaryPanel";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import {
  COMMUNICATION_TIMELINE_FILTER_LABELS,
  type CommunicationTimelineFilter,
} from "@/lib/communication/events";
import { WORKBENCH_TABS, NOTE_STATUS_LABEL, logSummary } from "@/lib/customerWorkbench/constants";
import {
  applyWorkbenchUrlUpdate,
  parseWorkbenchCommFilter,
  parseWorkbenchTab,
  workbenchTabLabel,
} from "@/lib/customerWorkbench/urlState";
import { buildCustomerTimelineEvents } from "@/lib/customerWorkbench/timeline";
import {
  computeRecommendedActions,
  computeUnresolvedIssues,
  computeWorkbenchSummary,
} from "@/lib/customerWorkbench/summary";
import type {
  CustomerWorkbenchContext,
  CustomerWorkbenchData,
  WorkbenchTabId,
} from "@/lib/customerWorkbench/types";
import {
  classifyTaskLink,
  TASK_LINK_STRENGTH_LABELS,
} from "@/lib/crmLookup/taskCustomerLink";
import {
  getWorkbenchUsageRows,
  getWorkbenchUsageTotal,
  recordWorkbenchUsage,
} from "@/lib/customerWorkbench/usageTracking";
import { STATUS_CONFIG, type LeadStatus } from "@/components/admin/leads/constants";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Copy,
  ExternalLink,
  Filter,
  FolderKanban,
  Globe,
  ListTodo,
  Loader2,
  Lock,
  Mail,
  MessageSquarePlus,
  Phone,
  Plus,
  Server,
  Wallet,
} from "lucide-react";

interface Props {
  data: CustomerWorkbenchData;
  routeValue: string;
  loading: boolean;
  onReload: () => void;
}

function MetricChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "success"
        ? "border-green-500/40 bg-green-500/5"
        : "";
  return (
    <div
      className={`rounded-lg border border-border px-2.5 py-2 sm:px-3 sm:min-w-[100px] ${toneClass}`}
    >
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div className="text-base sm:text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EntityRow({
  title,
  subtitle,
  meta,
  href,
  actionLabel = "Detail",
}: {
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <li className="py-2.5 flex items-start justify-between gap-3 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
        {meta && <div className="mt-1 flex flex-wrap gap-1">{meta}</div>}
      </div>
      {href && (
        <Link to={href} className="shrink-0">
          <Button size="sm" variant="ghost" className="h-7 text-xs">
            {actionLabel}
          </Button>
        </Link>
      )}
    </li>
  );
}

export function CustomerWorkbench({ data, routeValue, loading, onReload }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAdminAccess();
  const activeTab = parseWorkbenchTab(searchParams);
  const commFilter = parseWorkbenchCommFilter(searchParams);

  const [quickCreate, setQuickCreate] = useState<QuickCreateKind | null>(null);

  const summary = useMemo(() => computeWorkbenchSummary(data, routeValue), [data, routeValue]);
  const timelineEvents = useMemo(() => buildCustomerTimelineEvents(data), [data]);
  const recommendedActions = useMemo(
    () => computeRecommendedActions(data, summary),
    [data, summary],
  );
  const unresolvedIssues = useMemo(
    () => computeUnresolvedIssues(data, summary),
    [data, summary],
  );

  const resolvedCustomerId =
    data.canonicalCustomer?.id ?? (data.viewMode === "id" ? routeValue : null);
  const primaryLead = data.leads[0];
  const clientName =
    data.canonicalCustomer?.display_name ||
    primaryLead?.name ||
    data.signatures[0]?.client_name ||
    summary.displayName;

  const workbenchCtx: CustomerWorkbenchContext = {
    resolvedCustomerId,
    emailKey: summary.emailKey,
    displayName: summary.displayName,
    clientName,
    primaryLeadId: primaryLead?.id ?? null,
    onReload,
  };

  const setTab = useCallback(
    (tab: WorkbenchTabId) => {
      setSearchParams((prev) => applyWorkbenchUrlUpdate(prev, { tab }));
    },
    [setSearchParams],
  );

  const setCommFilter = useCallback(
    (filter: CommunicationTimelineFilter) => {
      setSearchParams((prev) =>
        applyWorkbenchUrlUpdate(prev, { tab: "komunikacia", commFilter: filter }),
      );
    },
    [setSearchParams],
  );

  const openQuickCreate = useCallback((kind: QuickCreateKind) => {
    recordWorkbenchUsage("quick_create", kind);
    setQuickCreate(kind);
  }, []);

  useEffect(() => {
    recordWorkbenchUsage("tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "komunikacia" && commFilter !== "all") {
      recordWorkbenchUsage("comm_filter", commFilter);
    }
  }, [activeTab, commFilter]);

  const openCommunicationTab = useCallback(() => {
    setSearchParams((prev) =>
      applyWorkbenchUrlUpdate(prev, { tab: "komunikacia", commFilter: "all" }),
    );
  }, [setSearchParams]);

  const copyCustomerInfo = async () => {
    const lines = [
      summary.displayName,
      summary.emailKey ? `E-mail: ${summary.emailKey}` : null,
      summary.phone ? `Tel: ${summary.phone}` : null,
      resolvedCustomerId ? `Customer ID: ${resolvedCustomerId}` : null,
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "Skopírované do schránky" });
  };

  const leadStatusLabel = (status: string) =>
    STATUS_CONFIG[status as LeadStatus]?.label || status;

  const openTasks = data.tasks.filter((t) => t.status !== "done");
  const unpaidCommissions = data.commissions.filter((c) => c.payment_status !== "paid");
  const paidCommissions = data.commissions.filter((c) => c.payment_status === "paid");
  const activeProjects = data.notes.filter((n) => !["done", "archived"].includes(n.status));

  const usageRows = useMemo(() => getWorkbenchUsageRows().slice(0, 5), [activeTab, quickCreate]);
  const usageTotal = useMemo(() => getWorkbenchUsageTotal(), [activeTab, quickCreate]);

  const formatLastComm = summary.lastCommunicationAt
    ? new Date(summary.lastCommunicationAt).toLocaleDateString("sk-SK")
    : "—";

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary.hasAnyData) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card/50 p-6 sm:p-8 text-center space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">{summary.displayName || routeValue}</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Zatiaľ bez záznamov v CRM — workspace je pripravený na prvú aktivitu.
          </p>
          {data.viewMode === "email" && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Heuristický pohľad podľa e-mailu. Pre plnú prepojenosť vytvorte canonical
              zákazníka v Klienti.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 max-w-lg mx-auto">
          <Button size="sm" asChild className="w-full sm:w-auto">
            <Link to="/admin">Pipeline</Link>
          </Button>
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openQuickCreate("task")}>
            <ListTodo className="w-3.5 h-3.5 mr-1" /> Úloha
          </Button>
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openQuickCreate("project")}>
            <FolderKanban className="w-3.5 h-3.5 mr-1" /> Projekt
          </Button>
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => openQuickCreate("rental")}>
            <Globe className="w-3.5 h-3.5 mr-1" /> Prenájom
          </Button>
        </div>
        {(resolvedCustomerId || summary.emailKey) && (
          <div className="max-w-md mx-auto text-left">
            <CustomerCommunicationNote
              customerId={resolvedCustomerId}
              customerEmail={summary.emailKey || null}
              onSaved={onReload}
            />
          </div>
        )}
        <CustomerQuickCreateDialogs
          ctx={workbenchCtx}
          openKind={quickCreate}
          onClose={() => setQuickCreate(null)}
          onSaved={onReload}
        />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Klientsky workspace
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{summary.displayName}</h1>
              {data.viewMode === "id" && data.canonicalCustomer ? (
                <CanonicalCustomerBadge />
              ) : (
                <HeuristicDataBadge />
              )}
              <Badge className={`text-[10px] ${summary.lifecycle.tone}`} variant="outline">
                {summary.lifecycle.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              {summary.emailKey && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {summary.emailKey}
                </span>
              )}
              {summary.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {summary.phone}
                </span>
              )}
              {clientName !== summary.displayName && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {clientName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Posledná komunikácia: {formatLastComm}
              </span>
            </div>
          </div>
          {primaryLead && (
            <Button size="sm" variant="default" asChild>
              <Link to={`/admin?lead=${primaryLead.id}`}>Hlavný lead</Link>
            </Button>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 pt-2 border-t border-border/60">
          <MetricChip label="Projekty" value={summary.activeProjectsCount} />
          <MetricChip label="Prenájmy" value={summary.activeRentalsCount} />
          <MetricChip label="Hosting" value={summary.hostingCount} />
          <MetricChip
            label="Otvorené úlohy"
            value={
              summary.openTasksCount > 0
                ? `${summary.openTasksCount} (${summary.openTasksCustomerLinked} prep.)`
                : "0"
            }
            tone={summary.openTasksLegacyOnly > 0 ? "warning" : "default"}
          />
          <MetricChip
            label="Neuhradené"
            value={
              summary.unpaidCommissionsCount > 0
                ? `${summary.unpaidCommissionsCount} · ${summary.unpaidCommissionsTotal.toFixed(0)} €`
                : "0"
            }
            tone={summary.unpaidCommissionsCount > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      {/* Action bar */}
      <section className="rounded-xl border border-border bg-card/80 px-2 py-2 sm:px-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
        <Button size="sm" variant="secondary" className="shrink-0 h-8 text-xs" onClick={openCommunicationTab}>
          <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Poznámka
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => openQuickCreate("task")}>
          <ListTodo className="w-3.5 h-3.5 mr-1" /> Úloha
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => openQuickCreate("project")}>
          <FolderKanban className="w-3.5 h-3.5 mr-1" /> Projekt
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => openQuickCreate("rental")}>
          <Globe className="w-3.5 h-3.5 mr-1" /> Prenájom
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => openQuickCreate("hosting")}>
          <Server className="w-3.5 h-3.5 mr-1" /> Hosting
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => openQuickCreate("commission")}>
          <Wallet className="w-3.5 h-3.5 mr-1" /> Provízia
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={openCommunicationTab}>
          <Filter className="w-3.5 h-3.5 mr-1" /> Komunikácia
        </Button>
        <Button size="sm" variant="ghost" className="shrink-0 h-8 text-xs" onClick={() => void copyCustomerInfo()}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Kopírovať
        </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4 items-start">
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as WorkbenchTabId)} className="min-w-0">
          <TabsList className="w-full flex h-auto gap-1 bg-muted/50 p-1 overflow-x-auto flex-nowrap justify-start">
            {WORKBENCH_TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="text-xs shrink-0 min-w-[72px] px-2.5"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {activeTab !== "prehlad" && (
            <p className="text-[10px] text-muted-foreground mt-2 px-0.5">
              Záložka: <span className="font-medium text-foreground">{workbenchTabLabel(activeTab)}</span>
              {activeTab === "komunikacia" && commFilter !== "all" && (
                <span>
                  {" "}
                  · {COMMUNICATION_TIMELINE_FILTER_LABELS[commFilter]}
                </span>
              )}
            </p>
          )}

          {/* Prehľad */}
          <TabsContent value="prehlad" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">Odporúčané kroky</h3>
                <ul className="space-y-2 text-xs">
                  {recommendedActions.map((a) => (
                    <li key={a.id}>
                      {a.href ? (
                        <Link
                          to={a.href}
                          className={`block rounded-lg border px-3 py-2 hover:bg-muted/50 ${
                            a.tone === "warning" ? "border-amber-500/40" : "border-border"
                          }`}
                        >
                          <div className="font-medium">{a.label}</div>
                          {a.detail && (
                            <div className="text-muted-foreground mt-0.5">{a.detail}</div>
                          )}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => a.tab && setTab(a.tab)}
                          className={`w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50 ${
                            a.tone === "warning" ? "border-amber-500/40" : "border-border"
                          }`}
                        >
                          <div className="font-medium">{a.label}</div>
                          {a.detail && (
                            <div className="text-muted-foreground mt-0.5">{a.detail}</div>
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Otvorené body
                </h3>
                {unresolvedIssues.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Žiadne urgentné problémy.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {unresolvedIssues.map((issue) => (
                      <li key={issue} className="flex gap-2 text-amber-800 dark:text-amber-300">
                        <span className="text-amber-500">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <CustomerTimeline
              events={timelineEvents}
              limit={8}
              title="Posledná aktivita"
              loading={false}
              error={data.commLoadError}
            />

            {resolvedCustomerId && (
              <CommunicationSummaryPanel customerId={resolvedCustomerId} />
            )}

            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <QuickStatCard
                label="Aktívne projekty"
                value={activeProjects.length}
                onClick={() => setTab("projekty")}
              />
              <QuickStatCard
                label="Otvorené úlohy"
                value={openTasks.length}
                subtitle={`${summary.openTasksCustomerLinked} prepojených`}
                onClick={() => setTab("ulohy")}
              />
              <QuickStatCard
                label="Leady"
                value={data.leads.length}
                href={primaryLead ? `/admin?lead=${primaryLead.id}` : "/admin"}
              />
            </div>
          </TabsContent>

          {/* Komunikácia */}
          <TabsContent value="komunikacia" className="space-y-4 mt-4" id="workbench-communication">
            {resolvedCustomerId && (
              <CommunicationSummaryPanel customerId={resolvedCustomerId} />
            )}
            <CustomerTimeline
              events={timelineEvents}
              limit={20}
              title="Komunikácia a timeline"
              loading={false}
              error={data.commLoadError}
              showCommunicationFilters
              communicationFilter={commFilter}
              onCommunicationFilterChange={setCommFilter}
            />
            {(resolvedCustomerId || summary.emailKey) && (
              <CustomerCommunicationNote
                customerId={resolvedCustomerId}
                customerEmail={summary.emailKey || null}
                onSaved={onReload}
              />
            )}
          </TabsContent>

          {/* Projekty */}
          <TabsContent value="projekty" className="mt-4">
            <TabPanel
              title="Projekty"
              count={data.notes.length}
              createLabel="Nový projekt"
              onCreate={() => openQuickCreate("project")}
              moduleHref="/admin/projects"
            >
              {data.notes.length === 0 ? (
                <EmptyTab text="Žiadne projekty pre tohto klienta." />
              ) : (
                <ul>
                  {data.notes.map((n) => (
                    <EntityRow
                      key={n.id}
                      title={n.title}
                      subtitle={n.url || undefined}
                      meta={
                        <>
                          <Badge variant="outline" className="text-[10px]">
                            {NOTE_STATUS_LABEL[n.status] || n.status}
                          </Badge>
                          {n.has_credentials && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> prístupy
                            </Badge>
                          )}
                        </>
                      }
                      href={`/admin/projects/${n.id}`}
                    />
                  ))}
                </ul>
              )}
            </TabPanel>
          </TabsContent>

          {/* Prenájmy */}
          <TabsContent value="prenajmy" className="mt-4">
            <TabPanel
              title="Prenájmy webov"
              count={data.rentals.length}
              createLabel="Nový prenájom"
              onCreate={() => openQuickCreate("rental")}
              moduleHref="/admin/rentals"
            >
              {data.rentals.length === 0 ? (
                <EmptyTab text="Žiadne prenájmy spárované cez meno klienta." />
              ) : (
                <ul>
                  {data.rentals.map((r) => (
                    <EntityRow
                      key={r.id}
                      title={r.name}
                      subtitle={
                        r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {r.url}
                          </a>
                        ) : undefined
                      }
                      meta={
                        <span className="font-semibold">
                          {Number(r.monthly_price).toLocaleString("sk-SK")} € / mes.
                        </span>
                      }
                      href="/admin/rentals"
                      actionLabel="Modul"
                    />
                  ))}
                </ul>
              )}
            </TabPanel>
          </TabsContent>

          {/* Hosting */}
          <TabsContent value="hosting" className="mt-4">
            <TabPanel
              title="Hosting"
              count={data.hosting.length}
              createLabel="Nový hosting"
              onCreate={() => openQuickCreate("hosting")}
              moduleHref="/admin/hosting"
            >
              {data.hosting.length === 0 ? (
                <EmptyTab text="Žiadny hosting pre tohto klienta." />
              ) : (
                <ul>
                  {data.hosting.map((h) => (
                    <EntityRow
                      key={h.id}
                      title={h.client_name || h.provider || "Hosting"}
                      subtitle={h.provider || undefined}
                      meta={
                        <>
                          {!h.active && (
                            <Badge variant="outline" className="text-[10px]">
                              Neaktívny
                            </Badge>
                          )}
                          {h.monthly_price != null && (
                            <span>{h.monthly_price} €/mes</span>
                          )}
                        </>
                      }
                      href={`/admin/hosting/${h.id}`}
                    />
                  ))}
                </ul>
              )}
            </TabPanel>
          </TabsContent>

          {/* Financie */}
          <TabsContent value="financie" className="space-y-4 mt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricChip label="Vyplatené" value={paidCommissions.length} tone="success" />
              <MetricChip
                label="Neuhradené"
                value={unpaidCommissions.length}
                tone={unpaidCommissions.length > 0 ? "warning" : "default"}
              />
              <MetricChip
                label="Suma neuhradených"
                value={`${summary.unpaidCommissionsTotal.toFixed(2)} €`}
                tone={summary.unpaidCommissionsTotal > 0 ? "warning" : "default"}
              />
            </div>
            <TabPanel
              title="Provízie klienta"
              count={data.commissions.length}
              createLabel="Pridať províziu"
              onCreate={() => openQuickCreate("commission")}
              moduleHref="/admin/finance?advanced=1&legacy=commissions"
            >
              {data.commissions.length === 0 ? (
                <EmptyTab text="Žiadne provízie viazané na klienta." />
              ) : (
                <ul>
                  {data.commissions.map((c) => (
                    <EntityRow
                      key={c.id}
                      title={c.title}
                      subtitle={new Date(c.date).toLocaleDateString("sk-SK")}
                      meta={
                        <>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              c.payment_status === "paid"
                                ? "border-green-500/40 text-green-700"
                                : "border-amber-500/40 text-amber-700"
                            }`}
                          >
                            {c.payment_status === "paid" ? "Vyplatené" : "Neuhradené"}
                          </Badge>
                          <span className="font-semibold">{Number(c.amount).toFixed(2)} €</span>
                        </>
                      }
                      href="/admin/finance?advanced=1&legacy=commissions"
                      actionLabel="Financie"
                    />
                  ))}
                </ul>
              )}
            </TabPanel>
          </TabsContent>

          {/* Úlohy */}
          <TabsContent value="ulohy" className="mt-4">
            <TabPanel
              title="Úlohy"
              count={data.tasks.length}
              createLabel="Nová úloha"
              onCreate={() => openQuickCreate("task")}
              moduleHref="/admin/tasks"
            >
              {data.tasks.length > 0 && (
                <p className="text-[11px] text-muted-foreground mb-3 px-1">
                  {summary.openTasksCustomerLinked} prepojených na zákazníka ·{" "}
                  {summary.openTasksLegacyOnly} bez customer_id
                </p>
              )}
              {data.tasks.length === 0 ? (
                <EmptyTab text="Žiadne úlohy — vytvorte novú alebo prepojte existujúcu v module Úlohy." />
              ) : (
                <ul>
                  {data.tasks.map((t) => {
                    const linkStrength = classifyTaskLink(t);
                    return (
                    <EntityRow
                      key={t.id}
                      title={t.title}
                      subtitle={
                        <>
                          {t.status}
                          {t.due_date && (
                            <span>
                              {" "}
                              · termín {new Date(t.due_date).toLocaleDateString("sk-SK")}
                            </span>
                          )}
                        </>
                      }
                      meta={
                        <>
                          <Badge
                            variant={linkStrength === "customer_id" ? "default" : "outline"}
                            className={`text-[10px] ${
                              linkStrength === "client_name"
                                ? "border-amber-500/40 text-amber-700"
                                : ""
                            }`}
                          >
                            {TASK_LINK_STRENGTH_LABELS[linkStrength]}
                          </Badge>
                          {t.amount != null && t.amount > 0 && (
                            <span className="font-semibold">
                              {Number(t.amount).toLocaleString("sk-SK")} €
                            </span>
                          )}
                        </>
                      }
                      href="/admin/tasks"
                      actionLabel="Modul"
                    />
                    );
                  })}
                </ul>
              )}
            </TabPanel>
          </TabsContent>

          {/* História */}
          <TabsContent value="historia" className="space-y-4 mt-4">
            <CustomerTimeline
              events={timelineEvents}
              limit={30}
              title="Kompletná história"
              loading={false}
              error={data.commLoadError}
            />
            {data.logs.length > 0 && (
              <section className="rounded-xl border border-border bg-card">
                <div className="px-4 py-3 border-b border-border flex justify-between items-center">
                  <h3 className="text-sm font-semibold">CRM logy leadov</h3>
                  <Link to="/admin/logs">
                    <Button size="sm" variant="ghost" className="h-7 text-xs">
                      Všetky logy <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
                <ul className="px-4 text-xs divide-y divide-border">
                  {data.logs.map((log) => (
                    <EntityRow
                      key={log.id}
                      title={logSummary(log)}
                      subtitle={new Date(log.created_at).toLocaleString("sk-SK")}
                      href={log.lead_id ? `/admin?lead=${log.lead_id}` : "/admin/logs"}
                      actionLabel={log.lead_id ? "Lead" : "Logy"}
                    />
                  ))}
                </ul>
              </section>
            )}
            {data.leads.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold mb-2">Leady v pipeline</h3>
                <ul className="text-xs space-y-2">
                  {data.leads.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="font-medium">{l.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {leadStatusLabel(l.status)}
                        </Badge>
                        <Link to={`/admin?lead=${l.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">
                            Otvoriť
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </TabsContent>
        </Tabs>

        {/* Context panel */}
        <aside className="hidden xl:block space-y-3 sticky top-4">
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kontext
            </h3>
            {primaryLead ? (
              <div className="text-xs space-y-1">
                <div className="font-medium">{primaryLead.name}</div>
                <Badge variant="outline" className="text-[10px]">
                  {leadStatusLabel(primaryLead.status)}
                </Badge>
                {primaryLead.assigned_to && (
                  <p className="text-muted-foreground">Rieši: {primaryLead.assigned_to}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Bez leadu v pipeline.</p>
            )}
          </section>

          {unresolvedIssues.length > 0 && (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                Pozor
              </h3>
              <ul className="text-[11px] space-y-1 text-amber-900 dark:text-amber-200">
                {unresolvedIssues.slice(0, 4).map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            </section>
          )}

          {usageTotal > 0 && isAdmin && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Adopcia workspace (admin)
              </h3>
              <p className="text-[10px] text-muted-foreground">
                Lokálne počítadlo v tomto prehliadači · {usageTotal} akcií
              </p>
              <ul className="text-[10px] space-y-1">
                {usageRows.map((row) => (
                  <li key={`${row.kind}:${row.value}`} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {row.kind === "tab" && "Záložka"}
                      {row.kind === "quick_create" && "Vytvoriť"}
                      {row.kind === "comm_filter" && "Kom. filter"} · {row.value}
                    </span>
                    <span className="font-medium tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(data.signatures.length > 0 || data.designs.length > 0 || isAdmin) && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
              <h3 className="font-semibold">Súvisiace moduly</h3>
              <div className="flex flex-col gap-1">
                {isAdmin && (
                  <>
                    <Link to="/admin/rollout-health" className="text-primary hover:underline">
                      Diagnostika identity (admin)
                    </Link>
                    <Link to="/admin/communication-ops" className="text-primary hover:underline">
                      Diagnostika e-mail sync (admin)
                    </Link>
                  </>
                )}
                {data.signatures.length > 0 && (
                  <Link to="/admin/signatures" className="text-primary hover:underline">
                    Podpisy ({data.signatures.length})
                  </Link>
                )}
                {data.designs.length > 0 && (
                  <Link to="/admin/designs" className="text-primary hover:underline">
                    Dizajny ({data.designs.length})
                  </Link>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <CustomerQuickCreateDialogs
        ctx={workbenchCtx}
        openKind={quickCreate}
        onClose={() => setQuickCreate(null)}
        onSaved={onReload}
      />
    </div>
  );
}

function TabPanel({
  title,
  count,
  createLabel,
  onCreate,
  moduleHref,
  children,
}: {
  title: string;
  count: number;
  createLabel?: string;
  onCreate?: () => void;
  moduleHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border flex-wrap">
        <h3 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground font-normal">({count})</span>
        </h3>
        <div className="flex gap-1">
          {createLabel && onCreate && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onCreate}>
              <Plus className="w-3 h-3 mr-1" />
              {createLabel}
            </Button>
          )}
          {moduleHref && (
            <Link to={moduleHref}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                Modul <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic py-4">{text}</p>;
}

function QuickStatCard({
  label,
  value,
  subtitle,
  onClick,
  href,
}: {
  label: string;
  value: number;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        to={href}
        className="rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors w-full"
    >
      {inner}
    </button>
  );
}
