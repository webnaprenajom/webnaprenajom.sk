import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Eye, Link as LinkIcon, Trash2 } from "lucide-react";
import { AdminListSearchInput } from "@/components/admin/AdminListSearchInput";
import { matchesSearchQuery } from "@/lib/searchMatch";

interface Signature {
  id: string;
  client_name: string;
  company: string | null;
  ico: string | null;
  dic: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  plan: string;
  package_name: string | null;
  price: number;
  contract_months: number;
  signature_name: string;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  notes: string | null;
  signed_at: string;
  created_at: string;
}

const ORDER_URL = `${window.location.origin}/objednavka`;

export default function AdminSignatures() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Signature[]>([]);
  const [viewing, setViewing] = useState<Signature | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_signatures")
      .select("*")
      .order("signed_at", { ascending: false });
    if (error) {
      toast({ title: "Načítanie zlyhalo", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as Signature[]);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("order_signatures").update({ status }).eq("id", id);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("order_signatures").delete().eq("id", deleting);
    if (error) toast({ title: "Vymazanie zlyhalo", description: error.message, variant: "destructive" });
    else {
      setRows((p) => p.filter((r) => r.id !== deleting));
      toast({ title: "Vymazané" });
    }
    setDeleting(null);
  };

  const copyLink = (extra = "") => {
    navigator.clipboard.writeText(ORDER_URL + extra);
    toast({ title: "Skopírované", description: "Link na objednávku" });
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    return rows.filter((r) =>
      matchesSearchQuery(
        searchQuery,
        r.client_name,
        r.company,
        r.email,
        r.phone,
        r.plan,
        r.package_name,
        r.signature_name,
        r.notes,
        r.ico,
      ),
    );
  }, [rows, searchQuery]);

  return (
    <AdminShell
      title="Podpisy objednávok"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <Button size="sm" variant="outline" onClick={() => copyLink()}>
          <LinkIcon className="w-4 h-4 mr-2" /> Skopírovať link
        </Button>
      }
    >
      <div className="space-y-4">
        <Card className="p-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Verejný link na objednávku:</span>
          <code className="px-2 py-1 rounded bg-muted text-xs break-all">{ORDER_URL}</code>
          <Button size="sm" variant="ghost" onClick={() => copyLink()}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <p className="text-xs text-muted-foreground w-full">
            Tento link nie je v menu webu. Pošlite ho klientovi e-mailom alebo cez WhatsApp. Môžete pridať parametre, napr. <code>?package=biznis&amp;plan=rental&amp;name=Ján%20Novák&amp;email=jan@firma.sk</code>.
          </p>
        </Card>

        <AdminListSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Hľadať klienta, firmu, e-mail, balík…"
          disabled={loading}
        />

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Zatiaľ žiadne podpisy.</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Žiadna zhoda pre vyhľadávanie.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Klient</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Balík</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead>Viazanosť</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">{new Date(r.signed_at).toLocaleString("sk-SK")}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{r.client_name}</div>
                        {r.company && <div className="text-muted-foreground">{r.company}</div>}
                      </TableCell>
                      <TableCell>
                        <div>{r.email}</div>
                        {r.phone && <div className="text-muted-foreground">{r.phone}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.package_name}</Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{r.plan === "rental" ? "Prenájom" : "Jednorazovo"}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{r.price} €</TableCell>
                      <TableCell>{r.contract_months > 0 ? `${r.contract_months} mes.` : "—"}</TableCell>
                      <TableCell className="font-mono text-[10px]">{r.ip_address || "—"}</TableCell>
                      <TableCell>
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="signed">Podpísané</SelectItem>
                            <SelectItem value="in_progress">Realizuje sa</SelectItem>
                            <SelectItem value="done">Hotové</SelectItem>
                            <SelectItem value="canceled">Zrušené</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setViewing(r)}><Eye className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detail podpisu</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Klient:</span> <strong>{viewing.client_name}</strong></div>
                <div><span className="text-muted-foreground">Email:</span> {viewing.email}</div>
                <div><span className="text-muted-foreground">Telefón:</span> {viewing.phone || "—"}</div>
                <div><span className="text-muted-foreground">Firma:</span> {viewing.company || "—"}</div>
                <div><span className="text-muted-foreground">IČO:</span> {viewing.ico || "—"}</div>
                <div><span className="text-muted-foreground">DIČ:</span> {viewing.dic || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Adresa:</span> {viewing.address || "—"}</div>
                <div><span className="text-muted-foreground">Balík:</span> {viewing.package_name}</div>
                <div><span className="text-muted-foreground">Plán:</span> {viewing.plan === "rental" ? "Prenájom" : "Jednorazovo"}</div>
                <div><span className="text-muted-foreground">Cena:</span> <strong>{viewing.price} €</strong></div>
                <div><span className="text-muted-foreground">Viazanosť:</span> {viewing.contract_months} mes.</div>
              </div>
              <hr />
              <div className="p-3 rounded bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Elektronický podpis:</div>
                <div className="text-xl italic" style={{ fontFamily: "'Caveat', cursive" }}>{viewing.signature_name}</div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  Podpísané: {new Date(viewing.signed_at).toLocaleString("sk-SK")}<br />
                  IP: {viewing.ip_address || "—"}<br />
                  User-Agent: <span className="break-all">{viewing.user_agent || "—"}</span>
                </div>
              </div>
              {viewing.notes && (
                <div><span className="text-muted-foreground text-xs">Poznámka:</span><Textarea value={viewing.notes} readOnly rows={2} /></div>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={() => setViewing(null)}>Zavrieť</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vymazať podpis?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Táto akcia sa nedá vrátiť späť.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Zrušiť</Button>
            <Button variant="destructive" onClick={remove}>Vymazať</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
