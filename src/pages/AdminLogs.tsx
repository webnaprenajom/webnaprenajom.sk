import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Search, AlertTriangle, Info, Download } from "lucide-react";
import { adminCustomerHref, adminLeadHref } from "@/lib/adminNav";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { isCrmUser } from "@/lib/rbac/permissions";
import {
  leadLogsEmptyMessage,
  leadLogsNoAccessMessage,
  leadLogsScopeDescription,
  resolveLeadLogsLoadState,
} from "@/lib/leads/leadLogsPresentation";
import { downloadLeadLogsExport } from "@/lib/leads/leadLogsExport";

interface LogRow {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_by_id: string | null;
  created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  status: "Status",
  type: "Typ",
  assigned_to: "Kto rieši",
  temperature: "Teplota",
  source: "Zdroj",
  name: "Meno",
  email: "E-mail",
  phone: "Telefón",
  notes: "Poznámky",
  amount: "Suma",
  consultation_date: "Termín konzultácie",
  prize: "Výhra",
  wheel_spin: "Koleso šťastia",
  lead: "Lead",
};

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  created: { label: "Vytvorený lead", className: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  updated: { label: "Upravený", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  deleted: { label: "Vymazaný", className: "bg-red-500/15 text-red-500 border-red-500/30" },
  notification: { label: "Notifikácia", className: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  wheel_spin: { label: "Koleso šťastia", className: "bg-pink-500/15 text-pink-500 border-pink-500/30" },
};

const actionLabel = (log: { action: string; field: string | null }) => {
  if (log.action === "updated" && log.field) {
    const f = FIELD_LABEL[log.field] || log.field;
    return `Zmena: ${f}`;
  }
  return ACTION_CONFIG[log.action]?.label || log.action;
};

const AdminLogs = () => {
  const navigate = useNavigate();
  const access = useAdminAccess();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const loadLogs = useCallback(async () => {
    if (!isCrmUser(access.role)) {
      setLogs([]);
      setLoadError("Nemáte CRM rolu pre čítanie histórie.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("lead_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      setLoadError(error.message);
      setLogs([]);
      toast({
        title: "Chyba načítania histórie",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLogs((data || []) as LogRow[]);
    }
    setLoading(false);
  }, [access.role]);

  useEffect(() => {
    if (access.authChecking) return;
    document.title = "CRM Logy | Web na prenájom";
    void loadLogs();
  }, [access.authChecking, loadLogs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.lead_name || "").toLowerCase().includes(q) ||
          (l.lead_email || "").toLowerCase().includes(q) ||
          (l.changed_by_email || "").toLowerCase().includes(q) ||
          (l.field || "").toLowerCase().includes(q) ||
          (l.old_value || "").toLowerCase().includes(q) ||
          (l.new_value || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, actionFilter]);

  const loadState = resolveLeadLogsLoadState({
    loading: loading || access.authChecking,
    error: loadError,
    rowCount: logs.length,
    role: access.role,
  });

  const isFilteredEmpty = loadState === "ok" && filtered.length === 0;

  return (
    <AdminShell
      title="CRM Logy – História zmien"
      subtitle="Audit trail zmien leadov (nie Settings admin_audit_log)"
      backTo={{ label: "CRM", href: "/admin" }}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>{leadLogsScopeDescription(access.role)}</p>
        </div>

        <section className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať podľa leadu, používateľa, hodnoty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              disabled={loadState === "no_access" || loadState === "loading"}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-[200px]" disabled={loadState === "no_access" || loadState === "loading"}>
              <SelectValue placeholder="Akcia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky akcie</SelectItem>
              <SelectItem value="created">Vytvorené</SelectItem>
              <SelectItem value="updated">Upravené</SelectItem>
              <SelectItem value="deleted">Vymazané</SelectItem>
              <SelectItem value="notification">Notifikácie</SelectItem>
              <SelectItem value="wheel_spin">Koleso šťastia</SelectItem>
            </SelectContent>
          </Select>
          {loadState === "ok" && filtered.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadLeadLogsExport(filtered, "csv")}
              >
                <Download className="w-4 h-4 mr-1" /> CSV ({filtered.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadLeadLogsExport(filtered, "txt")}
              >
                <Download className="w-4 h-4 mr-1" /> TXT ({filtered.length})
              </Button>
            </div>
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
                {leadLogsNoAccessMessage(access.role)}
              </p>
            </div>
          ) : loadState === "error" ? (
            <div className="py-16 px-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
              <p className="font-medium text-sm">Chyba načítania</p>
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button size="sm" variant="outline" onClick={() => void loadLogs()}>
                Skúsiť znova
              </Button>
            </div>
          ) : loadState === "empty" || isFilteredEmpty ? (
            <div className="py-16 px-6 text-center text-muted-foreground text-sm">
              {leadLogsEmptyMessage(access.role, isFilteredEmpty)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Dátum</TableHead>
                    <TableHead>Akcia</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Pole</TableHead>
                    <TableHead>Pôvodná hodnota</TableHead>
                    <TableHead>Nová hodnota</TableHead>
                    <TableHead>Kto zmenil</TableHead>
                    <TableHead className="text-right">Odkaz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => {
                    const cfg = ACTION_CONFIG[log.action] || { label: log.action, className: "" };
                    const customerHref = log.lead_email ? adminCustomerHref(log.lead_email) : null;
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("sk-SK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`text-xs w-fit ${cfg.className}`}>
                              {actionLabel(log)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {log.changed_by_email ? (
                                <>od <span className="font-medium text-foreground">{log.changed_by_email}</span></>
                              ) : (
                                <span className="italic opacity-70">systém</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{log.lead_name || "—"}</div>
                          {log.lead_email ? (
                            customerHref ? (
                              <Link
                                to={customerHref}
                                className="text-xs text-primary hover:underline"
                              >
                                {log.lead_email}
                              </Link>
                            ) : (
                              <div className="text-xs text-muted-foreground">{log.lead_email}</div>
                            )
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.field ? (
                            <Badge variant="outline" className="text-xs">
                              {FIELD_LABEL[log.field] || log.field}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="whitespace-nowrap">
                            {log.old_value || <span className="italic opacity-60">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="whitespace-nowrap font-medium">
                            {log.new_value || <span className="italic opacity-60">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {log.changed_by_email ? (
                            <span className="font-medium text-foreground">{log.changed_by_email}</span>
                          ) : (
                            <span className="italic text-muted-foreground opacity-70">systém</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {log.lead_id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => navigate(adminLeadHref(log.lead_id!))}
                            >
                              Lead
                            </Button>
                          ) : customerHref ? (
                            <Link to={customerHref}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs">
                                Zákazník
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
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
