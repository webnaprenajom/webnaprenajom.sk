import { useMemo, useState, type ReactNode } from "react";
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
import { adminCustomerHref } from "@/lib/adminNav";
import { Link } from "react-router-dom";

interface Props {
  records: HostingRecordRow[];
  ctx: FinanceRawContext;
  onSaved: () => void;
}

const emptyForm = () => ({
  client_name: "",
  customer_email: "",
  provider: "",
  domains_count: "",
  monthly_price: "",
  acquired_by: "",
  commissionable: false,
  note: "",
});

export function FinanceHostingPanel({ records, ctx, onSaved }: Props) {
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
    setSaving(true);
    const { error } = await supabase.from("hosting_records").insert({
      client_name: form.client_name || null,
      customer_email: form.customer_email || null,
      provider: form.provider || null,
      domains_count: form.domains_count ? Number(form.domains_count) : null,
      monthly_price: form.monthly_price ? Number(form.monthly_price) : null,
      acquired_by: form.acquired_by || null,
      commissionable: form.commissionable,
      note: form.note || null,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hosting record vytvorený" });
    setForm(emptyForm());
    setDialogOpen(false);
    onSaved();
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
        Hosting je oddelený od rental streamu. Payment fact je opt-in — bez auto-sync.
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
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Mesiac</TableHead>
                <TableHead>Commissionable</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => {
                const identity = resolveCustomerIdentity({
                  customerEmail: r.customer_email,
                  clientName: r.client_name,
                  rentalWebsiteId: r.rental_website_id,
                });
                const customerHref = identity.email ? adminCustomerHref(identity.email) : null;
                const hasPayment = linkedIds.has(r.id) || hasSourceLinkedRecord(ctx, "hosting_records", r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {customerHref ? (
                        <Link to={customerHref} className="text-primary hover:underline">
                          {customerDisplayLabel(identity)}
                        </Link>
                      ) : (
                        customerDisplayLabel(identity)
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
                        {r.active ? "active" : "off"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {hasPayment ? (
                        <Badge variant="secondary" className="text-[10px]">payment_fact</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => openPaymentFact(r)}
                        >
                          Vytvoriť payment
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
            <DialogTitle>Nový hosting record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Client name"><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></Field>
            <Field label="Email"><Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></Field>
            <Field label="Provider"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
            <Field label="Domains"><Input type="number" value={form.domains_count} onChange={(e) => setForm({ ...form, domains_count: e.target.value })} /></Field>
            <Field label="Monthly price €"><Input type="number" step="0.01" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} /></Field>
            <Field label="Acquired by"><Input value={form.acquired_by} onChange={(e) => setForm({ ...form, acquired_by: e.target.value })} /></Field>
            <Field label="Poznámka"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.commissionable} onCheckedChange={(v) => setForm({ ...form, commissionable: !!v })} />
              Commissionable (vyžaduje review)
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
