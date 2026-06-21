import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminLongTextField } from "@/components/admin/AdminLongTextField";
import { useCrmDraft } from "@/hooks/useCrmDraft";
import { useCrmViewRestore } from "@/hooks/useCrmViewRestore";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { CRM_HISTORY_ACTIONS, logCrmEvent } from "@/lib/history/logCrmEvent";
import { clearCrmViewState } from "@/lib/crmPersistence/viewRestoreStore";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { AdminListSearchInput } from "@/components/admin/AdminListSearchInput";
import { matchesSearchQuery } from "@/lib/searchMatch";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import {
  sumConfirmedPaymentsForSource,
  resolveEntityAgreedPrice,
} from "@/lib/finance/entityPaymentBridge";
import { resolvePaymentCompleteness } from "@/lib/finance/paymentCompleteness";
import { resolveCustomerIdentity, customerDisplayLabel } from "@/lib/finance/customerBridge";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import { Link } from "react-router-dom";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { linkLeadAfterDelivery } from "@/lib/crmLookup/leadCustomerLifecycle";
import {
  assertDeliveryHasCanonicalCustomer,
  parseInsertRowId,
} from "@/lib/crmLookup/entitySaveHelpers";
import { resolveFormCustomerLink } from "@/lib/crmLookup/resolveFormCustomerLink";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import type { FinanceRawContext } from "@/lib/finance/factDrafts";

interface Props {
  records: HostingRecordRow[];
  ctx: FinanceRawContext;
  onSaved: () => void;
}

const emptyForm = () => ({
  client_name: "",
  customer_email: "",
  customer_id: null as string | null,
  lead_id: null as string | null,
  provider: "",
  domains_count: "",
  monthly_price: "",
  acquired_by: "",
  commissionable: false,
  note: "",
});

export function FinanceHostingPanel({ records, ctx, onSaved }: Props) {
  const access = useAdminAccess();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({ onSuccess: onSaved });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formBaseline, setFormBaseline] = useState(emptyForm());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openHostingDialog = useCallback((opts?: { reset?: boolean }) => {
    if (opts?.reset !== false) {
      const blank = emptyForm();
      setFormBaseline(blank);
      setForm(blank);
    }
    setCustomerFieldError(null);
    setDialogOpen(true);
  }, []);

  const { discardDraft: discardHostingDraft, clearDraft: clearHostingDraft } = useCrmDraft({
    modalId: "hosting-create",
    route: "/admin/hosting",
    entityId: "new",
    isActive: dialogOpen,
    data: form,
    baseline: formBaseline,
    onRestore: (draft) => setForm(draft as ReturnType<typeof emptyForm>),
  });

  const closeHostingDialog = useCallback(() => {
    clearHostingDraft();
    clearCrmViewState();
    setDialogOpen(false);
    setCustomerFieldError(null);
    setForm(emptyForm());
    setFormBaseline(emptyForm());
    const next = new URLSearchParams(searchParams);
    next.delete("hosting");
    setSearchParams(next, { replace: true });
  }, [clearHostingDraft, searchParams, setSearchParams]);

  const discardHostingChanges = useCallback(() => {
    discardHostingDraft();
    clearCrmViewState();
  }, [discardHostingDraft]);

  useCrmViewRestore({
    route: "/admin/hosting",
    modalId: "hosting-create",
    entityId: dialogOpen ? "new" : null,
    isModalOpen: dialogOpen,
    query: dialogOpen ? { hosting: "new" } : undefined,
    onRestore: (state) => {
      if (dialogOpen || state.modalId !== "hosting-create") return;
      openHostingDialog({ reset: false });
    },
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const next = new URLSearchParams(searchParams);
    if (next.get("hosting") === "new") return;
    next.set("hosting", "new");
    setSearchParams(next, { replace: true });
  }, [dialogOpen, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("hosting") !== "new" || dialogOpen) return;
    openHostingDialog({ reset: false });
  }, [searchParams, dialogOpen, openHostingDialog]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    return records.filter((r) =>
      matchesSearchQuery(
        searchQuery,
        r.client_name,
        r.customer_email,
        r.provider,
        r.note,
        r.acquired_by,
      ),
    );
  }, [records, searchQuery]);

  const save = async (): Promise<boolean> => {
    const clientLabel = form.client_name.trim();
    if (!clientLabel && !form.customer_id && !form.customer_email.trim()) {
      toast({
        title: "Chýba klient",
        description: "Zadajte meno klienta alebo vyberte klienta / lead z vyhľadávania.",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      let linked;
      try {
        linked = await resolveFormCustomerLink({
          customer_id: form.customer_id,
          customer_email: form.customer_email,
          client_name: form.client_name,
          lead_id: form.lead_id,
          createIfMissing: true,
        });
      } catch (e) {
        toast({
          title: "Neplatný e-mail klienta",
          description: e instanceof Error ? e.message : "Skontrolujte e-mail alebo vyberte klienta z lookup.",
          variant: "destructive",
        });
        return false;
      }

      if (!linked.client_name && !linked.customer_id && !linked.customer_email) {
        toast({
          title: "Chýba identita klienta",
          description: "Vyberte klienta z vyhľadávania alebo zadajte meno firmy.",
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

      const { data: saved, error } = await supabase
        .from("hosting_records")
        .insert({
          client_name: linked.client_name || null,
          customer_email: linked.customer_email,
          customer_id: linked.customer_id,
          provider: form.provider.trim() || null,
          domains_count: form.domains_count ? Number(form.domains_count) : null,
          monthly_price: form.monthly_price ? Number(form.monthly_price) : null,
          acquired_by: form.acquired_by.trim() || null,
          commissionable: form.commissionable,
          note: form.note.trim() || null,
          active: true,
        })
        .select("id")
        .maybeSingle();

      const insertResult = parseInsertRowId(saved, error, "Hosting");
      if (!insertResult.ok) {
        toast({
          title: "Hosting sa nepodarilo uložiť",
          description: insertResult.error,
          variant: "destructive",
        });
        return false;
      }

      if (linked.lead_id && linked.customer_id) {
        await linkLeadAfterDelivery(linked.lead_id, linked.customer_id);
      }

      logEntityCommunicationEventSafe({
        kind: "hosting_event",
        title: linked.client_name || "Hosting záznam",
        body_preview: form.provider || form.note || null,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "hosting_records",
        source_id: insertResult.id,
        idempotency_key: `hosting_records:${insertResult.id}:created`,
        metadata: { action: "created" },
      });

      if (access.userId) {
        logCrmEvent({
          actorUserId: access.userId,
          actionType: CRM_HISTORY_ACTIONS.entity_created,
          entityType: "hosting_records",
          entityId: insertResult.id,
          entityLabel: linked.client_name || form.provider || "Hosting",
          summary: `Vytvorený hosting: ${linked.client_name || form.provider || insertResult.id}`,
        });
      }

      toast({
        title: "Hosting vytvorený",
        description: "Otváram detail záznamu…",
      });
      discardHostingDraft();
      clearCrmViewState();
      setForm(emptyForm());
      setFormBaseline(emptyForm());
      closeHostingDialog();
      onSaved();
      navigate(`/admin/hosting/${insertResult.id}`);
      return true;
    } finally {
      setSaving(false);
    }
  };

  const hostingCloseGuard = useAdminCloseGuard({
    isOpen: dialogOpen,
    current: form,
    onSave: save,
    onDiscard: discardHostingChanges,
    saving,
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Hosting je oddelený od prenájmového streamu. Platobný fakt je voliteľný — bez auto-sync.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <AdminListSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Hľadať klienta, poskytovateľa, poznámku…"
          className="flex-1 max-w-md"
        />
        <Button size="sm" onClick={() => openHostingDialog({ reset: true })}>
          <Plus className="w-4 h-4 mr-1" /> Nový hosting
        </Button>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-xl">Žiadne hosting záznamy.</p>
      ) : filteredRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl">
          Žiadna zhoda pre vyhľadávanie.
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto table-dense">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Poskytovateľ</TableHead>
                <TableHead className="text-right">Mesiac</TableHead>
                <TableHead>Provízny</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Platba</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((r) => {
                const identity = resolveCustomerIdentity({
                  customerEmail: r.customer_email,
                  clientName: r.client_name,
                  rentalWebsiteId: r.rental_website_id,
                });
                const customerHref = adminCustomerHrefPreferred(
                  (r as HostingRecordRow & { customer_id?: string | null }).customer_id,
                  r.customer_email,
                );
                const confirmed = sumConfirmedPaymentsForSource(
                  ctx.paymentRecords,
                  "hosting_records",
                  r.id,
                );
                const agreed = resolveEntityAgreedPrice(r);
                const pc = resolvePaymentCompleteness(agreed > 0 ? agreed : null, confirmed);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      <Link to={`/admin/hosting/${r.id}`} className="text-primary hover:underline font-medium">
                        {customerDisplayLabel(identity)}
                      </Link>
                      {customerHref && (
                        <Link to={customerHref} className="block text-[10px] text-muted-foreground hover:underline">
                          Klient 360°
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.provider ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.monthly_price != null ? `${r.monthly_price} €` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.commissionable ? "default" : "outline"} className="text-[10px]">
                        {r.commissionable ? "áno" : "nie"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.active ? "secondary" : "outline"} className="text-[10px]">
                        {r.active ? "aktívny" : "neaktívny"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {confirmed > 0 ? (
                        <Badge
                          variant={
                            pc.status === "paid"
                              ? "secondary"
                              : pc.status === "partial"
                                ? "outline"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {confirmed} €
                          {agreed > 0 ? ` / ${agreed} €` : ""}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                      <Link
                        to={`/admin/hosting/${r.id}`}
                        className="block text-[10px] text-primary hover:underline mt-0.5"
                      >
                        Platby →
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Zmazať hosting"
                        onClick={() =>
                          void requestDelete({
                            entityType: "hosting",
                            entityId: r.id,
                            entityLabel: customerDisplayLabel(identity),
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {hostingCloseGuard.closeGuardDialog}

      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) hostingCloseGuard.handleOpenChange(o, closeHostingDialog);
        }}
        title="Nový hosting"
        stickyFooter
        footer={
          <>
            <Button variant="outline" onClick={() => hostingCloseGuard.requestClose(closeHostingDialog)}>
              Zrušiť
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </>
        }
      >
          <div className="space-y-3">
            <Field label="Klient">
              <ClientPicker
                clientName={form.client_name}
                customerEmail={form.customer_email}
                customerId={form.customer_id}
                leadId={form.lead_id}
                onChange={({ client_name, customer_email, customer_id, lead_id }) => {
                  setCustomerFieldError(null);
                  setForm({
                    ...form,
                    client_name,
                    customer_email: customer_email || "",
                    customer_id,
                    lead_id,
                  });
                }}
              />
              {customerFieldError && (
                <p className="text-destructive text-xs mt-1">{customerFieldError}</p>
              )}
            </Field>
            <Field label="Poskytovateľ"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
            <Field label="Počet domén"><Input type="number" value={form.domains_count} onChange={(e) => setForm({ ...form, domains_count: e.target.value })} /></Field>
            <Field label="Mesačná cena €"><Input type="number" step="0.1" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} /></Field>
            <Field label="Získal"><Input value={form.acquired_by} onChange={(e) => setForm({ ...form, acquired_by: e.target.value })} /></Field>
            <AdminLongTextField
              label="Poznámka"
              value={form.note}
              onChange={(note) => setForm({ ...form, note })}
              withDatePrefix={false}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.commissionable} onCheckedChange={(v) => setForm({ ...form, commissionable: !!v })} />
              Provízny (vyžaduje review)
            </label>
          </div>
      </AdminDialog>

      <DestructiveModal {...modalProps} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
