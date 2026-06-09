import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  KeyRound,
  FileText,
} from "lucide-react";
import { buildClientNameEmailMap, customerHrefByClientName } from "@/lib/adminNav";

interface ProjectNote {
  id: string;
  title: string;
  client_name: string | null;
  url: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  status: string;
  updated_at: string;
}

const STATUSES = [
  { value: "in_progress", label: "Rozpracované", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { value: "waiting", label: "Čaká na klienta", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  { value: "done", label: "Hotové", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { value: "archived", label: "Archív", color: "bg-muted text-muted-foreground border-border" },
];

const empty: Partial<ProjectNote> = {
  title: "",
  client_name: "",
  url: "",
  username: "",
  password: "",
  notes: "",
  status: "in_progress",
};

const MASKED_PASSWORD = "••••••••";

const hasCredentials = (item: Pick<ProjectNote, "url" | "username" | "password">) =>
  !!(item.url?.trim() || item.username?.trim() || item.password?.trim());

const AdminProjectNotes = () => {
  const [items, setItems] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectNote> | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [editPasswordVisible, setEditPasswordVisible] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    document.title = "Poznámky & heslá projektov | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [notesRes, leadsRes] = await Promise.all([
      supabase.from("project_notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("leads").select("name,email"),
    ]);
    if (notesRes.error) {
      toast({ title: "Chyba", description: notesRes.error.message, variant: "destructive" });
    } else {
      setItems((notesRes.data || []) as ProjectNote[]);
    }
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
    }
    setLoading(false);
  };

  const save = async () => {
    if (!editing?.title?.trim()) {
      toast({ title: "Zadaj názov projektu", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title!.trim(),
      client_name: editing.client_name || null,
      url: editing.url || null,
      username: editing.username || null,
      password: editing.password || null,
      notes: editing.notes || null,
      status: editing.status || "in_progress",
    };
    const { error } = editing.id
      ? await supabase.from("project_notes").update(payload).eq("id", editing.id)
      : await supabase.from("project_notes").insert(payload);
    if (error) {
      toast({ title: "Uloženie zlyhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Aktualizované" : "Pridané" });
    setOpen(false);
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať tento záznam?")) return;
    const { error } = await supabase.from("project_notes").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Zmazané" });
      void load();
    }
  };

  const copy = (val: string | null, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: `${label} skopírované` });
  };

  const openEdit = (item: Partial<ProjectNote>) => {
    setEditPasswordVisible(false);
    setEditing(item);
    setOpen(true);
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <AdminShell
      title="Poznámky & heslá"
      subtitle="Projektové poznámky a prístupy — heslá sú v zozname skryté, odhalenie je zámerné"
      backTo={{ label: "CRM", href: "/admin" }}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditPasswordVisible(false);
            setEditing({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Pridať
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            Všetko ({items.length})
          </Button>
          {STATUSES.map((s) => {
            const count = items.filter((i) => i.status === s.value).length;
            return (
              <Button
                key={s.value}
                size="sm"
                variant={filter === s.value ? "default" : "outline"}
                onClick={() => setFilter(s.value)}
              >
                {s.label} ({count})
              </Button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
            Žiadne záznamy. Pridaj prvý projekt.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const status = STATUSES.find((s) => s.value === item.status);
              const shown = reveal[item.id];
              const creds = hasCredentials(item);
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      {item.client_name && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                          {customerHrefByClientName(item.client_name, clientEmailMap) && (
                            <Link
                              to={customerHrefByClientName(item.client_name, clientEmailMap)!}
                              className="text-[10px] text-primary hover:underline"
                              title="Zhoda podľa mena klienta v pipeline"
                            >
                              Zákazník 360°
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={status?.color}>
                      {status?.label}
                    </Badge>
                  </div>

                  {creds && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                        Prístupy
                      </div>

                      {item.url && (
                        <div className="flex items-center gap-2 text-sm">
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate"
                          >
                            {item.url}
                          </a>
                        </div>
                      )}

                      {item.username && (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground text-xs w-16 shrink-0">Login</span>
                          <span className="font-mono truncate flex-1">{item.username}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(item.username, "Login")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {item.password && (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground text-xs w-16 shrink-0">Heslo</span>
                          <span className="font-mono truncate flex-1">
                            {shown ? item.password : MASKED_PASSWORD}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title={shown ? "Skryť heslo" : "Zobraziť heslo"}
                            onClick={() => setReveal((r) => ({ ...r, [item.id]: !r[item.id] }))}
                          >
                            {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Skopírovať heslo"
                            onClick={() => copy(item.password, "Heslo")}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {item.password && !shown && (
                        <p className="text-[10px] text-muted-foreground">Klikni na oko pre zobrazenie hesla.</p>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        Poznámka projektu
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{item.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString("sk-SK")}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditPasswordVisible(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Upraviť záznam" : "Nový záznam"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projekt</p>
                <div className="space-y-1.5">
                  <Label>Názov projektu *</Label>
                  <Input
                    value={editing.title || ""}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Klient</Label>
                    <Input
                      value={editing.client_name || ""}
                      onChange={(e) => setEditing({ ...editing, client_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stav</Label>
                    <Select
                      value={editing.status || "in_progress"}
                      onValueChange={(v) => setEditing({ ...editing, status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Prístupy
                </p>
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input
                    placeholder="https://..."
                    value={editing.url || ""}
                    onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Login / email</Label>
                    <Input
                      value={editing.username || ""}
                      onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Heslo</Label>
                    <div className="flex gap-1">
                      <Input
                        type={editPasswordVisible ? "text" : "password"}
                        value={editing.password || ""}
                        onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                        className="font-mono"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        title={editPasswordVisible ? "Skryť heslo" : "Zobraziť heslo"}
                        onClick={() => setEditPasswordVisible((v) => !v)}
                      >
                        {editPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Pri úprave je heslo skryté — odhal ho ikonou oka.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  Poznámka projektu
                </Label>
                <Textarea
                  rows={5}
                  placeholder="Postup, kontext, interné poznámky k projektu…"
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušiť</Button>
            <Button onClick={save}>Uložiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminProjectNotes;
