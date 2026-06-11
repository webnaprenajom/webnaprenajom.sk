import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil } from "lucide-react";
import { assigneeSelectOptions } from "@/lib/assignees";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import {
  COMMISSION_SOURCE_LABELS,
  type CommissionSourceType,
  type CommissionRow,
  resolveCommissionSourceLabel,
  sourceDetailHref,
} from "@/lib/commissionSource";
import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";
import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";

const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-green-500/15 text-green-500 border-green-500/30",
  unpaid: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
};

interface Props {
  sourceType: CommissionSourceType;
  sourceId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  defaultTitle?: string;
}

export function EntityCommissionsPanel({ sourceType, sourceId, customerEmail, customerId, defaultTitle }: Props) {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: "",
    date: todayISO(),
    title: "",
    implementer: "",
    amount: "",
    payment_status: "unpaid" as "paid" | "unpaid",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .order("date", { ascending: false });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as CommissionRow[]);
    }
    setLoading(false);
  }, [sourceType, sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setForm({
      id: "",
      date: todayISO(),
      title: defaultTitle || "",
      implementer: "",
      amount: "",
      payment_status: "unpaid",
      note: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (c: CommissionRow) => {
    setForm({
      id: c.id,
      date: c.date,
      title: c.title,
      implementer: c.implementer,
      amount: String(c.amount ?? ""),
      payment_status: c.payment_status as "paid" | "unpaid",
      note: c.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.implementer.trim()) {
      toast({ title: "Vyplň názov a realizátora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const linked = await resolveCustomerLinkFields({
      customer_id: customerId,
      customer_email: customerEmail,
      client_name: form.title,
    });
    const payload = {
      date: form.date || todayISO(),
      title: form.title.trim(),
      implementer: form.implementer.trim(),
      amount: parseFloat(form.amount.replace(",", ".")) || 0,
      payment_status: form.payment_status,
      note: form.note.trim() || null,
      source_type: sourceType,
      source_id: sourceId,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
    };
    const { data: saved, error } = form.id
      ? await supabase.from("commissions").update(payload).eq("id", form.id).select("id").maybeSingle()
      : await supabase.from("commissions").insert(payload).select("id").maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" });
      return;
    }
    const recordId = saved?.id ?? form.id;
    if (recordId && !form.id) {
      logEntityCommunicationEventSafe({
        kind: "commission",
        title: payload.title,
        body_preview: `${payload.amount.toFixed(2)} € · ${payload.payment_status === "paid" ? "vyplatené" : "nezaplatené"}`,
        customer_id: linked.customer_id,
        customer_email: linked.customer_email,
        source_table: "commissions",
        source_id: recordId,
        idempotency_key: `commissions:${recordId}:created`,
        metadata: { payment_status: payload.payment_status, action: "created" },
      });
    }
    toast({ title: form.id ? "Provízia upravená" : "Provízia pridaná" });
    setDialogOpen(false);
    void load();
  };

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const unpaid = rows.filter((r) => r.payment_status === "unpaid").reduce((s, r) => s + Number(r.amount || 0), 0);
    return { paid, unpaid };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-3 text-xs">
          <span className="text-green-600">Vyplatené: {totals.paid.toFixed(2)} €</span>
          <span className="text-amber-600">Nezaplatené: {totals.unpaid.toFixed(2)} €</span>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nová provízia
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-xl">
          Žiadne provízie prepojené s týmto záznamom.
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dátum</TableHead>
                <TableHead>Názov</TableHead>
                <TableHead>Realizátor</TableHead>
                <TableHead className="text-right">Suma</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="text-right">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(c.date).toLocaleDateString("sk-SK")}
                  </TableCell>
                  <TableCell className="text-sm">{resolveCommissionSourceLabel(c)}</TableCell>
                  <TableCell className="text-sm">{c.implementer}</TableCell>
                  <TableCell className="text-right font-medium">{Number(c.amount || 0).toFixed(2)} €</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.payment_status] ?? ""}`}>
                      {c.payment_status === "paid" ? COMMISSION_STATUS_LABELS.paid : COMMISSION_STATUS_LABELS.unpaid}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Zdroj: {COMMISSION_SOURCE_LABELS[sourceType]}. Staršie riadky bez source_id zostávajú v legacy zobrazení financií.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Upraviť províziu" : "Nová provízia"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dátum</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Názov</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Realizátor</label>
              <Select value={form.implementer || "__none__"} onValueChange={(v) => setForm({ ...form, implementer: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="— vyber —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— vyber —</SelectItem>
                  {assigneeSelectOptions(form.implementer).map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <NoteTextarea value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CommissionSourceLink({ row }: { row: CommissionRow }) {
  const href = sourceDetailHref(row.source_type as CommissionSourceType, row.source_id);
  const label = COMMISSION_SOURCE_LABELS[row.source_type as CommissionSourceType] ?? row.source_type ?? "—";
  if (!href) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <Link to={href} className="text-xs text-primary hover:underline">
      {label}
    </Link>
  );
}
