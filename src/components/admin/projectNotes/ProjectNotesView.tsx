import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
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
import {
  type ProjectNote,
  type ProjectNotesViewMode,
  PROJECT_STATUSES,
  PROJECT_TYPE_OPTIONS,
  emptyProjectNote,
  MASKED_PASSWORD,
  hasCredentials,
} from "./shared";
import { ClientPicker } from "@/components/admin/lookup/ClientPicker";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";

const VIEW_CONFIG: Record<
  ProjectNotesViewMode,
  { title: string; subtitle: string; docTitle: string; addLabel: string }
> = {
  projects: {
    title: "Projekty",
    subtitle: "WordPress, Shoptet a zákazkové weby — stav, klient, poznámky",
    docTitle: "Projekty | CRM",
    addLabel: "Nový projekt",
  },
  passwords: {
    title: "Heslá",
    subtitle: "Prístupy k projektom — heslá sú skryté, odhalenie je zámerné",
    docTitle: "Heslá projektov | CRM",
    addLabel: "Nový prístup",
  },
};

export function ProjectNotesView({ mode }: { mode: ProjectNotesViewMode }) {
  const cfg = VIEW_CONFIG[mode];
  const [items, setItems] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectNote> | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [editPasswordVisible, setEditPasswordVisible] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    document.title = cfg.docTitle;
    void load();
  }, [cfg.docTitle]);

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
      toast({ title: "Zadaj názov", variant: "destructive" });
      return;
    }
    const linked = await resolveCustomerLinkFields({
      customer_id: editing.customer_id,
      customer_email: editing.customer_email,
      client_name: editing.client_name,
    });
    const payload = {
      title: editing.title!.trim(),
      client_name: linked.client_name || null,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
      lead_id: editing.lead_id || null,
      project_type: editing.project_type || null,
      url: editing.url || null,
      username: editing.username || null,
      password: editing.password || null,
      notes: editing.notes || null,
      status: editing.status || "in_progress",
    };
    const prior = editing.id ? items.find((i) => i.id === editing.id) : null;
    const statusChanged = prior != null && prior.status !== payload.status;

    const { data: saved, error } = editing.id
      ? await supabase.from("project_notes").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("project_notes").insert(payload).select("id").maybeSingle();
    if (error) {
      toast({ title: "Uloženie zlyhalo", description: error.message, variant: "destructive" });
      return;
    }
    const recordId = saved?.id ?? editing.id;
    if (recordId) {
      if (!editing.id) {
        logEntityCommunicationEventSafe({
          kind: "project_event",
          title: payload.title,
          body_preview: PROJECT_STATUSES.find((s) => s.value === payload.status)?.label ?? payload.status,
          customer_id: linked.customer_id,
          customer_email: linked.customer_email,
          source_table: "project_notes",
          source_id: recordId,
          idempotency_key: `project_notes:${recordId}:created`,
          metadata: { entity_status: payload.status, action: "created" },
        });
      } else if (statusChanged) {
        logEntityCommunicationEventSafe({
          kind: "project_event",
          title: `Stav: ${payload.title}`,
          body_preview: PROJECT_STATUSES.find((s) => s.value === payload.status)?.label ?? payload.status,
          customer_id: linked.customer_id,
          customer_email: linked.customer_email,
          source_table: "project_notes",
          source_id: recordId,
          idempotency_key: `project_notes:${recordId}:status:${payload.status}`,
          metadata: { entity_status: payload.status, action: "status_change" },
        });
      }
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

  const baseFiltered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const filtered =
    mode === "passwords" ? baseFiltered.filter((i) => hasCredentials(i)) : baseFiltered;

  return (
    <AdminShell
      title={cfg.title}
      subtitle={cfg.subtitle}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditPasswordVisible(false);
            setEditing({ ...emptyProjectNote });
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> {cfg.addLabel}
        </Button>
      }
    >
      <div className="space-y-4">
        {mode === "projects" && (
          <p className="text-xs text-muted-foreground">
            Prístupy a heslá spravuj v sekcii{" "}
            <Link to="/admin/passwords" className="text-primary hover:underline">
              Heslá
            </Link>
            .
          </p>
        )}
        {mode === "passwords" && (
          <p className="text-xs text-muted-foreground">
            Záznamy pochádzajú z rovnakej databázy ako{" "}
            <Link to="/admin/projects" className="text-primary hover:underline">
              Projekty
            </Link>
            .
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            Všetko ({mode === "passwords" ? items.filter(hasCredentials).length : items.length})
          </Button>
          {PROJECT_STATUSES.map((s) => {
            const pool = mode === "passwords" ? items.filter(hasCredentials) : items;
            const count = pool.filter((i) => i.status === s.value).length;
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
            {mode === "passwords" ? "Žiadne uložené prístupy." : "Žiadne projekty. Pridaj prvý."}
          </div>
        ) : mode === "passwords" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const status = PROJECT_STATUSES.find((s) => s.value === item.status);
              const shown = reveal[item.id];
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
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
                  <CredentialsBlock
                    item={item}
                    shown={shown}
                    onToggle={() => setReveal((r) => ({ ...r, [item.id]: !r[item.id] }))}
                    onCopy={copy}
                  />
                  <CardActions item={item} onEdit={openEdit} onRemove={remove} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const status = PROJECT_STATUSES.find((s) => s.value === item.status);
              const creds = hasCredentials(item);
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/admin/projects/${item.id}`} className="font-semibold truncate block hover:text-primary hover:underline">
                        {item.title}
                      </Link>
                      {item.client_name && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground truncate">{item.client_name}</p>
                          {customerHrefByClientName(item.client_name, clientEmailMap) && (
                            <Link
                              to={customerHrefByClientName(item.client_name, clientEmailMap)!}
                              className="text-[10px] text-primary hover:underline"
                            >
                              Klient 360°
                            </Link>
                          )}
                        </div>
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

                  {item.notes && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        Poznámka
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{item.notes}</p>
                    </div>
                  )}

                  {creds && (
                    <Link
                      to="/admin/passwords"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <KeyRound className="w-3 h-3" /> Prístupy v sekcii Heslá
                    </Link>
                  )}

                  <CardActions item={item} onEdit={openEdit} onRemove={remove} updatedAt={item.updated_at} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        setEditing={setEditing}
        editPasswordVisible={editPasswordVisible}
        setEditPasswordVisible={setEditPasswordVisible}
        onSave={save}
        mode={mode}
      />
    </AdminShell>
  );
}

function CardActions({
  item,
  onEdit,
  onRemove,
  updatedAt,
}: {
  item: ProjectNote;
  onEdit: (item: Partial<ProjectNote>) => void;
  onRemove: (id: string) => void;
  updatedAt?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/50">
      <span className="text-[10px] text-muted-foreground">
        {updatedAt ? new Date(updatedAt).toLocaleDateString("sk-SK") : null}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
          <Link to={`/admin/projects/${item.id}`}>Detail</Link>
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(item)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CredentialsBlock({
  item,
  shown,
  onToggle,
  onCopy,
}: {
  item: ProjectNote;
  shown: boolean;
  onToggle: () => void;
  onCopy: (val: string | null, label: string) => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
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
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopy(item.username, "Login")}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}
      {item.password && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground text-xs w-16 shrink-0">Heslo</span>
          <span className="font-mono truncate flex-1">{shown ? item.password : MASKED_PASSWORD}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onToggle}>
            {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopy(item.password, "Heslo")}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  editPasswordVisible,
  setEditPasswordVisible,
  onSave,
  mode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Partial<ProjectNote> | null;
  setEditing: (v: Partial<ProjectNote> | null) => void;
  editPasswordVisible: boolean;
  setEditPasswordVisible: (v: boolean) => void;
  onSave: () => void;
  mode: ProjectNotesViewMode;
}) {
  if (!editing) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setEditPasswordVisible(false);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing.id ? "Upraviť záznam" : mode === "passwords" ? "Nový prístup" : "Nový projekt"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Názov projektu *</Label>
              <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Klient</Label>
                <ClientPicker
                  clientName={editing.client_name || ""}
                  customerEmail={editing.customer_email}
                  customerId={editing.customer_id}
                  leadId={editing.lead_id}
                  onChange={({ client_name, customer_email, lead_id, customer_id }) =>
                    setEditing({ ...editing, client_name, customer_email, lead_id, customer_id })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Typ projektu</Label>
                <Select
                  value={editing.project_type || "wordpress"}
                  onValueChange={(v) => setEditing({ ...editing, project_type: v as ProjectNote["project_type"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Stav</Label>
                <Select value={editing.status || "in_progress"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
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
              Prístupy {mode === "projects" && "(voliteľné)"}
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
                <Input value={editing.username || ""} onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
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
                    onClick={() => setEditPasswordVisible(!editPasswordVisible)}
                  >
                    {editPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {mode === "projects" && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Poznámka projektu
              </Label>
              <NoteTextarea
                rows={5}
                placeholder="Postup, kontext, interné poznámky…"
                value={editing.notes || ""}
                onChange={(v) => setEditing({ ...editing, notes: v })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušiť</Button>
          <Button onClick={onSave}>Uložiť</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
