import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import {
  hasSourceLinkedRecord,
  prefillFromHosting,
  type FinanceRawContext,
  type FactDraft,
} from "@/lib/finance/factDrafts";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import { resolveCustomerIdentity, customerDisplayLabel } from "@/lib/finance/customerBridge";
import { adminCustomerHrefPreferred } from "@/lib/adminNav";
import { Link } from "react-router-dom";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { linkLeadAfterDelivery } from "@/lib/crmLookup/leadCustomerLifecycle";
import {
  parseInsertRowId,
  resolveFormCustomerLink,
} from "@/lib/crmLookup/resolveFormCustomerLink";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";

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
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [paymentDraft, setPaymentDraft] = useState<FactDraft | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const linkedIds = useMemo(
    () =>
      new Set(
        ctx.paymentRecords
          .filter((r) => r.source_table === "hosting_records" && r.source_id)
          .map((r) => r.source_id as string),
      ),
    [ctx.paymentRecords],
  );

  const save = async () => {
    const clientLabel = form.client_name.trim();
    if (!clientLabel && !form.customer_id && !form.customer_email.trim()) {
      toast({
        title: "Chýba klient",
        description: "Zadajte meno klienta alebo vyberte klienta / lead z vyhľadávania.",
        variant: "destructive",
      });
      return;
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
        return;
      }

      if (!linked.client_name && !linked.customer_id && !linked.customer_email) {
        toast({
          title: "Chýba identita klienta",
          description: "Vyberte klienta z vyhľadávania alebo zadajte meno firmy.",
          variant: "destructive",
        });
        return;
      }

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
        return;
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

      toast({
        title: "Hosting vytvorený",
        description: "Otváram detail záznamu…",
      });
      setForm(emptyForm());
      setDialogOpen(false);
      onSaved();
      navigate(`/admin/hosting/${insertResult.id}`);
    } finally {
      setSaving(false);
    }
  };

  const openPaymentFact = (record: HostingRecordRow) => {
    if (linkedIds.has(record.id) || hasSourceLinkedRecord(ctx, "hosting_records", record.id)) {
      toast({ title: "Payment fact už existuje", variant: "destructive" });
      return;
    }
    const draft = prefillFromHosting(record, ctx);
    if (!draft) {
      toast({
        title: "Nemožno vytvoriť draft",
        description: "Chýba cena alebo už existuje source-linked payment.",
        variant: "destructive",
      });
      return;
    }
    setPaymentDraft(draft);
    setPaymentOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Hosting je oddelený od prenájmového streamu. Platobný fakt je voliteľný — bez auto-sync.
      </p>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nový hosting
        </Button>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-xl">Žiadne hosting záznamy.</p>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Poskytovateľ</TableHead>
                <TableHead className="text-right">Mesiac</TableHead>
                <TableHead>Provízny</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Platba</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const identity = resolveCustomerIdentity({
                  customerEmail: r.customer_email,
                  clientName: r.client_name,
                  rentalWebsiteId: r.rental_website_id,
                });
                const customerHref = adminCustomerHrefPreferred(
                  (r as HostingRecordRow & { customer_id?: string | null }).customer_id,
                  r.customer_email,
                );
                const hasPayment = linkedIds.has(r.id) || hasSourceLinkedRecord(ctx, "hosting_records", r.id);
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
                      {hasPayment ? (
                        <Badge variant="secondary" className="text-[10px]">platobný fakt</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => openPaymentFact(r)}
                        >
                          Vytvoriť platbu
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nový hosting</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Klient">
              <ClientPicker
                clientName={form.client_name}
                customerEmail={form.customer_email}
                customerId={form.customer_id}
                leadId={form.lead_id}
                onChange={({ client_name, customer_email, customer_id, lead_id }) =>
                  setForm({
                    ...form,
                    client_name,
                    customer_email: customer_email || "",
                    customer_id,
                    lead_id,
                  })
                }
              />
            </Field>
            <Field label="Poskytovateľ"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
            <Field label="Počet domén"><Input type="number" value={form.domains_count} onChange={(e) => setForm({ ...form, domains_count: e.target.value })} /></Field>
            <Field label="Mesačná cena €"><Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} /></Field>
            <Field label="Získal"><Input value={form.acquired_by} onChange={(e) => setForm({ ...form, acquired_by: e.target.value })} /></Field>
            <Field label="Poznámka"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.commissionable} onCheckedChange={(v) => setForm({ ...form, commissionable: !!v })} />
              Provízny (vyžaduje review)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FactConfirmDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        draft={paymentDraft}
        mode="workflow"
        onSaved={() => {
          setPaymentOpen(false);
          setPaymentDraft(null);
          onSaved();
        }}
      />
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
