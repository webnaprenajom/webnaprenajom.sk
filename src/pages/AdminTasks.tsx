import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminLongTextField } from "@/components/admin/AdminLongTextField";
import { LeadClientPicker, type LeadOption } from "@/components/admin/LeadClientPicker";
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
import { useAccessContext } from "@/hooks/useAccessContext";
import { useCrmDraft } from "@/hooks/useCrmDraft";
import { useCrmViewRestore } from "@/hooks/useCrmViewRestore";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { buildDraftKey, clearCrmDraft } from "@/lib/crmPersistence/draftStore";
import { clearCrmViewState } from "@/lib/crmPersistence/viewRestoreStore";
import { filterTasksForUser } from "@/lib/rbac/scopeHelpers";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  UserRound,
  ExternalLink,
} from "lucide-react";
import {
  adminLeadHref,
  buildClientNameEmailMap,
  customerHrefByClientName,
  adminCustomerHrefById,
} from "@/lib/adminNav";
import { resolveTaskCustomerFields, classifyTaskLink, TASK_LINK_STRENGTH_LABELS } from "@/lib/crmLookup/taskCustomerLink";
import {
  isLegacyTaskFinance,
  isTaskFinanceStatus,
  normalizeTaskFinancePayload,
  TASK_FINANCE_DEPRECATION_NOTE,
  taskParentLinkError,
  taskStatusOptionsForForm,
} from "@/lib/tasks/taskFinanceModel";

type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "deposit_received"
  | "send_final_invoice"
  | "paid"
  | "done";
type TaskPriority = "low" | "normal" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  lead_id: string | null;
  customer_id: string | null;
  assignee: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  amount: number;
  deposit: number;
  created_at: string;
}

type TaskForm = ReturnType<typeof emptyForm>;

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "Na rade", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  in_progress: { label: "Prebieha", className: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  blocked: { label: "Blokované", className: "bg-red-500/15 text-red-500 border-red-500/30" },
  deposit_received: { label: "Prijatá záloha", className: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  send_final_invoice: { label: "Poslať final FA", className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  paid: { label: "Uhradené", className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  done: { label: "Hotové", className: "bg-green-500/15 text-green-500 border-green-500/30" },
};

const STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "deposit_received",
  "send_final_invoice",
  "paid",
  "done",
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Nízka", className: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normálna", className: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  high: { label: "Vysoká", className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  urgent: { label: "Urgentné", className: "bg-red-500/20 text-red-400 border-red-500/40" },
};

const ASSIGNEES = ["Peter", "Maroš", "Matuš"];

const emptyForm = () => ({
  id: "",
  title: "",
  description: "",
  client_name: "",
  lead_id: "",
  customer_id: "",
  customer_email: "",
  assignee: "",
  status: "todo" as TaskStatus,
  priority: "normal" as TaskPriority,
  due_date: "",
  amount: "",
  deposit: "",
});

const taskToForm = (t: Task): TaskForm => ({
  id: t.id,
  title: t.title,
  description: t.description ?? "",
  client_name: t.client_name ?? "",
  lead_id: t.lead_id ?? "",
  customer_id: t.customer_id ?? "",
  customer_email: "",
  assignee: t.assignee ?? "",
  status: t.status,
  priority: t.priority,
  due_date: t.due_date ?? "",
  amount: String(t.amount ?? ""),
  deposit: String(t.deposit ?? ""),
});

const AdminTasks = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formBaseline, setFormBaseline] = useState<TaskForm>(emptyForm());
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const accessCtx = useAccessContext();

  useEffect(() => {
    document.title = "Úlohy | CRM";
  }, []);

  useEffect(() => {
    if (accessCtx.authChecking) return;
    void load();
  }, [accessCtx.authChecking, accessCtx.role]);

  const load = async () => {
    setLoading(true);
    const [tasksRes, leadsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("id,name,email"),
    ]);
    if (tasksRes.error) {
      toast({ title: "Chyba", description: tasksRes.error.message, variant: "destructive" });
    } else {
      setItems(filterTasksForUser((tasksRes.data || []) as Task[], accessCtx));
    }
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
      setLeadOptions(
        leadsRes.data.map((l) => ({
          id: l.id,
          name: (l.name || "").trim() || l.email || "—",
          email: l.email,
        })),
      );
    } else if (leadsRes.error) {
      toast({
        title: "Chyba načítania leadov",
        description: leadsRes.error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const openNew = useCallback((opts?: { reset?: boolean }) => {
    if (opts?.reset !== false) {
      const blank = emptyForm();
      setFormBaseline(blank);
      setForm(blank);
    }
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((t: Task) => {
    const baseline = taskToForm(t);
    setFormBaseline(baseline);
    setForm(baseline);
    setDialogOpen(true);
  }, []);

  const { discardDraft: discardTaskDraft, clearDraft: clearTaskDraft } = useCrmDraft({
    modalId: "task-edit",
    route: "/admin/tasks",
    entityId: form.id ? form.id : "new",
    isActive: dialogOpen,
    data: form,
    baseline: formBaseline,
    onRestore: (draft) => setForm(draft as TaskForm),
  });

  const closeTaskDialog = useCallback(() => {
    clearTaskDraft();
    clearCrmViewState();
    setDialogOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [clearTaskDraft, searchParams, setSearchParams]);

  const discardTaskChanges = useCallback(() => {
    discardTaskDraft();
    clearCrmViewState();
  }, [discardTaskDraft]);

  useCrmViewRestore({
    route: "/admin/tasks",
    modalId: "task-edit",
    entityId: dialogOpen ? (form.id || "new") : null,
    isModalOpen: dialogOpen,
    query: dialogOpen ? { task: form.id || "new" } : undefined,
    enabled: !loading,
    onRestore: (state) => {
      if (dialogOpen || state.modalId !== "task-edit") return;
      if (state.entityId && state.entityId !== "new") {
        const t = items.find((x) => x.id === state.entityId);
        if (t) openEdit(t);
        else clearCrmViewState();
        return;
      }
      openNew({ reset: false });
    },
  });

  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (!taskParam || loading) return;
    if (taskParam === "new") {
      if (!dialogOpen) openNew({ reset: false });
      return;
    }
    if (form.id === taskParam && dialogOpen) return;
    const t = items.find((x) => x.id === taskParam);
    if (t) {
      openEdit(t);
      return;
    }
    clearCrmDraft(buildDraftKey("task-edit", taskParam));
    clearCrmViewState();
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [searchParams, items, loading, dialogOpen, form.id, openEdit, openNew, setSearchParams]);

  useEffect(() => {
    if (!dialogOpen) return;
    const param = form.id || "new";
    const next = new URLSearchParams(searchParams);
    if (next.get("task") === param) return;
    next.set("task", param);
    setSearchParams(next, { replace: true });
  }, [dialogOpen, form.id, searchParams, setSearchParams]);

  const save = async (): Promise<boolean> => {
    if (!form.title.trim()) {
      toast({ title: "Vyplň názov úlohy", variant: "destructive" });
      return false;
    }
    setSaving(true);
    const linked = await resolveTaskCustomerFields({
      customer_id: form.customer_id || null,
      customer_email: form.customer_email || null,
      client_name: form.client_name,
      lead_id: form.lead_id || null,
    });
    const parentErr = taskParentLinkError(linked);
    if (parentErr) {
      toast({ title: parentErr, variant: "destructive" });
      setSaving(false);
      return false;
    }
    const existing = form.id ? items.find((t) => t.id === form.id) : null;
    const finance = normalizeTaskFinancePayload(
      {
        status: form.status,
        amount: parseFloat(String(form.amount).replace(",", ".")) || 0,
        deposit: parseFloat(String(form.deposit).replace(",", ".")) || 0,
      },
      existing,
    );
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      client_name: linked.client_name || null,
      lead_id: linked.lead_id,
      customer_id: linked.customer_id,
      assignee: form.assignee || null,
      status: finance.status,
      priority: form.priority,
      due_date: form.due_date || null,
      amount: finance.amount,
      deposit: finance.deposit,
    };
    const { error } = form.id
      ? await supabase.from("tasks").update(payload).eq("id", form.id)
      : await supabase.from("tasks").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: form.id ? "Úloha upravená" : "Úloha pridaná" });
    discardTaskDraft();
    clearCrmViewState();
    closeTaskDialog();
    void load();
    return true;
  };

  const taskCloseGuard = useAdminCloseGuard({
    isOpen: dialogOpen,
    current: form,
    onSave: save,
    onDiscard: discardTaskChanges,
    saving,
  });

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať túto úlohu?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); load(); }
  };

  const changeStatus = async (id: string, status: TaskStatus) => {
    const row = items.find((t) => t.id === id);
    if (row && !isLegacyTaskFinance(row) && isTaskFinanceStatus(status)) {
      toast({
        title: "Billing stavy už nie sú na úlohe",
        description: "Financie zadávajte na nadradenej entite (projekt, marketing, prenájom…).",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else load();
  };

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (statusFilter === "active" && t.status === "done") return false;
      if (statusFilter === "archived" && t.status !== "done") return false;
      if (statusFilter !== "all" && statusFilter !== "active" && statusFilter !== "archived" && t.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && (t.assignee || "") !== assigneeFilter) return false;
      return true;
    });
  }, [items, statusFilter, assigneeFilter]);

  const legacyFinanceCount = useMemo(
    () => items.filter((t) => isLegacyTaskFinance(t)).length,
    [items],
  );

  const totals = useMemo(() => {
    const amount = filtered.reduce((s, t) => s + Number(t.amount || 0), 0);
    const deposit = filtered.reduce((s, t) => s + Number(t.deposit || 0), 0);
    return { amount, deposit, remaining: amount - deposit };
  }, [filtered]);

  const counts = useMemo(() => ({
    active: items.filter((t) => t.status !== "done").length,
    deposit_received: items.filter((t) => t.status === "deposit_received").length,
    send_final_invoice: items.filter((t) => t.status === "send_final_invoice").length,
    paid: items.filter((t) => t.status === "paid").length,
    archived: items.filter((t) => t.status === "done").length,
  }), [items]);

  const fmt = (n: number) => `${n.toFixed(2)} €`;

  const isOverdue = (date: string | null, status: TaskStatus) =>
    !!date && status !== "done" && status !== "paid" && new Date(date) < new Date(new Date().toDateString());

  const formIsLegacyFinance = useMemo(
    () =>
      !!form.id &&
      isLegacyTaskFinance({
        status: form.status,
        amount: Number(form.amount) || 0,
        deposit: Number(form.deposit) || 0,
      }),
    [form.id, form.status, form.amount, form.deposit],
  );
  const formStatusOptions = taskStatusOptionsForForm(
    form.id
      ? { status: form.status, amount: Number(form.amount) || 0, deposit: Number(form.deposit) || 0 }
      : null,
  );

  return (
    <AdminShell
      title="Úlohy"
      subtitle="Operatívny workflow — financie na nadradenej entite"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <Button onClick={() => openNew({ reset: true })} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nová úloha
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
          {TASK_FINANCE_DEPRECATION_NOTE}
        </p>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Aktívne</div>
            <div className="text-2xl font-bold text-primary">{counts.active}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Hotové</div>
            <div className="text-2xl font-bold text-green-500">{counts.archived}</div>
          </div>
          {legacyFinanceCount > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-card p-4">
              <div className="text-xs text-muted-foreground">Legacy billing úlohy</div>
              <div className="text-2xl font-bold text-amber-600">{legacyFinanceCount}</div>
            </div>
          )}
        </section>

        {legacyFinanceCount > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-card p-4 opacity-90">
            <div className="text-xs text-muted-foreground">Legacy suma (filter)</div>
            <div className="text-xl font-bold">{fmt(totals.amount)}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-card p-4 opacity-90">
            <div className="text-xs text-muted-foreground">Legacy zálohy</div>
            <div className="text-xl font-bold text-cyan-500">{fmt(totals.deposit)}</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-card p-4 opacity-90">
            <div className="text-xs text-muted-foreground">Legacy zostáva</div>
            <div className="text-xl font-bold text-orange-500">{fmt(totals.remaining)}</div>
          </div>
        </section>
        )}

        <section className="flex flex-col sm:flex-row gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Iba aktívne</SelectItem>
              <SelectItem value="archived">Archív (hotové) · {counts.archived}</SelectItem>
              <SelectItem value="all">Všetky</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetci riešitelia</SelectItem>
              {ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Žiadne úlohy</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Termín</TableHead>
                    <TableHead>Názov</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Riešiteľ</TableHead>
                    {legacyFinanceCount > 0 && (
                      <>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead className="text-right">Záloha</TableHead>
                        <TableHead className="text-right">Zostáva</TableHead>
                      </>
                    )}
                    <TableHead>Priorita</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const cfg = STATUS_CONFIG[t.status];
                    const pcfg = PRIORITY_CONFIG[t.priority];
                    const overdue = isOverdue(t.due_date, t.status);
                    const legacyFinance = isLegacyTaskFinance(t);
                    const remaining = Number(t.amount || 0) - Number(t.deposit || 0);
                    const rowStatusOptions = taskStatusOptionsForForm(t);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className={`text-xs whitespace-nowrap ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {t.due_date
                            ? new Date(t.due_date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })
                            : <span className="italic opacity-60">—</span>}
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[260px]">
                          <button onClick={() => openEdit(t)} className="text-left hover:text-primary line-clamp-2">{t.title}</button>
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.client_name ? (
                            <div className="space-y-1">
                              <div>{t.client_name}</div>
                              {t.customer_id && (
                                <Link
                                  to={adminCustomerHrefById(t.customer_id)}
                                  className="text-[10px] text-primary hover:underline"
                                >
                                  Zákazník 360°
                                </Link>
                              )}
                              {!t.customer_id && t.status !== "done" && (
                                <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-500/30">
                                  {TASK_LINK_STRENGTH_LABELS[classifyTaskLink(t)]}
                                </Badge>
                              )}
                              {!t.customer_id && !t.lead_id && customerHrefByClientName(t.client_name, clientEmailMap) && (
                                <Link
                                  to={customerHrefByClientName(t.client_name, clientEmailMap)!}
                                  className="text-[10px] text-primary hover:underline"
                                  title="Zhoda podľa mena klienta"
                                >
                                  Zákazník 360° (heuristika)
                                </Link>
                              )}
                            </div>
                          ) : (
                            <span className="italic opacity-60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{t.assignee || <span className="italic opacity-60">—</span>}</TableCell>
                        {legacyFinanceCount > 0 && (
                          <>
                            <TableCell className="text-sm text-right font-semibold whitespace-nowrap">
                              {legacyFinance ? fmt(Number(t.amount || 0)) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-right whitespace-nowrap text-cyan-500">
                              {legacyFinance ? fmt(Number(t.deposit || 0)) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-right whitespace-nowrap text-orange-500">
                              {legacyFinance ? fmt(remaining) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`text-[10px] ${pcfg.className}`}>{pcfg.label}</Badge>
                            {legacyFinance && (
                              <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-500/30">
                                Legacy billing
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={(v) => changeStatus(t.id, v as TaskStatus)}>
                            <SelectTrigger className="h-8 text-xs w-[160px]">
                              <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {rowStatusOptions.map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_CONFIG[s as TaskStatus].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" title="Detail úlohy" asChild>
                            <Link to={`/admin/tasks/${t.id}`}>
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </Button>
                          {t.lead_id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Otvoriť lead v pipeline"
                              onClick={() => navigate(adminLeadHref(t.lead_id!))}
                            >
                              <UserRound className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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

      {taskCloseGuard.closeGuardDialog}

      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) taskCloseGuard.handleOpenChange(o, closeTaskDialog);
        }}
        size="lg"
        stickyFooter
        title={form.id ? "Upraviť úlohu" : "Nová úloha"}
        footer={
          <>
            <Button variant="outline" onClick={() => taskCloseGuard.requestClose(closeTaskDialog)}>
              Zrušiť
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Názov</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="napr. Spustiť web pre klienta XY" />
          </div>
          <AdminLongTextField
            label="Popis"
            value={form.description}
            onChange={(description) => setForm({ ...form, description })}
            placeholder="Detail úlohy, kroky, poznámky..."
            withDatePrefix={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Klient</label>
              <LeadClientPicker
                leads={leadOptions}
                clientName={form.client_name}
                leadId={form.lead_id}
                customerId={form.customer_id || null}
                customerEmail={form.customer_email || null}
                onChange={({ client_name, lead_id, customer_id, customer_email }) =>
                  setForm({
                    ...form,
                    client_name,
                    lead_id: lead_id ?? "",
                    customer_id: customer_id ?? "",
                    customer_email: customer_email ?? "",
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Riešiteľ</label>
              <Select value={form.assignee || "none"} onValueChange={(v) => setForm({ ...form, assignee: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Vyber" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— bez priradenia —</SelectItem>
                  {ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {formIsLegacyFinance ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div>
                <label className="text-xs text-muted-foreground">Suma (€) — legacy, len na čítanie</label>
                <Input type="text" readOnly disabled value={form.amount} className="bg-muted/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Záloha (€) — legacy, len na čítanie</label>
                <Input type="text" readOnly disabled value={form.deposit} className="bg-muted/50" />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Finančné polia úlohy sú zastarané. Nové platby zadávajte na nadradenej entite.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Stav</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {formStatusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s as TaskStatus].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priorita</label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_CONFIG[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Termín</label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
        </div>
      </AdminDialog>
    </AdminShell>
  );
};

export default AdminTasks;
