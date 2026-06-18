import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Search, Check, Trash2, Send, UserPlus, UserRound,
} from "lucide-react";
import {
  adminCustomerHref,
  adminLeadHref,
  buildEmailLeadIdMap,
  leadIdByEmail,
} from "@/lib/adminNav";

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
  const [rows, setRows] = useState<WheelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [emailLeadIdMap, setEmailLeadIdMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    document.title = "Wheel leady | Web na prenájom";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [wheelRes, leadsRes] = await Promise.all([
      supabase
        .from("wheel_spins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("leads").select("id,email"),
    ]);
    if (wheelRes.error) {
      toast({ title: "Chyba", description: wheelRes.error.message, variant: "destructive" });
    } else {
      setRows((wheelRes.data || []) as WheelRow[]);
    }
    if (!leadsRes.error && leadsRes.data) {
      setEmailLeadIdMap(buildEmailLeadIdMap(leadsRes.data));
    } else if (leadsRes.error) {
      toast({
        title: "Chyba načítania leadov",
        description: leadsRes.error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

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

  const convertToLead = async (r: WheelRow) => {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) {
      toast({ title: "Bez emailu", description: "Záznam nemá email.", variant: "destructive" });
      return;
    }
    setConvertingId(r.id);
    try {
      const { data: existing, error: findErr } = await supabase
        .from("leads")
        .select("id, name, email")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing?.id) {
        toast({
          title: "Lead už existuje",
          description: `${existing.name || existing.email} — otváram detail.`,
        });
        navigate(`/admin?lead=${existing.id}`);
        return;
      }

      const notePieces = [
        `Z kolesa šťastia: ${r.prize_label}${r.prize_value ? ` (${r.prize_value}%)` : ""}`,
        r.coupon_code ? `Kupón: ${r.coupon_code}` : null,
        r.notes ? `Pôvodná poznámka: ${r.notes}` : null,
      ].filter(Boolean);

      const { data: inserted, error: insErr } = await supabase
        .from("leads")
        .insert({
          name: r.name?.trim() || email,
          email,
          phone: r.phone || null,
          source: "wheel",
          type: "ai",
          status: "new",
          language: r.language || "sk",
          notes: notePieces.join("\n"),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      toast({ title: "Lead vytvorený", description: `${email} — otváram detail.` });
      navigate(`/admin?lead=${inserted.id}`);
    } catch (e: any) {
      toast({ title: "Konverzia zlyhala", description: e.message || String(e), variant: "destructive" });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <AdminShell
      title="Wheel leady – točenie kolesom"
      backTo={{ label: "CRM", href: "/admin" }}
    >
      <div className="space-y-4">
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
                  {filtered.map((r) => {
                    const customerHref = adminCustomerHref(r.email);
                    const leadId = leadIdByEmail(r.email, emailLeadIdMap);
                    return (
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
                          <div className="space-y-0.5">
                            {customerHref ? (
                              <Link to={customerHref} className="text-primary hover:underline">
                                {r.email}
                              </Link>
                            ) : (
                              <span>{r.email}</span>
                            )}
                            <a
                              href={`mailto:${r.email}`}
                              className="text-[10px] text-muted-foreground hover:underline block"
                            >
                              Poslať e-mail
                            </a>
                          </div>
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
                          {leadId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Otvoriť lead v pipeline"
                              onClick={() => navigate(adminLeadHref(leadId))}
                              className="mr-1"
                            >
                              <UserRound className="w-4 h-4" />
                            </Button>
                          )}
                          {r.coupon_code && (
                            <Button size="sm" variant="outline" disabled={sendingId === r.id} onClick={() => sendReminder(r)} className="mr-1">
                              {sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                              Reminder
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={convertingId === r.id}
                            onClick={() => convertToLead(r)}
                            className="mr-1"
                            title="Konvertovať na lead"
                          >
                            {convertingId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5 mr-1" />
                            )}
                            Konvertovať na lead
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleRedeemed(r)} title="Označiť uplatnené">
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
};

export default AdminWheelLeads;
