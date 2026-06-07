import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Loader2, Search, ShieldAlert, LogOut, History } from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

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
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    document.title = "CRM Logy | Web na prenájom";
  }, [navigate]);

  useEffect(() => {
    if (authChecking) return;

    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }

    if (isAdmin) {
      void loadLogs();
      return;
    }

    setLoading(false);
  }, [authChecking, isAdmin, navigate, userId]);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    } else {
      setLogs((data || []) as LogRow[]);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

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
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/admin")} variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <History className="w-5 h-5 text-primary" />
                CRM Logy – História zmien
              </h1>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <section className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať podľa leadu, používateľa, hodnoty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
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
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Žiadne logy</div>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => {
                    const cfg = ACTION_CONFIG[log.action] || { label: log.action, className: "" };
                    return (
                      <TableRow key={log.id}>
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
                          <div className="text-xs text-muted-foreground">{log.lead_email || ""}</div>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default AdminLogs;
