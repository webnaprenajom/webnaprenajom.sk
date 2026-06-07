import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Loader2, ShieldAlert, Palette, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";
import { useAdminAccess } from "@/hooks/useAdminAccess";

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
  const navigate = useNavigate();
  const { authChecking, isAdmin } = useAdminAccess();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Proposal[]>([]);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("design_proposals").select("*").order("sent_date", { ascending: false });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else setRows((data || []) as Proposal[]);
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

  if (authChecking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <ShieldAlert className="w-10 h-10 text-destructive" /><p>Prístup zamietnutý</p>
        <Button onClick={() => navigate("/auth")}>Prihlásiť</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> CRM
            </Button>
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" /> Zaslané dizajny
            </h1>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nový</Button>
        </div>
      </header>

      <div className="container mx-auto px-3 py-6">
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
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap">{new Date(r.sent_date).toLocaleDateString("sk-SK")}</TableCell>
                        <TableCell className="font-semibold">{r.client_name}</TableCell>
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Upraviť dizajn" : "Nový zaslaný dizajn"}</DialogTitle></DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={save}>{editing ? "Uložiť" : "Pridať"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať záznam?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={remove}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
