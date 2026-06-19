import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntityCommissionsPanel } from "@/components/admin/EntityCommissionsPanel";
import { EntityPaymentRecordsPanel } from "@/components/admin/EntityPaymentRecordsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { adminCustomerHrefPreferred, adminLeadHref } from "@/lib/adminNav";
import { ArrowLeft, Loader2 } from "lucide-react";
import { isValidEntityId } from "@/lib/crmLookup/resolveFormCustomerLink";
import {
  entityHasLinkedPaymentInRows,
  loadTaskPaymentRecords,
  taskPaymentCreateHint,
  taskPaymentSourceId,
  taskPaymentVariantLabel,
  type EntityPaymentRow,
} from "@/lib/finance/entityPaymentBridge";
import { financeCtxWithPayments, prefillFromTask } from "@/lib/finance/factDrafts";
import {
  isLegacyTaskFinance,
  TASK_FINANCE_DEPRECATION_NOTE,
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

interface TaskRow {
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
  updated_at: string;
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

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Nízka", className: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normálna", className: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  high: { label: "Vysoká", className: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  urgent: { label: "Urgentné", className: "bg-red-500/20 text-red-400 border-red-500/40" },
};

const fmt = (n: number) =>
  n.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function AdminTaskDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskRow | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<EntityPaymentRow[]>([]);

  useEffect(() => {
    if (!id) return;
    document.title = "Detail úlohy | CRM";
    void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    if (!isValidEntityId(id)) {
      toast({ title: "Neplatné ID úlohy", variant: "destructive" });
      navigate("/admin/tasks", { replace: true });
      return;
    }

    const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast({ title: "Úloha nenájdená", variant: "destructive" });
      navigate("/admin/tasks", { replace: true });
      return;
    }

    const row = data as TaskRow;
    setTask(row);
    setCustomerEmail(null);

    if (row.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("email")
        .eq("id", row.customer_id)
        .maybeSingle();
      if (customer?.email) setCustomerEmail(customer.email);
    } else     if (row.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("email")
        .eq("id", row.lead_id)
        .maybeSingle();
      if (lead?.email) setCustomerEmail(lead.email);
    }

    const pays = await loadTaskPaymentRecords(row.id);
    setLinkedPayments(pays);

    setLoading(false);
  };

  const statusCfg = useMemo(
    () => STATUS_CONFIG[task?.status ?? "todo"],
    [task?.status],
  );
  const priorityCfg = useMemo(
    () => PRIORITY_CONFIG[task?.priority ?? "normal"],
    [task?.priority],
  );
  const paymentCtx = useMemo(() => financeCtxWithPayments(linkedPayments), [linkedPayments]);

  if (loading || !task) {
    return (
      <AdminShell title="Úlohy" subtitle="Načítavam…">
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const remaining = Number(task.amount || 0) - Number(task.deposit || 0);
  const legacyFinance = isLegacyTaskFinance(task);
  const customerHref = adminCustomerHrefPreferred(task.customer_id, customerEmail);
  const depositSourceId = taskPaymentSourceId(task.id, "deposit");
  const fullSourceId = taskPaymentSourceId(task.id, "full");
  const depositLinked = entityHasLinkedPaymentInRows("tasks", depositSourceId, linkedPayments);
  const fullLinked = entityHasLinkedPaymentInRows("tasks", fullSourceId, linkedPayments);
  const depositHint = taskPaymentCreateHint(task, "deposit", depositLinked, depositLinked);
  const fullHint = taskPaymentCreateHint(task, "full", fullLinked, depositLinked);

  return (
    <AdminShell
      title={task.title}
      subtitle={task.client_name || "Bez klienta"}
      actions={
        <Button size="sm" variant="outline" onClick={() => navigate("/admin/tasks")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Späť
        </Button>
      }
    >
      <Tabs defaultValue="prehlad" className="space-y-4">
        <p className="text-xs text-muted-foreground border border-border/60 rounded-lg p-3 bg-muted/20">
          {TASK_FINANCE_DEPRECATION_NOTE}
        </p>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="prehlad">Prehľad</TabsTrigger>
          <TabsTrigger value="provizie">Provízie</TabsTrigger>
          <TabsTrigger value="platby">Platby</TabsTrigger>
        </TabsList>

        <TabsContent value="prehlad" className="space-y-4">
          <section className="rounded-xl border bg-card p-4 grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Stav">
              <Badge variant="outline" className={statusCfg.className}>
                {statusCfg.label}
              </Badge>
            </Field>
            <Field label="Priorita">
              <Badge variant="outline" className={priorityCfg.className}>
                {priorityCfg.label}
              </Badge>
            </Field>
            <Field label="Riešiteľ" value={task.assignee || "—"} />
            <Field label="Termín">
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString("sk-SK")
                : "—"}
            </Field>
            <Field label="Klient" value={task.client_name || "—"} />
            <Field label="Zákazník">
              {customerHref ? (
                <Link to={customerHref} className="text-primary hover:underline">
                  {customerEmail || "Kanónický zákazník"}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Suma" value={legacyFinance ? fmt(Number(task.amount || 0)) : "— (na nadradenej entite)"} />
            <Field label="Záloha" value={legacyFinance ? fmt(Number(task.deposit || 0)) : "—"} />
            <Field label="Zostáva" value={legacyFinance ? fmt(remaining) : "—"} />
            <Field label="Lead">
              {task.lead_id ? (
                <Link to={adminLeadHref(task.lead_id)} className="text-primary hover:underline">
                  Otvoriť lead
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Vytvorené" value={new Date(task.created_at).toLocaleString("sk-SK")} />
            <div className="sm:col-span-2">
              <Field label="Popis">
                {task.description ? (
                  <div className="mt-1 rounded-lg bg-muted/40 p-3 whitespace-pre-wrap">{task.description}</div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="provizie">
          <EntityCommissionsPanel
            sourceType="task"
            sourceId={task.id}
            customerEmail={customerEmail}
            customerId={task.customer_id}
            defaultTitle={task.title}
            revenueKnown={false}
          />
        </TabsContent>

        <TabsContent value="platby">
          {!legacyFinance ? (
            <p className="text-sm text-muted-foreground rounded-xl border p-4">
              Platby úlohy nie sú podporované pre nový workflow model. Potvrdené platby zadávajte na
              projekte, marketingu, prenájme alebo hostingu. Existujúce záznamy nižšie zostávajú len na
              čítanie.
            </p>
          ) : null}
          <EntityPaymentRecordsPanel
            payments={linkedPayments}
            onSaved={() => void load()}
            variantLabel={(row) =>
              taskPaymentVariantLabel(row.source_id || "", task.id)
            }
            createActions={
              legacyFinance
                ? [
                    {
                      key: "deposit",
                      label: "Potvrdiť zálohu do financií",
                      linkedExists: depositLinked,
                      disabled: !!depositHint,
                      hint: depositHint,
                      buildDraft: () =>
                        prefillFromTask(task, "deposit", customerEmail, paymentCtx),
                    },
                    {
                      key: "full",
                      label: depositLinked ? "Potvrdiť doplatok do financií" : "Potvrdiť úhradu do financií",
                      linkedExists: fullLinked,
                      disabled: !!fullHint,
                      hint: fullHint,
                      buildDraft: () =>
                        prefillFromTask(task, "full", customerEmail, paymentCtx),
                    },
                  ]
                : []
            }
          />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div>{children ?? value}</div>
    </div>
  );
}
