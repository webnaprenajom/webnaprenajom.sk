import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { TRUTH_LEVEL_LABELS } from "@/lib/finance/labels";
import { resolveCustomerIdentity, customerDisplayLabel } from "@/lib/finance/customerBridge";
import { FactConfirmDialog } from "@/components/admin/finance/FactConfirmDialog";
import {
  type FactDraft,
  type FinanceRawContext,
  hasPromotedFactForLegacy,
  prefillFromLegacyRecord,
} from "@/lib/finance/factDrafts";
import { Loader2, Lock, Pencil, Plus, Trash2, CheckCircle2 } from "lucide-react";

type RecordKind = "payment" | "payout" | "cost";

interface FinanceRecordsCrudProps {
  paymentRecords: any[];
  payoutRecords: any[];
  costRecords: any[];
  onSaved: () => void;
}

const todayLocal = () => new Date().toISOString().slice(0, 16);

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
};

const fromLocalInput = (local: string) => {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
};

const isLegacy = (truthLevel: string) => truthLevel === "legacy_import";

export function FinanceRecordsCrud({
  paymentRecords,
  payoutRecords,
  costRecords,
  onSaved,
}: FinanceRecordsCrudProps) {
  const [tab, setTab] = useState<RecordKind>("payment");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<RecordKind>("payment");
  const [editId, setEditId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [promoteDraft, setPromoteDraft] = useState<FactDraft | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const ctx: FinanceRawContext = {
    commissions: [],
    expenses: [],
    websites: [],
    payments: [],
    paymentRecords,
    payoutRecords,
    costRecords,
  };

  const openPromote = (k: RecordKind, row: any) => {
    const draft = prefillFromLegacyRecord(k, row);
    setPromoteDraft(draft);
    setPromoteOpen(true);
  };

  const canPromote = (k: RecordKind, row: any) =>
    isLegacy(row.truth_level) && !hasPromotedFactForLegacy(ctx, k, row);

  const openCreate = (k: RecordKind) => {
    setKind(k);
    setEditId(null);
    setReadOnly(false);
    setForm(
      k === "payment"
        ? { amount: "", paid_at: todayLocal(), method: "", reference: "", customer_email: "", client_name: "", note: "" }
        : k === "payout"
          ? { amount: "", paid_at: todayLocal(), implementer: "", reference: "", note: "" }
          : { amount: "", paid_at: todayLocal(), incurred_at: todayLocal(), category: "", vendor: "", reference: "", note: "" },
    );
    setDialogOpen(true);
  };

  const openEdit = (k: RecordKind, row: any) => {
    setKind(k);
    setEditId(row.id);
    const legacy = isLegacy(row.truth_level);
    setReadOnly(legacy);
    if (k === "payment") {
      setForm({
        amount: String(row.amount ?? ""),
        paid_at: toLocalInput(row.paid_at),
        method: row.method ?? "",
        reference: row.reference ?? "",
        customer_email: row.customer_email ?? "",
        client_name: row.client_name ?? "",
        note: row.note ?? "",
      });
    } else if (k === "payout") {
      setForm({
        amount: String(row.amount ?? ""),
        paid_at: toLocalInput(row.paid_at),
        implementer: row.implementer ?? "",
        reference: row.reference ?? "",
        note: row.note ?? "",
      });
    } else {
      setForm({
        amount: String(row.amount ?? ""),
        paid_at: toLocalInput(row.paid_at),
        incurred_at: toLocalInput(row.incurred_at),
        category: row.category ?? "",
        vendor: row.vendor ?? "",
        reference: row.reference ?? "",
        note: row.note ?? "",
      });
    }
    setDialogOpen(true);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Neplatná suma", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (kind === "payment") {
        const payload = {
          amount,
          paid_at: fromLocalInput(form.paid_at),
          method: form.method || null,
          reference: form.reference || null,
          customer_email: form.customer_email || null,
          client_name: form.client_name || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("payment_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("payment_records")
            .insert({ ...payload, truth_level: "payment_fact" });
          if (error) throw error;
        }
      } else if (kind === "payout") {
        const payload = {
          amount,
          paid_at: fromLocalInput(form.paid_at),
          implementer: form.implementer || null,
          reference: form.reference || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("payout_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("payout_records")
            .insert({ ...payload, truth_level: "payout_fact" });
          if (error) throw error;
        }
      } else {
        const paidAt = form.paid_at ? fromLocalInput(form.paid_at) : null;
        const incurredAt = form.incurred_at ? fromLocalInput(form.incurred_at) : null;
        if (!paidAt && !incurredAt) {
          toast({ title: "Zadajte paid_at alebo incurred_at", variant: "destructive" });
          setSaving(false);
          return;
        }
        const payload = {
          amount,
          paid_at: paidAt,
          incurred_at: incurredAt,
          category: form.category || null,
          vendor: form.vendor || null,
          reference: form.reference || null,
          note: form.note || null,
          currency: "EUR",
        };
        if (editId && !readOnly) {
          const { error } = await supabase.from("cost_records").update(payload).eq("id", editId);
          if (error) throw error;
        } else if (!editId) {
          const { error } = await supabase
            .from("cost_records")
            .insert({ ...payload, truth_level: "cost_fact" });
          if (error) throw error;
        }
      }
      toast({ title: editId ? "Uložené" : "Vytvorené" });
      setDialogOpen(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const remove = async (k: RecordKind, id: string, truthLevel: string) => {
    if (isLegacy(truthLevel)) {
      toast({
        title: "Legacy import nie je zmazaný",
        description: "Vytvorte nový potvrdený záznam namiesto mazania legacy dát.",
      });
      return;
    }
    if (!window.confirm("Zmazať potvrdený záznam?")) return;
    const table =
      k === "payment" ? "payment_records" : k === "payout" ? "payout_records" : "cost_records";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Zmazané" });
    onSaved();
  };

  const truthBadge = (tl: string) => (
    <Badge variant={isLegacy(tl) ? "secondary" : "default"} className="text-[10px]">
      {TRUTH_LEVEL_LABELS[tl] ?? tl}
    </Badge>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Nové záznamy = potvrdené fakty. Legacy import je read-only — pre opravu vytvorte nový potvrdený záznam.
      </p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as RecordKind)}>
        <TabsList>
          <TabsTrigger value="payment">Platby ({paymentRecords.length})</TabsTrigger>
          <TabsTrigger value="payout">Výplaty ({payoutRecords.length})</TabsTrigger>
          <TabsTrigger value="cost">Náklady ({costRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="payment" className="mt-3">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => openCreate("payment")}>
              <Plus className="w-4 h-4 mr-1" /> Nová platba
            </Button>
          </div>
          <RecordsTable
            rows={paymentRecords}
            columns={["Dátum", "Klient", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-sm">
                  {customerDisplayLabel(
                    resolveCustomerIdentity({
                      customerEmail: r.customer_email,
                      clientName: r.client_name,
                    }),
                  )}
                </TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("payment", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("payment", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("payment", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("payment", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="payout" className="mt-3">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => openCreate("payout")}>
              <Plus className="w-4 h-4 mr-1" /> Nová výplata
            </Button>
          </div>
          <RecordsTable
            rows={payoutRecords}
            columns={["Dátum", "Implementér", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-sm">{r.implementer ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("payout", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("payout", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("payout", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("payout", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </TabsContent>

        <TabsContent value="cost" className="mt-3">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={() => openCreate("cost")}>
              <Plus className="w-4 h-4 mr-1" /> Nový náklad
            </Button>
          </div>
          <RecordsTable
            rows={costRecords}
            columns={["Dátum", "Kategória", "Suma", "Ref.", "Truth", ""]}
            renderRow={(r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{(r.paid_at ?? r.incurred_at)?.slice(0, 10) ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.category ?? r.vendor ?? "—"}</TableCell>
                <TableCell className="text-right">{Number(r.amount).toFixed(2)} €</TableCell>
                <TableCell className="text-xs">{r.reference ?? "—"}</TableCell>
                <TableCell>{truthBadge(r.truth_level)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {canPromote("cost", r) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Potvrdiť ako fact" onClick={() => openPromote("cost", r)}>
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit("cost", r)}>
                    {isLegacy(r.truth_level) ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                  </Button>
                  {!isLegacy(r.truth_level) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => remove("cost", r.id, r.truth_level)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {readOnly
                ? "Legacy import (read-only)"
                : editId
                  ? "Upraviť potvrdený záznam"
                  : kind === "payment"
                    ? "Nová potvrdená platba"
                    : kind === "payout"
                      ? "Nová potvrdená výplata"
                      : "Nový potvrdený náklad"}
            </DialogTitle>
          </DialogHeader>
          {readOnly && (
            <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
              Legacy import nie je editovateľný. Pre korekciu vytvorte nový záznam s truth_level=fact.
            </p>
          )}
          <div className="space-y-3">
            <Field label="Suma (€)">
              <Input type="number" step="0.01" value={form.amount} disabled={readOnly} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            {kind === "payment" && (
              <>
                <Field label="Dátum platby">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Metóda">
                  <Input value={form.method} disabled={readOnly} onChange={(e) => setForm({ ...form, method: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
                <Field label="Email zákazníka">
                  <Input value={form.customer_email} disabled={readOnly} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                </Field>
                <Field label="Klient">
                  <Input value={form.client_name} disabled={readOnly} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </Field>
              </>
            )}
            {kind === "payout" && (
              <>
                <Field label="Dátum výplaty">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Implementér">
                  <Input value={form.implementer} disabled={readOnly} onChange={(e) => setForm({ ...form, implementer: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
              </>
            )}
            {kind === "cost" && (
              <>
                <Field label="Dátum úhrady">
                  <Input type="datetime-local" value={form.paid_at} disabled={readOnly} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
                </Field>
                <Field label="Dátum vzniku">
                  <Input type="datetime-local" value={form.incurred_at} disabled={readOnly} onChange={(e) => setForm({ ...form, incurred_at: e.target.value })} />
                </Field>
                <Field label="Kategória">
                  <Input value={form.category} disabled={readOnly} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </Field>
                <Field label="Dodávateľ">
                  <Input value={form.vendor} disabled={readOnly} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </Field>
                <Field label="Referencia">
                  <Input value={form.reference} disabled={readOnly} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Poznámka">
              <Textarea rows={2} value={form.note} disabled={readOnly} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zavrieť</Button>
            {!readOnly && (
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uložiť
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FactConfirmDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        draft={promoteDraft}
        mode="promote"
        onSaved={onSaved}
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

function RecordsTable({
  rows,
  columns,
  renderRow,
}: {
  rows: any[];
  columns: string[];
  renderRow: (row: any) => ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Žiadne záznamy</div>;
  }
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
