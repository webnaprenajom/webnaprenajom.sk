import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, Search, ShieldAlert, LogOut, Sparkles, Mail, Check, Trash2, Send, UserPlus,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

interface WheelRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
  prize_label: string;
  prize_value: number;
  coupon_code: string | null;
  language: string;
  redeemed: boolean;
  redeemed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

const AdminWheelLeads = () => {
  const navigate = useNavigate();
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();
  const [rows, setRows] = useState<WheelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Wheel leady | Web na prenájom";
  }, [navigate]);

  useEffect(() => {
    if (authChecking) return;

    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }

    if (isAdmin) {
      void load();
      return;
    }

    setLoading(false);
  }, [authChecking, isAdmin, navigate, userId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wheel_spins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else setRows((data || []) as WheelRow[]);
    setLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.email, r.name, r.coupon_code, r.prize_label].some((v) => (v || "").toLowerCase().includes(q));
  }), [rows, search]);

  const stats = useMemo(() => {
    const wins = rows.filter((r) => r.prize_value > 0);
    return {
      total: rows.length,
      wins: wins.length,
      redeemed: wins.filter((r) => r.redeemed).length,
      reminded: wins.filter((r) => r.reminder_sent_at).length,
    };
  }, [rows]);

  const sendReminder = async (r: WheelRow) => {
    if (!r.coupon_code) {
      toast({ title: "Bez kupónu", description: "Tento záznam nemá zľavový kód.", variant: "destructive" });
      return;
    }
    setSendingId(r.id);
    try {
      const { error } = await supabase.functions.invoke("send-wheel-reminder", {
        body: {
          name: r.name || undefined,
          email: r.email,
          prizeLabel: r.prize_label,
          prizeValue: r.prize_value,
          couponCode: r.coupon_code,
        },
      });
      if (error) throw error;
      await supabase.from("wheel_spins").update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      toast({ title: "Reminder odoslaný", description: `Email poslaný na ${r.email}` });
      load();
    } catch (e: any) {
      toast({ title: "Chyba odosielania", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const toggleRedeemed = async (r: WheelRow) => {
    const next = !r.redeemed;
    const { error } = await supabase.from("wheel_spins").update({
      redeemed: next, redeemed_at: next ? new Date().toISOString() : null,
    }).eq("id", r.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: next ? "Označené ako uplatnené" : "Vrátené do zoznamu" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Vymazať tento záznam?")) return;
    const { error } = await supabase.from("wheel_spins").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Vymazané" }); setRows((p) => p.filter((x) => x.id !== id)); }
  };

  const updateField = async (id: string, field: "name" | "phone" | "notes", value: string) => {
    const update: any = { [field]: value || null };
    const { error } = await supabase.from("wheel_spins").update(update).eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };

  if (authChecking) return <main className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></main>;

  if (!isAdmin) return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Nemáte prístup</h1>
        <p className="text-muted-foreground">Účet <strong>{userEmail}</strong> nemá pridelenú admin rolu.</p>
        <Button onClick={handleSignOut} variant="outline"><LogOut className="w-4 h-4 mr-2" /> Odhlásiť</Button>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/admin")} variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <Sparkles className="w-5 h-5 text-amber-500" /> Wheel leady – točenie kolesom
              </h1>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button onClick={handleSignOut} variant="outline" size="sm"><LogOut className="w-4 h-4 mr-2" /> Odhlásiť</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Spolu točení", value: stats.total },
            { label: "Výhry", value: stats.wins },
            { label: "Uplatnené", value: stats.redeemed },
            { label: "Reminder odoslaný", value: stats.reminded },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </section>

        <section className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hľadať podľa emailu, mena, kódu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">Žiadne záznamy</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Meno / firma</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefón</TableHead>
                    <TableHead>Výhra</TableHead>
                    <TableHead>Kód</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={r.name || ""}
                          placeholder="Doplniť..."
                          className="h-8 text-sm border-transparent hover:border-border focus:border-border"
                          onBlur={(e) => e.target.value !== (r.name || "") && updateField(r.id, "name", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a>
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={r.phone || ""}
                          placeholder="—"
                          className="h-8 text-sm w-36 border-transparent hover:border-border focus:border-border"
                          onBlur={(e) => e.target.value !== (r.phone || "") && updateField(r.id, "phone", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        {r.prize_value > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 border">{r.prize_value}%</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">{r.prize_label}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.coupon_code ? (
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{r.coupon_code}</code>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {r.redeemed && <Badge className="bg-green-500/15 text-green-600 border-green-500/30 border text-xs">Uplatnené</Badge>}
                          {r.reminder_sent_at && <Badge variant="outline" className="text-[10px]">Reminder ✓</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.coupon_code && (
                          <Button size="sm" variant="outline" disabled={sendingId === r.id} onClick={() => sendReminder(r)} className="mr-1">
                            {sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                            Reminder
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleRedeemed(r)} title="Označiť uplatnené">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default AdminWheelLeads;
