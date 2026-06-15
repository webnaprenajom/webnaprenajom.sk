import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Loader2, Plus, Trash2, Pencil, ExternalLink, UserRound } from "lucide-react";
import {
  adminCustomerHref,
  adminLeadHref,
  buildEmailLeadIdMap,
  buildNameLeadIdMap,
  leadIdByClientName,
  leadIdByEmail,
} from "@/lib/adminNav";

interface Proposal {
  id: string;
  client_name: string;
  email: string | null;
  design_url: string | null;
  sent_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUSES = [
  { v: "sent", label: "Zaslané", cls: "bg-blue-500/15 text-blue-600" },
  { v: "viewed", label: "Pozreté", cls: "bg-amber-500/15 text-amber-600" },
  { v: "approved", label: "Schválené", cls: "bg-emerald-500/15 text-emerald-600" },
  { v: "rejected", label: "Zamietnuté", cls: "bg-destructive/15 text-destructive" },
  { v: "revision", label: "Úpravy", cls: "bg-purple-500/15 text-purple-600" },
];

const emptyForm = { client_name: "", email: "", design_url: "", sent_date: new Date().toISOString().slice(0, 10), status: "sent", notes: "" };

export default function AdminDesigns() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Proposal[]>([]);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [emailLeadIdMap, setEmailLeadIdMap] = useState<Map<string, string>>(new Map());
  const [nameLeadIdMap, setNameLeadIdMap] = useState<Map<string, string>>(new Map());

  const designFormGuard = useUnsavedChangesGuard({
    isOpen: open,
    current: form,
  });

  const requestCloseDesignDialog = () => {
    if (!designFormGuard.confirmDiscard()) return;
    setOpen(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [designsRes, leadsRes] = await Promise.all([
      supabase.from("design_proposals").select("*").order("sent_date", { ascending: false }),
      supabase.from("leads").select("id,name,email"),
    ]);
    if (designsRes.error) toast({ title: "Chyba", description: designsRes.error.message, variant: "destructive" });
    else setRows((designsRes.data || []) as Proposal[]);
    if (!leadsRes.error && leadsRes.data) {
      setEmailLeadIdMap(buildEmailLeadIdMap(leadsRes.data));
      setNameLeadIdMap(buildNameLeadIdMap(leadsRes.data));
    }
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: Proposal) => {
    setEditing(p);
    setForm({
      client_name: p.client_name, email: p.email || "", design_url: p.design_url || "",
      sent_date: p.sent_date, status: p.status, notes: p.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_name.trim()) return toast({ title: "Zadajte meno klienta", variant: "destructive" });
    const payload = {
      client_name: form.client_name.trim(),
      email: form.email.trim() || null,
      design_url: form.design_url.trim() || null,
      sent_date: form.sent_date,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("design_proposals").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("design_proposals").insert(payload);
      if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    }
    setOpen(false);
    void load();
    toast({ title: editing ? "Uložené" : "Pridané" });
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("design_proposals").delete().eq("id", deleting);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { setRows((p) => p.filter((r) => r.id !== deleting)); toast({ title: "Vymazané" }); }
    setDeleting(null);
  };

  return (
    <AdminShell
      title="Zaslané dizajny"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nový
        </Button>
      }
    >
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Zatiaľ žiadne zaslané dizajny.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>URL dizajnu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = STATUSES.find((s) => s.v === r.status);
                  const leadId =
                    leadIdByEmail(r.email, emailLeadIdMap) ??
                    leadIdByClientName(r.client_name, nameLeadIdMap);
                  const customerHref = r.email ? adminCustomerHref(r.email) : null;
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">{new Date(r.sent_date).toLocaleDateString("sk-SK")}</TableCell>
                      <TableCell className="font-semibold">
                        <div>{r.client_name}</div>
                        {(leadId || customerHref) && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {leadId && (
                              <Link
                                to={adminLeadHref(leadId)}
                                className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                              >
                                <UserRound className="w-3 h-3" /> Lead
                              </Link>
                            )}
                            {customerHref && (
                              <Link
                                to={customerHref}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Zákazník 360°
                              </Link>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{r.email || "—"}</TableCell>
                      <TableCell>
                        {r.design_url ? (
                          <a href={r.design_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline max-w-[280px] truncate">
                            {r.design_url} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell><Badge className={st?.cls}>{st?.label || r.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AdminDialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : requestCloseDesignDialog())}
        size="lg"
        title={editing ? "Upraviť dizajn" : "Nový zaslaný dizajn"}
        footer={
          <>
            <Button variant="outline" onClick={requestCloseDesignDialog}>Zrušiť</Button>
            <Button onClick={save}>{editing ? "Uložiť" : "Pridať"}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Meno klienta *</Label>
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Dátum zaslania</Label>
              <Input type="date" value={form.sent_date} onChange={(e) => setForm({ ...form, sent_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>URL dizajnu</Label>
            <Input value={form.design_url} onChange={(e) => setForm({ ...form, design_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Poznámka</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </AdminDialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať záznam?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={remove}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
