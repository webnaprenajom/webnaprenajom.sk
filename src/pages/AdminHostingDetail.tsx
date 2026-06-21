import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { EntityCommissionsPanel } from "@/components/admin/EntityCommissionsPanel";
import {
  EntityPaymentRecordsPanel,
  type EntityPaymentContext,
} from "@/components/admin/EntityPaymentRecordsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import { ArrowLeft, Loader2, AlertCircle, Trash2, Pencil } from "lucide-react";
import {
  ConfirmedLinkBadge,
  EstimatedLinkBadge,
  StandaloneEntityBadge,
} from "@/components/admin/lookup/LinkStatusBadge";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { isValidEntityId } from "@/lib/crmLookup/resolveFormCustomerLink";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { OperatingCostField } from "@/components/admin/OperatingCostField";
import { AgreedPriceField, ENTITY_PAYMENTS_TAB_NOTE } from "@/components/admin/AgreedPriceField";
import { PaymentCompletenessBadge } from "@/components/admin/PaymentCompletenessBadge";
import { EntityProfitBanner } from "@/components/admin/EntityProfitBanner";
import { toast } from "@/hooks/use-toast";
import { useAccessContext } from "@/hooks/useAccessContext";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { buildTaskCreateHref } from "@/lib/tasks/taskParentModel";
import {
  countConfirmedPayments,
  resolveEntityAgreedPrice,
  sumConfirmedPayments,
  type EntityPaymentRow,
} from "@/lib/finance/entityPaymentBridge";
import {
  HostingRecordEditDialog,
  type HostingRecordEditDraft,
} from "@/components/admin/hosting/HostingRecordEditDialog";
import {
  assertDeliveryHasCanonicalCustomer,
  parseInsertRowId,
} from "@/lib/crmLookup/entitySaveHelpers";
import { resolveFormCustomerLink } from "@/lib/crmLookup/resolveFormCustomerLink";
import { linkLeadAfterDelivery } from "@/lib/crmLookup/leadCustomerLifecycle";

export default function AdminHostingDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const access = useAccessContext();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<HostingRecordRow | null>(null);
  const [payments, setPayments] = useState<EntityPaymentRow[]>([]);
  const [linkedRental, setLinkedRental] = useState<{ id: string; name: string; url: string | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [estimatedProjects, setEstimatedProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<HostingRecordEditDraft | null>(null);
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction();

  useEffect(() => {
    if (!id) return;
    document.title = "Detail hostingu | CRM";
    void load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    if (!isValidEntityId(id)) {
      setLoadError("Neplatné ID hostingu v adrese. Vráťte sa do zoznamu a otvorte záznam znova.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("hosting_records").select("*").eq("id", id).maybeSingle();
    adminDebugLog("hostingDetail", "fetch", { id, found: !!data, error: error?.message });

    if (error) {
      setLoadError(`Hosting sa nepodarilo načítať: ${error.message}`);
      setLoading(false);
      return;
    }
    if (!data) {
      setLoadError(
        "Hosting záznam neexistuje alebo k nemu nemáte prístup. Ak ste práve vytvorili záznam, obnovte zoznam a skúste znova.",
      );
      setLoading(false);
      return;
    }
    const row = data as HostingRecordRow;
    setRecord(row);

    const [payRes, rentalRes, projectRes] = await Promise.all([
      supabase
        .from("payment_records")
        .select("id,amount,paid_at,note,truth_level,source_table,source_id")
        .eq("source_table", "hosting_records")
        .eq("source_id", id)
        .order("paid_at", { ascending: false }),
      row.rental_website_id
        ? supabase
            .from("rental_websites")
            .select("id,name,url")
            .eq("id", row.rental_website_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      row.customer_email
        ? supabase
            .from("project_notes")
            .select("id,title")
            .ilike("customer_email", normalizeEmail(row.customer_email) || row.customer_email)
        : Promise.resolve({ data: [] }),
    ]);

    setPayments((payRes.data || []) as EntityPaymentRow[]);
    if (rentalRes.data) setLinkedRental(rentalRes.data);
    setEstimatedProjects(projectRes.data || []);
    setLoading(false);
  };

  const confirmedRevenue = useMemo(() => sumConfirmedPayments(payments), [payments]);
  const confirmedPaymentCount = useMemo(() => countConfirmedPayments(payments), [payments]);
  const agreedPrice = useMemo(
    () => (record ? resolveEntityAgreedPrice(record) : 0),
    [record],
  );
  const paymentEntity = useMemo((): EntityPaymentContext | null => {
    if (!record) return null;
    return {
      sourceTable: "hosting_records",
      sourceId: record.id,
      agreedPrice: record.agreed_fee ?? (agreedPrice > 0 ? agreedPrice : null),
      clientName: record.client_name,
      customerEmail: record.customer_email,
      defaultNote: `Hosting · ${record.provider || record.client_name || record.id}`,
    };
  }, [record, agreedPrice]);

  const openEdit = () => {
    if (!record) return;
    setCustomerFieldError(null);
    setEditing({
      ...record,
      customer_id: (record as HostingRecordRow & { customer_id?: string | null }).customer_id ?? null,
      lead_id: (record as HostingRecordRow & { lead_id?: string | null }).lead_id ?? null,
    });
    setEditOpen(true);
  };

  const saveEdit = async (): Promise<boolean> => {
    if (!editing?.id) return false;

    let linked;
    try {
      linked = await resolveFormCustomerLink({
        customer_id: editing.customer_id,
        customer_email: editing.customer_email,
        client_name: editing.client_name,
        lead_id: editing.lead_id,
        createIfMissing: true,
      });
    } catch (e) {
      toast({
        title: "Klient — neplatný e-mail",
        description: e instanceof Error ? e.message : "Skontrolujte e-mail klienta.",
        variant: "destructive",
      });
      return false;
    }

    const customerGuard = assertDeliveryHasCanonicalCustomer(linked);
    if (!customerGuard.ok) {
      setCustomerFieldError(customerGuard.message);
      toast({ title: customerGuard.message, variant: "destructive" });
      return false;
    }
    setCustomerFieldError(null);

    const payload = {
      client_name: linked.client_name || null,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
      provider: editing.provider?.trim() || null,
      domains_count: editing.domains_count != null ? Number(editing.domains_count) : null,
      monthly_price: editing.monthly_price != null ? Number(editing.monthly_price) : null,
      yearly_price: editing.yearly_price != null ? Number(editing.yearly_price) : null,
      agreed_fee:
        editing.agreed_fee != null && Number(editing.agreed_fee) > 0
          ? Math.max(0, Number(editing.agreed_fee))
          : null,
      acquired_by: editing.acquired_by?.trim() || null,
      note: editing.note?.trim() || null,
    };

    const { data: saved, error } = await supabase
      .from("hosting_records")
      .update(payload)
      .eq("id", editing.id)
      .select("id")
      .maybeSingle();

    const result = parseInsertRowId(saved, error, "Hosting");
    if (!result.ok) {
      toast({ title: "Aktualizácia zlyhala", description: result.error, variant: "destructive" });
      return false;
    }

    if (linked.lead_id && linked.customer_id) {
      await linkLeadAfterDelivery(linked.lead_id, linked.customer_id);
    }

    setEditOpen(false);
    setEditing(null);
    void load();
    toast({ title: "Hosting uložený" });
    return true;
  };

  if (loading) {
    return (
      <AdminShell title="Hosting" subtitle="Načítavam…">
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  if (loadError || !record) {
    return (
      <AdminShell
        title="Hosting"
        subtitle="Záznam sa nepodarilo načítať"
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/hosting")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Späť na zoznam
          </Button>
        }
      >
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 max-w-lg space-y-3">
          <div className="flex gap-2 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{loadError ?? "Neznáma chyba"}</p>
          </div>
          <Button onClick={() => void load()} variant="outline" size="sm">
            Skúsiť znova
          </Button>
        </div>
      </AdminShell>
    );
  }

  const label = record.client_name || record.customer_email || record.provider || "Hosting";
  const isStandalone = !record.rental_website_id;
  const displayAgreedPrice = record.agreed_fee ?? (agreedPrice > 0 ? agreedPrice : null);

  return (
    <AdminShell
      title={label}
      subtitle={record.provider || "Hosting záznam"}
      actions={
        <div className="flex gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline">
            <Link
              to={buildTaskCreateHref({
                parent_type: "hosting",
                parent_id: record.id,
                label: label,
              })}
            >
              Nová úloha
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="w-4 h-4 mr-1" /> Upraviť
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/5"
            onClick={() =>
              void requestDelete({
                entityType: "hosting",
                entityId: record.id,
                entityLabel: label,
                redirectTo: "/admin/hosting",
              })
            }
          >
            <Trash2 className="w-4 h-4 mr-1" /> Zmazať
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/hosting")}>
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
        </TabsList>

        <TabsContent value="prehlad">
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {isStandalone ? <StandaloneEntityBadge /> : <ConfirmedLinkBadge label="Viazaný na prenájom" />}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Klient" value={record.client_name || "—"} />
              <Field label="E-mail">
                {(() => {
                  const href = adminCustomerHrefPreferred(
                    (record as HostingRecordRow & { customer_id?: string | null }).customer_id,
                    record.customer_email,
                  );
                  return href ? (
                    <Link to={href} className="text-primary hover:underline">
                      {record.customer_email}
                    </Link>
                  ) : (
                    "—"
                  );
                })()}
              </Field>
              <Field label="Poskytovateľ" value={record.provider || "—"} />
              <Field
                label="Cena / mesiac"
                value={record.monthly_price != null ? `${record.monthly_price} €` : "—"}
              />
              <Field
                label="Cena / rok"
                value={record.yearly_price != null ? `${record.yearly_price} €` : "—"}
              />
              <div className="sm:col-span-2">
                <AgreedPriceField
                  compact
                  value={Number(record.agreed_fee ?? 0)}
                  onSave={async (next) => {
                    const { error } = await supabase
                      .from("hosting_records")
                      .update({ agreed_fee: next > 0 ? next : null })
                      .eq("id", record.id);
                    if (error) {
                      toast({ title: "Chyba", description: error.message, variant: "destructive" });
                      throw error;
                    }
                    setRecord({ ...record, agreed_fee: next > 0 ? next : null });
                    toast({ title: "Dohodnutá cena uložená" });
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <PaymentCompletenessBadge
                  agreedPrice={displayAgreedPrice}
                  confirmedPaid={confirmedRevenue}
                />
              </div>
              <div className="sm:col-span-2">
                <OperatingCostField
                  value={Number(record.operating_cost ?? 0)}
                  onSave={async (next) => {
                    const prev = Number(record.operating_cost ?? 0);
                    const { error } = await supabase
                      .from("hosting_records")
                      .update({ operating_cost: next })
                      .eq("id", record.id);
                    if (error) {
                      toast({ title: "Chyba", description: error.message, variant: "destructive" });
                      throw error;
                    }
                    setRecord({ ...record, operating_cost: next });
                    if (access.userId) {
                      await logAdminAuditEvent({
                        actorUserId: access.userId,
                        actionType: AUDIT_ACTION_TYPES.operating_cost_changed,
                        targetType: "hosting_records",
                        targetId: record.id,
                        summary: `Prevádzkové náklady hostingu: ${prev} → ${next} €`,
                        before: { operating_cost: prev },
                        after: { operating_cost: next },
                      });
                    }
                    toast({ title: "Náklady uložené" });
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <EntityProfitBanner
                  entityKind="hosting"
                  revenue={confirmedRevenue}
                  operatingCost={Number(record.operating_cost ?? 0)}
                  revenueKnown={confirmedPaymentCount > 0}
                  paymentRecordCount={confirmedPaymentCount}
                />
              </div>
              <Field label="Domény" value={record.domains_count != null ? String(record.domains_count) : "—"} />
              <Field label="Získal" value={record.acquired_by || "—"} />
              <Field label="Provízny">
                <Badge variant={record.commissionable ? "default" : "outline"} className="text-[10px]">
                  {record.commissionable ? "áno" : "nie"}
                </Badge>
              </Field>
              <Field label="Stav">
                <Badge variant={record.active ? "secondary" : "outline"} className="text-[10px]">
                  {record.active ? "aktívny" : "neaktívny"}
                </Badge>
              </Field>
              <Field label="Vytvorené" value={new Date(record.created_at).toLocaleString("sk-SK")} />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="provizie">
          <EntityCommissionsPanel
            sourceType="hosting"
            sourceId={record.id}
            customerEmail={record.customer_email}
            customerId={(record as HostingRecordRow & { customer_id?: string | null }).customer_id}
            defaultTitle={`Hosting — ${label}`}
            revenueAmount={confirmedRevenue}
            operatingCost={Number(record.operating_cost ?? 0)}
            revenueKnown={confirmedPaymentCount > 0}
            paymentRecordCount={confirmedPaymentCount}
          />
        </TabsContent>

        <TabsContent value="platby">
          <EntityPaymentRecordsPanel
            payments={payments}
            entity={paymentEntity!}
            onSaved={() => void load()}
            footerNote={ENTITY_PAYMENTS_TAB_NOTE}
          />
        </TabsContent>

        <TabsContent value="poznamky">
          {record.note ? (
            <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap">{record.note}</div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Žiadna poznámka.
            </p>
          )}
        </TabsContent>

        <TabsContent value="suvisiace" className="space-y-4">
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Prenájom</h3>
              {linkedRental ? <ConfirmedLinkBadge label="Viazaný na prenájom" /> : <StandaloneEntityBadge />}
            </div>
            {linkedRental ? (
              <Link to="/admin/rentals" className="text-sm text-primary hover:underline">
                {linkedRental.name || linkedRental.url}
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Samostatný hosting bez rental_website_id.
              </p>
            )}
          </section>
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Projekty</h3>
              <EstimatedLinkBadge />
            </div>
            {estimatedProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Žiadne projekty s rovnakým e-mailom klienta.
              </p>
            ) : (
              <ul className="text-sm space-y-1 list-disc pl-4">
                {estimatedProjects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/admin/projects/${p.id}`} className="text-primary hover:underline">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <HostingRecordEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={editing}
        setEditing={setEditing}
        onSave={saveEdit}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={() => setCustomerFieldError(null)}
      />

      <DestructiveModal {...modalProps} />
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
