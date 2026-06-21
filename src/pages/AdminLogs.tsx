import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Download, Info, Loader2, Search, AlertTriangle } from "lucide-react";
import { adminCustomerHref, adminLeadHref } from "@/lib/adminNav";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useStableAccessLoad } from "@/hooks/useStableAccessLoad";
import { isCrmUser, isOwner } from "@/lib/rbac/permissions";
import { collectHistoryFilterOptions, filterHistoryEntries } from "@/lib/history/filterHistory";
import { downloadHistoryExport } from "@/lib/history/export";
import { loadCrmHistory } from "@/lib/history/loadCrmHistory";
import { historyEntityTypeLabel } from "@/lib/history/labels";
import {
  historyEmptyMessage,
  historyNoAccessMessage,
  historyScopeDescription,
  resolveHistoryLoadState,
} from "@/lib/history/presentation";
import type { HistoryEntry, HistoryFilters } from "@/lib/history/types";
import { DEFAULT_HISTORY_FILTERS } from "@/lib/history/types";

const ACTION_BADGE: Record<string, string> = {
  created: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  entity_created: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  updated: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  entity_updated: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  deleted: "bg-red-500/15 text-red-500 border-red-500/30",
  entity_deleted: "bg-red-500/15 text-red-500 border-red-500/30",
  notification: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  wheel_spin: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  payment_recorded: "bg-green-500/15 text-green-700 border-green-500/30",
  payout_recorded: "bg-green-500/15 text-green-700 border-green-500/30",
  cost_recorded: "bg-green-500/15 text-green-700 border-green-500/30",
};

function actionBadgeClass(actionType: string): string {
  if (actionType.startsWith("updated_")) return ACTION_BADGE.updated;
  return ACTION_BADGE[actionType] ?? "bg-muted text-muted-foreground";
}

function entityHref(entry: HistoryEntry): string | null {
  if (entry.entityType === "lead" && entry.entityId) return adminLeadHref(entry.entityId);
  if (entry.entityType === "rental_websites" && entry.entityId) return `/admin/rentals?website=${entry.entityId}`;
  if (entry.entityType === "hosting_records" && entry.entityId) return `/admin/hosting/${entry.entityId}`;
  if (entry.entityType === "project_notes" && entry.entityId) return `/admin/projects/${entry.entityId}`;
  if (entry.entityType === "tasks" && entry.entityId) return `/admin/tasks/${entry.entityId}`;
  if (entry.entityType === "customer" && entry.entityId) return `/admin/customer/${entry.entityId}`;
  if (entry.entityType === "lead" && entry.detail?.lead_email) {
    const href = adminCustomerHref(String(entry.detail.lead_email));
    if (href) return href;
  }
  return null;
}

function DetailPanel({ entry }: { entry: HistoryEntry }) {
  const href = entityHref(entry);
  return (
    <div className="rounded-md bg-muted/40 p-3 text-xs space-y-2 mt-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <p>
          <span className="text-muted-foreground">Typ entity:</span>{" "}
          {historyEntityTypeLabel(entry.entityType)}
        </p>
        <p>
          <span className="text-muted-foreground">ID:</span>{" "}
          <span className="font-mono text-[10px]">{entry.entityId ?? "—"}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Zdroj:</span> {entry.sourceKind}
        </p>
        <p>
          <span className="text-muted-foreground">Aktor ID:</span>{" "}
          <span className="font-mono text-[10px]">{entry.actorId ?? "—"}</span>
        </p>
      </div>
      {entry.detail && (
        <pre className="text-[10px] whitespace-pre-wrap break-all bg-background/60 rounded p-2 border overflow-x-auto max-h-40">
          {JSON.stringify(entry.detail, null, 2)}
        </pre>
      )}
      {href && (
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={href}>Otvoriť entitu</Link>
        </Button>
      )}
    </div>
  );
}

const AdminLogs = () => {
  const access = useAdminAccess();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [auditIncluded, setAuditIncluded] = useState(true);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadHistory = useCallback(async () => {
    if (!isCrmUser(access.role)) {
      setEntries([]);
      setLoadError("Nemáte CRM rolu pre čítanie histórie.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const result = await loadCrmHistory({ includeAuditLog: isOwner(access.role) });
    setAuditIncluded(!result.auditLogSkipped && isOwner(access.role));
    if (result.errors.length && result.entries.length === 0) {
      const msg = result.errors.join("; ");
      setLoadError(msg);
      setEntries([]);
      toast({ title: "Chyba načítania histórie", description: msg, variant: "destructive" });
    } else {
      if (result.errors.length) {
        toast({
          title: "Čiastočné načítanie histórie",
          description: result.errors.join("; "),
        });
      }
      setEntries(result.entries);
      setLoadError(null);
    }
    setLoading(false);
  }, [access.role]);

  useStableAccessLoad(access.authChecking, access.userId, access.role, () => {
    document.title = "CRM História | Web na prenájom";
    void loadHistory();
  });

  const filtered = useMemo(() => filterHistoryEntries(entries, filters), [entries, filters]);
  const filterOptions = useMemo(() => collectHistoryFilterOptions(entries), [entries]);

  const loadState = resolveHistoryLoadState({
    loading: loading || access.authChecking,
    error: loadError,
    rowCount: entries.length,
    role: access.role,
  });

  const isFilteredEmpty = loadState === "ok" && filtered.length === 0;
  const disabled = loadState === "no_access" || loadState === "loading";

  return (
    <AdminShell
      title="História CRM"
      subtitle="Jednotný prehľad zmien naprieč CRM — leady, admin akcie, financie a ďalšie"
      backTo={{ label: "CRM", href: "/admin" }}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>{historyScopeDescription(access.role, auditIncluded)}</p>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hľadať v súhrne, entite, akcii, module..."
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="pl-9"
                disabled={disabled}
              />
            </div>
            {loadState === "ok" && filtered.length > 0 && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => downloadHistoryExport(filtered, "csv")}>
                  <Download className="w-4 h-4 mr-1" /> CSV ({filtered.length})
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadHistoryExport(filtered, "txt")}>
                  <Download className="w-4 h-4 mr-1" /> TXT ({filtered.length})
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
              disabled={disabled}
              aria-label="Od dátumu"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter("dateTo", e.target.value)}
              disabled={disabled}
              aria-label="Do dátumu"
            />
            <Select value={filters.module} onValueChange={(v) => setFilter("module", v)} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Modul" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky moduly</SelectItem>
                {filterOptions.modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.actionType}
              onValueChange={(v) => setFilter("actionType", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Akcia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky akcie</SelectItem>
                {filterOptions.actionTypes.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.entityType}
              onValueChange={(v) => setFilter("entityType", v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Typ entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky entity</SelectItem>
                {filterOptions.entityTypes.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {historyEntityTypeLabel(e.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filterOptions.actors.length > 1 && (
            <Select value={filters.actor} onValueChange={(v) => setFilter("actor", v)} disabled={disabled}>
              <SelectTrigger className="sm:max-w-xs">
                <SelectValue placeholder="Aktor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetci aktéri</SelectItem>
                {filterOptions.actors.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {loadState === "loading" ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : loadState === "no_access" ? (
            <div className="py-16 px-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
              <p className="font-medium text-sm">Prístup zamietnutý</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {historyNoAccessMessage(access.role)}
              </p>
            </div>
          ) : loadState === "error" ? (
            <div className="py-16 px-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
              <p className="font-medium text-sm">Chyba načítania</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button size="sm" variant="outline" onClick={() => void loadHistory()}>
                Skúsiť znova
              </Button>
            </div>
          ) : loadState === "empty" || isFilteredEmpty ? (
            <div className="py-16 px-6 text-center text-muted-foreground text-sm">
              {historyEmptyMessage(access.role, isFilteredEmpty)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="whitespace-nowrap">Dátum</TableHead>
                    <TableHead>Aktor</TableHead>
                    <TableHead>Modul</TableHead>
                    <TableHead>Akcia</TableHead>
                    <TableHead>Súhrn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const expanded = expandedId === entry.id;
                    const href = entityHref(entry);
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/30 align-top">
                        <TableCell className="p-2">
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => setExpandedId(expanded ? null : entry.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Zbaliť detail" : "Rozbaliť detail"}
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(entry.occurredAt).toLocaleString("sk-SK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {entry.actorName ? (
                            <span className="font-medium">{entry.actorName}</span>
                          ) : (
                            <span className="italic text-muted-foreground">systém</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {entry.module}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs w-fit ${actionBadgeClass(entry.actionType)}`}
                          >
                            {entry.actionLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{entry.summary}</div>
                          {entry.entityLabel && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {href ? (
                                <Link to={href} className="text-primary hover:underline">
                                  {entry.entityLabel}
                                </Link>
                              ) : (
                                entry.entityLabel
                              )}
                            </div>
                          )}
                          {expanded && <DetailPanel entry={entry} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
};

export default AdminLogs;
