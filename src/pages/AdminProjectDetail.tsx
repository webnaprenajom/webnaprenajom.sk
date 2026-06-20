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
import { adminCustomerHref, adminCustomerHrefPreferred } from "@/lib/adminNav";
import { PROJECT_STATUSES, type ProjectNote } from "@/components/admin/projectNotes/shared";
import { ArrowLeft, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import {
  ClientLinkBadge,
  ConfirmedLinkBadge,
  EstimatedLinkBadge,
} from "@/components/admin/lookup/LinkStatusBadge";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { OperatingCostField } from "@/components/admin/OperatingCostField";
import { AgreedPriceField, ENTITY_PAYMENTS_TAB_NOTE } from "@/components/admin/AgreedPriceField";
import { PaymentCompletenessBadge } from "@/components/admin/PaymentCompletenessBadge";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import {
  countConfirmedPayments,
  projectPaymentCreateHint,
  sumConfirmedPayments,
  type EntityPaymentRow,
} from "@/lib/finance/entityPaymentBridge";
import { financeCtxWithPayments, prefillFromProject } from "@/lib/finance/factDrafts";
import { useAccessContext } from "@/hooks/useAccessContext";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { buildTaskCreateHref } from "@/lib/tasks/taskParentModel";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  wordpress: "WordPress",
  shoptet: "Shoptet",
  custom: "Zákazkový web",
  other: "Iné",
};

export default function AdminProjectDetail() {
  const { id = "" } = useParams();
  const access = useAccessContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectNote | null>(null);
  const [lead, setLead] = useState<{ id: string; name: string; email: string | null } | null>(null);
  const [relatedHosting, setRelatedHosting] = useState<any[]>([]);
  const [relatedRentals, setRelatedRentals] = useState<any[]>([]);
  const [linkedPayments, setLinkedPayments] = useState<EntityPaymentRow[]>([]);

  const confirmedRevenue = useMemo(() => sumConfirmedPayments(linkedPayments), [linkedPayments]);
  const confirmedPaymentCount = useMemo(
    () => countConfirmedPayments(linkedPayments),
    [linkedPayments],
  );

  useEffect(() => {
    if (!id) return;
    document.title = "Detail projektu | CRM";
    void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("project_notes").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast({ title: "Projekt nenájdený", variant: "destructive" });
      navigate("/admin/projects", { replace: true });
      return;
    }
    const row = data as ProjectNote;
    setProject(row);

    const tasks: PromiseLike<void>[] = [];

    if (row.lead_id) {
      tasks.push(
        supabase
          .from("leads")
          .select("id,name,email")
          .eq("id", row.lead_id)
          .maybeSingle()
          .then(({ data: leadRow }) => {
            if (leadRow) setLead(leadRow);
          }),
      );
    }

    const email = normalizeEmail(row.customer_email);
    const clientName = row.client_name?.trim();

    if (email) {
      tasks.push(
        supabase
          .from("hosting_records")
          .select("id,client_name,provider,monthly_price,active")
          .ilike("customer_email", email)
          .then(({ data: h }) => setRelatedHosting(h || [])),
      );
    }
    if (clientName) {
      tasks.push(
        supabase
          .from("rental_websites")
          .select("id,name,url,monthly_price,client_name,created_at")
          .ilike("client_name", clientName)
          .then(({ data: r }) => setRelatedRentals(r || [])),
      );
    }

    tasks.push(
      supabase
        .from("payment_records")
        .select("id,amount,paid_at,note,truth_level,source_table,source_id")
        .eq("source_table", "project_notes")
        .eq("source_id", id)
        .order("paid_at", { ascending: false })
        .then(({ data: pays }) => {
          const list = (pays || []) as EntityPaymentRow[];
          setLinkedPayments(list);
        }),
    );

    await Promise.all(tasks);
    setLoading(false);
  };

  const statusCfg = useMemo(
    () => PROJECT_STATUSES.find((s) => s.value === project?.status),
    [project?.status],
  );
  const paymentCtx = useMemo(() => financeCtxWithPayments(linkedPayments), [linkedPayments]);

  if (loading || !project) {
    return (
      <AdminShell title="Projekt" subtitle="Načítavam…">
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const customerEmail = project.customer_email;
  const projectType = project.project_type;
  const clientLinked = !!project.lead_id;
  const projectPaymentHint = projectPaymentCreateHint(project);

  return (
    <AdminShell
      title={project.title}
      subtitle={project.client_name || "Bez klienta"}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              to={buildTaskCreateHref({
                parent_type: "project",
                parent_id: project.id,
                label: project.title,
              })}
            >
              Nová úloha
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/projects")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Späť
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="prehlad" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="prehlad">Prehľad</TabsTrigger>
          <TabsTrigger value="poznamky">Poznámky</TabsTrigger>
          <TabsTrigger value="provizie">Provízie</TabsTrigger>
          <TabsTrigger value="platby">Platby</TabsTrigger>
          <TabsTrigger value="suvisiace">Súvisiace</TabsTrigger>
          <TabsTrigger value="hesla" asChild>
            <Link to="/admin/passwords">Heslá ↗</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prehlad" className="space-y-4">
          <section className="rounded-xl border bg-card p-4 grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Typ projektu" value={projectType ? PROJECT_TYPE_LABELS[projectType] || projectType : "—"} />
            <Field label="Stav">
              <Badge variant="outline" className={statusCfg?.color}>{statusCfg?.label || project.status}</Badge>
            </Field>
            <Field label="Klient">
              <div className="flex items-center gap-2 flex-wrap">
                <span>{project.client_name || "—"}</span>
                <ClientLinkBadge linked={clientLinked} />
              </div>
            </Field>
            <Field label="E-mail klienta">
              {(() => {
                const href = adminCustomerHrefPreferred(project.customer_id, customerEmail ?? null);
                return href ? (
                  <Link to={href} className="text-primary hover:underline">
                    {customerEmail || "Kanónický zákazník"}
                  </Link>
                ) : (
                  "—"
                );
              })()}
            </Field>
            <Field label="URL / doména">
              {project.url ? (
                <a
                  href={project.url.startsWith("http") ? project.url : `https://${project.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {project.url} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Prepojený lead">
              {lead ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/admin?lead=${lead.id}`} className="text-primary hover:underline">
                    {lead.name}
                    {lead.email ? ` · ${lead.email}` : ""}
                  </Link>
                  <ConfirmedLinkBadge />
                </div>
              ) : project.lead_id ? (
                <span className="text-muted-foreground text-xs">Lead ID: {project.lead_id}</span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Aktualizované" value={new Date(project.updated_at).toLocaleString("sk-SK")} />
            <div className="sm:col-span-2">
              <OperatingCostField
                value={Number(project.operating_cost ?? 0)}
                onSave={async (next) => {
                  const prev = Number(project.operating_cost ?? 0);
                  const { error } = await supabase
                    .from("project_notes")
                    .update({ operating_cost: next })
                    .eq("id", project.id);
                  if (error) {
                    toast({ title: "Chyba", description: error.message, variant: "destructive" });
                    throw error;
                  }
                  setProject({ ...project, operating_cost: next });
                  if (access.userId) {
                    await logAdminAuditEvent({
                      actorUserId: access.userId,
                      actionType: AUDIT_ACTION_TYPES.operating_cost_changed,
                      targetType: "project_notes",
                      targetId: project.id,
                      summary: `Prevádzkové náklady projektu: ${prev} → ${next} €`,
                      before: { operating_cost: prev },
                      after: { operating_cost: next },
                    });
                  }
                  toast({ title: "Náklady uložené" });
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <AgreedPriceField
                compact
                value={Number(project.agreed_fee ?? 0)}
                onSave={async (next) => {
                  const { error } = await supabase
                    .from("project_notes")
                    .update({ agreed_fee: next > 0 ? next : null })
                    .eq("id", project.id);
                  if (error) {
                    toast({ title: "Chyba", description: error.message, variant: "destructive" });
                    throw error;
                  }
                  setProject({ ...project, agreed_fee: next > 0 ? next : null });
                  toast({ title: "Dohodnutá cena uložená" });
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <PaymentCompletenessBadge
                agreedPrice={project.agreed_fee}
                confirmedPaid={confirmedRevenue}
              />
            </div>
            <div className="sm:col-span-2">
              <EntityProfitBanner
                entityKind="project"
                revenue={confirmedRevenue}
                operatingCost={Number(project.operating_cost ?? 0)}
                revenueKnown={confirmedPaymentCount > 0}
                paymentRecordCount={confirmedPaymentCount}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="poznamky">
          {project.notes ? (
            <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{project.notes}</div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Žiadna poznámka projektu.
            </p>
          )}
        </TabsContent>

        <TabsContent value="provizie">
          <EntityCommissionsPanel
            sourceType="project"
            sourceId={project.id}
            customerEmail={customerEmail}
            customerId={project.customer_id}
            defaultTitle={project.title}
            revenueAmount={confirmedRevenue}
            operatingCost={Number(project.operating_cost ?? 0)}
            revenueKnown={confirmedPaymentCount > 0}
            paymentRecordCount={confirmedPaymentCount}
          />
        </TabsContent>

        <TabsContent value="platby">
          <EntityPaymentRecordsPanel
            payments={linkedPayments}
            onSaved={() => void load()}
            footerNote={ENTITY_PAYMENTS_TAB_NOTE}
            createActions={[
              {
                key: "create",
                label: "Vytvoriť platbu",
                disabled: !!projectPaymentHint,
                hint: projectPaymentHint,
                buildDraft: () => prefillFromProject(project, paymentCtx),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="suvisiace" className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Nižšie uvedené väzby sú odhadované podľa e-mailu alebo mena klienta — nie sú uložené ako FK prepojenie.
          </p>
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Hosting</h3>
              <EstimatedLinkBadge />
            </div>
            {relatedHosting.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Žiadny hosting s rovnakým e-mailom.</p>
            ) : (
              <ul className="text-sm space-y-1 list-disc pl-4">
                {relatedHosting.map((h) => (
                  <li key={h.id}>
                    <Link to={`/admin/hosting/${h.id}`} className="text-primary hover:underline">
                      {h.client_name || h.provider} — {h.monthly_price != null ? `${h.monthly_price} €/mes` : "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Prenájmy</h3>
              <EstimatedLinkBadge />
            </div>
            {relatedRentals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Žiadne prenájmy s podobným menom klienta.</p>
            ) : (
              <ul className="text-sm space-y-1 list-disc pl-4">
                {relatedRentals.map((r) => (
                  <li key={r.id}>
                    <Link to="/admin/rentals" className="text-primary hover:underline">
                      {r.name || r.url} — {r.monthly_price} €/mes
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5" />
            Prístupy a heslá:{" "}
            <Link to="/admin/passwords" className="text-primary hover:underline">
              sekcia Heslá
            </Link>
          </p>
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
