import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  ShieldAlert,
  LogOut,
  Wallet,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  Copy,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

type PaymentStatus = "paid" | "unpaid";

interface Commission {
  id: string;
  date: string;
  title: string;
  implementer: string;
  amount: number;
  payment_status: PaymentStatus;
  note: string | null;
  created_at: string;
}

interface Expense {
  id: string;
  date: string;
  title: string;
  category: string | null;
  amount: number;
  payment_status: PaymentStatus;
  note: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: "Vyplatené", className: "bg-green-500/15 text-green-500 border-green-500/30" },
  unpaid: { label: "Nevyplatené", className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyCommission = () => ({
  id: "",
  date: todayISO(),
  title: "",
  implementer: "",
  amount: "",
  payment_status: "unpaid" as PaymentStatus,
  note: "",
});

const emptyExpense = () => ({
  id: "",
  date: todayISO(),
  title: "",
  category: "",
  amount: "",
  payment_status: "unpaid" as PaymentStatus,
  note: "",
});

const AdminCommissions = () => {
  const navigate = useNavigate();
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();

  // Commissions
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCommission());

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [expStatusFilter, setExpStatusFilter] = useState<string>("all");
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [savingExp, setSavingExp] = useState(false);
  const [expForm, setExpForm] = useState(emptyExpense());

  useEffect(() => {
    document.title = "Provízie & Náklady | CRM";
  }, [navigate]);

  useEffect(() => {
    if (authChecking) return;

    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }

    if (isAdmin) {
      void load();
      void loadExpenses();
      return;
    }

    setLoading(false);
    setLoadingExp(false);
  }, [authChecking, isAdmin, navigate, userId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    else setItems((data || []) as Commission[]);
    setLoading(false);
  };

  const loadExpenses = async () => {
    setLoadingExp(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Chyba načítania", description: error.message, variant: "destructive" });
    else setExpenses((data || []) as Expense[]);
    setLoadingExp(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  // ===== Commissions =====
  const openNew = () => { setForm(emptyCommission()); setDialogOpen(true); };
  const openEdit = (c: Commission) => {
    setForm({
      id: c.id, date: c.date, title: c.title, implementer: c.implementer,
      amount: String(c.amount ?? ""), payment_status: c.payment_status, note: c.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.implementer.trim()) {
      toast({ title: "Vyplň názov a implementátora", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      date: form.date || todayISO(),
      title: form.title.trim(),
      implementer: form.implementer.trim(),
      amount: parseFloat(form.amount.replace(",", ".")) || 0,
      payment_status: form.payment_status,
      note: form.note.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("commissions").update(payload).eq("id", form.id)
      : await supabase.from("commissions").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" }); return; }
    toast({ title: form.id ? "Provízia upravená" : "Provízia pridaná" });
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať túto províziu?")) return;
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); load(); }
  };

  const togglePaid = async (c: Commission) => {
    const next: PaymentStatus = c.payment_status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("commissions").update({ payment_status: next }).eq("id", c.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else load();
  };

  // ===== Expenses =====
  const openNewExp = () => { setExpForm(emptyExpense()); setExpDialogOpen(true); };
  const openEditExp = (e: Expense) => {
    setExpForm({
      id: e.id, date: e.date, title: e.title, category: e.category ?? "",
      amount: String(e.amount ?? ""), payment_status: e.payment_status, note: e.note ?? "",
    });
    setExpDialogOpen(true);
  };

  const saveExp = async () => {
    if (!expForm.title.trim()) {
      toast({ title: "Vyplň názov nákladu", variant: "destructive" });
      return;
    }
    setSavingExp(true);
    const payload = {
      date: expForm.date || todayISO(),
      title: expForm.title.trim(),
      category: expForm.category.trim() || null,
      amount: parseFloat(expForm.amount.replace(",", ".")) || 0,
      payment_status: expForm.payment_status,
      note: expForm.note.trim() || null,
    };
    const { error } = expForm.id
      ? await supabase.from("expenses").update(payload).eq("id", expForm.id)
      : await supabase.from("expenses").insert(payload);
    setSavingExp(false);
    if (error) { toast({ title: "Chyba uloženia", description: error.message, variant: "destructive" }); return; }
    toast({ title: expForm.id ? "Náklad upravený" : "Náklad pridaný" });
    setExpDialogOpen(false);
    loadExpenses();
  };

  const removeExp = async (id: string) => {
    if (!confirm("Naozaj zmazať tento náklad?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Zmazané" }); loadExpenses(); }
  };

  const duplicateExp = (e: Expense) => {
    setExpForm({
      id: "",
      date: todayISO(),
      title: e.title,
      category: e.category ?? "",
      amount: String(e.amount ?? ""),
      payment_status: "unpaid",
      note: e.note ?? "",
    });
    setExpDialogOpen(true);
  };

  const togglePaidExp = async (e: Expense) => {
    const next: PaymentStatus = e.payment_status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("expenses").update({ payment_status: next }).eq("id", e.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else loadExpenses();
  };

  const filtered = useMemo(
    () => items.filter((i) => statusFilter === "all" || i.payment_status === statusFilter),
    [items, statusFilter],
  );

  const filteredExp = useMemo(
    () => expenses.filter((e) => expStatusFilter === "all" || e.payment_status === expStatusFilter),
    [expenses, expStatusFilter],
  );

  const totals = useMemo(() => {
    const paid = items.filter((i) => i.payment_status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const unpaid = items.filter((i) => i.payment_status === "unpaid").reduce((s, i) => s + Number(i.amount || 0), 0);
    return { paid, unpaid, total: paid + unpaid };
  }, [items]);

  const expTotals = useMemo(() => {
    const paid = expenses.filter((i) => i.payment_status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const unpaid = expenses.filter((i) => i.payment_status === "unpaid").reduce((s, i) => s + Number(i.amount || 0), 0);
    return { paid, unpaid, total: paid + unpaid };
  }, [expenses]);

  if (authChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Nemáte prístup</h1>
          <p className="text-muted-foreground">Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu.</p>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/admin")} variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <Wallet className="w-5 h-5 text-primary" />
                Provízie & Náklady
              </h1>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button onClick={handleSignOut} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <Tabs defaultValue="commissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="commissions"><Wallet className="w-4 h-4 mr-2" />Provízie</TabsTrigger>
            <TabsTrigger value="expenses"><Receipt className="w-4 h-4 mr-2" />Náklady</TabsTrigger>
          </TabsList>

          {/* COMMISSIONS TAB */}
          <TabsContent value="commissions" className="space-y-4">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Vyplatené</div>
                <div className="text-2xl font-bold text-green-500">{totals.paid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Nevyplatené</div>
                <div className="text-2xl font-bold text-yellow-500">{totals.unpaid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Spolu</div>
                <div className="text-2xl font-bold">{totals.total.toFixed(2)} €</div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Stav" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky stavy</SelectItem>
                  <SelectItem value="unpaid">Nevyplatené</SelectItem>
                  <SelectItem value="paid">Vyplatené</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-2" /> Nová provízia</Button>
            </section>

            <section className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">Žiadne provízie</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Dátum</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead>Implementátor</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>Poznámka</TableHead>
                        <TableHead className="text-right">Akcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const cfg = STATUS_CONFIG[c.payment_status];
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                              {new Date(c.date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{c.title}</TableCell>
                            <TableCell className="text-sm">{c.implementer}</TableCell>
                            <TableCell className="text-sm text-right font-semibold whitespace-nowrap">{Number(c.amount || 0).toFixed(2)} €</TableCell>
                            <TableCell>
                              <button onClick={() => togglePaid(c)} title="Prepnúť stav">
                                <Badge variant="outline" className={`text-xs cursor-pointer ${cfg.className}`}>{cfg.label}</Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                              <div className="line-clamp-2 break-words">{c.note || <span className="italic opacity-60">—</span>}</div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-4">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Uhradené</div>
                <div className="text-2xl font-bold text-red-500">−{expTotals.paid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Neuhradené</div>
                <div className="text-2xl font-bold text-red-400">−{expTotals.unpaid.toFixed(2)} €</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Spolu náklady</div>
                <div className="text-2xl font-bold text-red-500">−{expTotals.total.toFixed(2)} €</div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 justify-between">
              <Select value={expStatusFilter} onValueChange={setExpStatusFilter}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Stav" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky stavy</SelectItem>
                  <SelectItem value="unpaid">Neuhradené</SelectItem>
                  <SelectItem value="paid">Uhradené</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openNewExp} size="sm"><Plus className="w-4 h-4 mr-2" /> Nový náklad</Button>
            </section>

            <section className="rounded-xl border border-border bg-card overflow-hidden">
              {loadingExp ? (
                <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredExp.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">Žiadne náklady</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Dátum</TableHead>
                        <TableHead>Názov</TableHead>
                        <TableHead>Kategória</TableHead>
                        <TableHead className="text-right">Suma</TableHead>
                        <TableHead>Stav</TableHead>
                        <TableHead>Poznámka</TableHead>
                        <TableHead className="text-right">Akcie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExp.map((e) => {
                        const cfg = STATUS_CONFIG[e.payment_status];
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                              {new Date(e.date).toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{e.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.category || <span className="italic opacity-60">—</span>}</TableCell>
                            <TableCell className="text-sm text-right font-semibold whitespace-nowrap text-red-500">−{Number(e.amount || 0).toFixed(2)} €</TableCell>
                            <TableCell>
                              <button onClick={() => togglePaidExp(e)} title="Prepnúť stav">
                                <Badge variant="outline" className={`text-xs cursor-pointer ${cfg.className}`}>{cfg.label === "Vyplatené" ? "Uhradené" : "Neuhradené"}</Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                              <div className="line-clamp-2 break-words">{e.note || <span className="italic opacity-60">—</span>}</div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => openEditExp(e)} title="Upraviť"><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => duplicateExp(e)} title="Duplikovať"><Copy className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => removeExp(e.id)} title="Zmazať"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* Commission dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Upraviť províziu" : "Nová provízia"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dátum</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Názov</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="napr. Web pre klienta XY" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Meno implementátora</label>
              <Input value={form.implementer} onChange={(e) => setForm({ ...form, implementer: e.target.value })} placeholder="Meno a priezvisko" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Stav vyplatenia</label>
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Nevyplatené</SelectItem>
                  <SelectItem value="paid">Vyplatené</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} />
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

      {/* Expense dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{expForm.id ? "Upraviť náklad" : "Nový náklad"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dátum</label>
                <Input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Suma (€)</label>
                <Input type="number" step="0.01" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Názov</label>
              <Input value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="napr. Hosting, Resend, doména" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Kategória</label>
              <Input value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} placeholder="napr. Software, Marketing, Doména" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Stav</label>
              <Select value={expForm.payment_status} onValueChange={(v) => setExpForm({ ...expForm, payment_status: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Neuhradené</SelectItem>
                  <SelectItem value="paid">Uhradené</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <Textarea value={expForm.note} onChange={(e) => setExpForm({ ...expForm, note: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={saveExp} disabled={savingExp}>
              {savingExp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminCommissions;
