import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { LeadClientPicker, type LeadOption } from "@/components/admin/LeadClientPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { AdminDialog } from "@/components/admin/AdminDialog";
import { toast } from "@/hooks/use-toast";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  UserRound,
} from "lucide-react";
import {
  adminLeadHref,
  buildClientNameEmailMap,
  customerHrefByClientName,
  adminCustomerHrefById,
} from "@/lib/adminNav";
import { resolveTaskCustomerFields, classifyTaskLink, TASK_LINK_STRENGTH_LABELS } from "@/lib/crmLookup/taskCustomerLink";

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

// ponytail: Phase 2 unsaved-changes guard — local normalize, id excluded (constant during edit).
const normalizeTaskForCompare = (f: ReturnType<typeof emptyForm>) => ({
  title: f.title ?? "",
  description: f.description ?? "",
  client_name: f.client_name ?? "",
  lead_id: f.lead_id ?? "",
  customer_id: f.customer_id ?? "",
  customer_email: f.customer_email ?? "",
  assignee: f.assignee ?? "",
  status: f.status,
  priority: f.priority,
  due_date: f.due_date ?? "",
  amount: f.amount ?? "",
  deposit: f.deposit ?? "",
});

const AdminTasks = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);

  // ponytail: Phase 2 unsaved-changes guard rollout — reuses Phase 1 hook unchanged.
  const taskGuard = useUnsavedChangesGuard({
    isOpen: dialogOpen,
    current: form,
    normalize: normalizeTaskForCompare,
  });
  const requestCloseTaskDialog = () => {
    if (taskGuard.confirmDiscard()) setDialogOpen(false);
  };

  useEffect(() => {
    document.title = "Úlohy | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [tasksRes, leadsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("leads").select("id,name,email"),
    ]);
    if (tasksRes.error) {
      toast({ title: "Chyba", description: tasksRes.error.message, variant: "destructive" });
    } else {
      setItems((tasksRes.data || []) as Task[]);
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
    }
    setLoading(false);
  };

  const openNew = () => { setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (t: Task) => {
    setForm({
      id: t.id, title: t.title, description: t.description ?? "",
      client_name: t.client_name ?? "", lead_id: t.lead_id ?? "",
      customer_id: t.customer_id ?? "",
      customer_email: "",
      assignee: t.assignee ?? "",
      status: t.status, priority: t.priority,
      due_date: t.due_date ?? "",
      amount: String(t.amount ?? ""),
      deposit: String(t.deposit ?? ""),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Vyplň názov úlohy", variant: "destructive" }); return; }
    setSaving(true);
    const linked = await resolveTaskCustomerFields({
      customer_id: form.customer_id || null,
      customer_email: form.customer_email || null,
      client_name: form.client_name,
      lead_id: form.lead_id || null,
    });
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      client_name: linked.client_name || null,
      lead_id: linked.lead_id,
      customer_id: linked.customer_id,
      assignee: form.assignee || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      amount: parseFloat(String(form.amount).replace(",", ".")) || 0,
      deposit: parseFloat(String(form.deposit).replace(",", ".")) || 0,
    };
    const { error } = form.id
      ? await supabase.from("tasks").update(payload).eq("id", form.id)
      : await supabase.from("tasks").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    toast({ title: form.id ? "Úloha upravená" : "Úloha pridaná" });
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať túto úlohu?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); load(); }
  };

  const changeStatus = async (id: string, status: TaskStatus) => {
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

  return (
    <AdminShell
      title="Úlohy – aktívne zákazky"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nová úloha
        </Button>
      }
    >
      <div className="space-y-4">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Aktívne</div>
            <div className="text-2xl font-bold text-primary">{counts.active}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Prijatá záloha</div>
            <div className="text-2xl font-bold text-cyan-500">{counts.deposit_received}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Poslať final FA</div>
            <div className="text-2xl font-bold text-orange-500">{counts.send_final_invoice}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Uhradené</div>
            <div className="text-2xl font-bold text-emerald-500">{counts.paid}</div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Suma (filter)</div>
            <div className="text-xl font-bold">{fmt(totals.amount)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Prijaté zálohy</div>
            <div className="text-xl font-bold text-cyan-500">{fmt(totals.deposit)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Zostáva uhradiť</div>
            <div className="text-xl font-bold text-orange-500">{fmt(totals.remaining)}</div>
          </div>
        </section>

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
                    <TableHead className="text-right">Suma</TableHead>
                    <TableHead className="text-right">Záloha</TableHead>
                    <TableHead className="text-right">Zostáva</TableHead>
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
                    const remaining = Number(t.amount || 0) - Number(t.deposit || 0);
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
                        <TableCell className="text-sm text-right font-semibold whitespace-nowrap">{fmt(Number(t.amount || 0))}</TableCell>
                        <TableCell className="text-sm text-right whitespace-nowrap text-cyan-500">{fmt(Number(t.deposit || 0))}</TableCell>
                        <TableCell className="text-sm text-right whitespace-nowrap text-orange-500">{fmt(remaining)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${pcfg.className}`}>{pcfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={(v) => changeStatus(t.id, v as TaskStatus)}>
                            <SelectTrigger className="h-8 text-xs w-[160px]">
                              <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
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

      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => (o ? setDialogOpen(true) : requestCloseTaskDialog())}
        size="lg"
        title={form.id ? "Upraviť úlohu" : "Nová úloha / zákazka"}
        footer={
          <>
            <Button variant="outline" onClick={requestCloseTaskDialog}>Zrušiť</Button>
            <Button onClick={save} disabled={saving}>
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
            <div>
              <label className="text-xs text-muted-foreground">Popis</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Detail úlohy, kroky, poznámky..." />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Prijatá záloha (€)</label>
                <Input type="number" step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Stav</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
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
