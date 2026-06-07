import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  ArrowLeft,
  ShieldAlert,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { useAdminAccess } from "@/hooks/useAdminAccess";

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

const AdminProjectNotes = () => {
  const navigate = useNavigate();
  const { authChecking, isAdmin, userEmail, userId } = useAdminAccess();
  const [items, setItems] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectNote> | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    document.title = "Poznámky & heslá projektov | CRM";
  }, []);

  useEffect(() => {
    if (authChecking) return;
    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }
    if (isAdmin) void load();
    else setLoading(false);
  }, [authChecking, isAdmin, userId, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else setItems((data || []) as ProjectNote[]);
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
          <p className="text-muted-foreground">{userEmail}</p>
          <Button onClick={() => supabase.auth.signOut().then(() => navigate("/auth"))} variant="outline">
            <LogOut className="w-4 h-4 mr-2" /> Odhlásiť
          </Button>
        </div>
      </main>
    );
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Späť na CRM
            </Button>
            <div>
              <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 min-w-0">
                <KeyRound className="w-5 h-5 text-primary" />
                <span className="text-primary">Poznámky</span> & heslá
              </h1>
              <p className="text-xs text-muted-foreground">Rozpracované projekty</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              size="sm"
              onClick={() => {
                setEditing({ ...empty });
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Pridať
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
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
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      {item.client_name && (
                        <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={status?.color}>
                      {status?.label}
                    </Badge>
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

                  {(item.username || item.password) && (
                    <div className="rounded-lg bg-muted/40 border border-border/50 p-2 space-y-1.5">
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
                            {shown ? item.password : "•".repeat(Math.min(item.password.length, 12))}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setReveal((r) => ({ ...r, [item.id]: !r[item.id] }))}
                          >
                            {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(item.password, "Heslo")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{item.notes}</p>
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
                        onClick={() => {
                          setEditing(item);
                          setOpen(true);
                        }}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Upraviť záznam" : "Nový záznam"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
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
                  <Input
                    type="text"
                    value={editing.password || ""}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Poznámky</Label>
                <Textarea
                  rows={5}
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
    </main>
  );
};

export default AdminProjectNotes;
