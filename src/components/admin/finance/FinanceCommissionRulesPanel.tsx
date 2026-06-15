import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus } from "lucide-react";
import {
  type CommissionRule,
  type CommissionRuleOverride,
  type RevenueStreamKind,
  REVENUE_STREAM_LABELS,
  resolveCommissionRate,
} from "@/lib/finance/commissionRules";

interface Props {
  rules: CommissionRule[];
  overrides: CommissionRuleOverride[];
  onSaved: () => void;
}

export function FinanceCommissionRulesPanel({ rules, overrides, onSaved }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    customer_email: "",
    revenue_stream_kind: "rental" as RevenueStreamKind,
    override_rate: "30",
    reason: "",
  });

  const overrideFormGuard = useUnsavedChangesGuard({
    isOpen: dialogOpen,
    current: form,
  });

  const requestCloseOverrideDialog = () => {
    if (!overrideFormGuard.confirmDiscard()) return;
    setDialogOpen(false);
  };

  const preview = resolveCommissionRate({
    revenueStreamKind: form.revenue_stream_kind,
    rules,
    overrides,
    clientName: form.client_name || null,
    customerEmail: form.customer_email || null,
  });

  const saveOverride = async () => {
    if (!form.client_name && !form.customer_email) {
      toast({ title: "Zadajte client_name alebo customer_email", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("commission_rule_overrides").insert({
      client_name: form.client_name || null,
      customer_email: form.customer_email || null,
      revenue_stream_kind: form.revenue_stream_kind,
      override_rate: Number(form.override_rate),
      reason: form.reason || null,
      active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Override vytvorený" });
    setDialogOpen(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Foundation model — neprepisuje confirmed payout facts. Rental split je stále primárne v rental_websites.implementers JSON.
      </p>

      <section>
        <h3 className="text-sm font-semibold mb-2">Default rules</h3>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Názov</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead>Stav</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.name}</TableCell>
                  <TableCell className="text-xs">{REVENUE_STREAM_LABELS[r.revenue_stream_kind]}</TableCell>
                  <TableCell className="text-right">{Number(r.default_rate)}%</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">
                      {r.active ? "active" : "off"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Overrides ({overrides.filter((o) => o.active).length})</h3>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nový override
          </Button>
        </div>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žiadne overrides.</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cieľ</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead className="text-right">Rate %</TableHead>
                  <TableHead>Dôvod</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">
                      {o.client_name ?? o.customer_email ?? o.rental_website_id?.slice(0, 8) ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{o.revenue_stream_kind ?? "—"}</TableCell>
                    <TableCell className="text-right">{Number(o.override_rate)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AdminDialog
        open={dialogOpen}
        onOpenChange={(o) => (o ? setDialogOpen(true) : requestCloseOverrideDialog())}
        size="md"
        title="Nový commission override"
        footer={
          <>
            <Button variant="outline" onClick={requestCloseOverrideDialog}>Zrušiť</Button>
            <Button onClick={() => void saveOverride()} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Client name">
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
          <Field label="Customer email">
            <Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          </Field>
          <Field label="Revenue stream">
            <select
              className="w-full h-9 rounded-md border px-3 text-sm"
              value={form.revenue_stream_kind}
              onChange={(e) => setForm({ ...form, revenue_stream_kind: e.target.value as RevenueStreamKind })}
            >
              {Object.entries(REVENUE_STREAM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Override rate %">
            <Input type="number" value={form.override_rate} onChange={(e) => setForm({ ...form, override_rate: e.target.value })} />
          </Field>
          <Field label="Dôvod">
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Preview effective rate: {preview.rate}% ({preview.source})
          </p>
        </div>
      </AdminDialog>
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
