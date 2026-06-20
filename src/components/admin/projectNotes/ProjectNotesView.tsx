import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchesSearchQuery } from "@/lib/searchMatch";
import { NoteTextarea } from "@/components/admin/NoteTextarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AdminDialog } from "@/components/admin/AdminDialog";
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
  KeyRound,
  FileText,
  Search,
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
import { linkLeadAfterDelivery } from "@/lib/crmLookup/leadCustomerLifecycle";
import { logEntityCommunicationEventSafe } from "@/lib/communication/events";
import {
  assertDeliveryHasCanonicalCustomer,
  parseInsertRowId,
} from "@/lib/crmLookup/entitySaveHelpers";
import { resolveFormCustomerLink } from "@/lib/crmLookup/resolveFormCustomerLink";
import { AccessCredentialsEditor } from "@/components/admin/projectNotes/AccessCredentialsEditor";
import {
  type AccessCredential,
  createEmptyCredential,
  credentialsForSave,
  resolveProjectCredentials,
} from "@/lib/projectCredentials";

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
  const [editCredentials, setEditCredentials] = useState<AccessCredential[]>([]);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);

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
      // TODO post-release: pridať assigned_to stĺpec + filterProjectsForUser
      // Option B (Batch 4c): administrator vidí všetky projekty/heslá — project_notes nemá ownership stĺpce.
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

    let linked;
    try {
      linked = await resolveFormCustomerLink({
        customer_id: editing.customer_id,
        customer_email: editing.customer_email,
        client_name: editing.client_name,
        lead_id: editing.lead_id,
        createIfMissing: true,
      });
    } catch (e) {
      toast({
        title: "Klient — neplatný e-mail",
        description:
          e instanceof Error
            ? e.message
            : "Vyberte klienta z vyhľadávania alebo zadajte platný e-mail.",
        variant: "destructive",
      });
      return;
    }

    const customerGuard = assertDeliveryHasCanonicalCustomer(linked);
    if (!customerGuard.ok) {
      setCustomerFieldError(customerGuard.message);
      toast({ title: customerGuard.message, variant: "destructive" });
      return;
    }
    setCustomerFieldError(null);

    const credFields = credentialsForSave(editing, editCredentials);
    const payload = {
      title: editing.title!.trim(),
      client_name: linked.client_name || null,
      customer_email: linked.customer_email,
      customer_id: linked.customer_id,
      lead_id: linked.lead_id || editing.lead_id || null,
      project_type: editing.project_type || null,
      url: credFields.url,
      username: credFields.username,
      password: credFields.password,
      access_credentials: credFields.access_credentials,
      notes: editing.notes || null,
      status: editing.status || "in_progress",
    };
    const prior = editing.id ? items.find((i) => i.id === editing.id) : null;
    const statusChanged = prior != null && prior.status !== payload.status;

    const { data: saved, error } = editing.id
      ? await supabase.from("project_notes").update(payload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("project_notes").insert(payload).select("id").maybeSingle();

    const insertResult = parseInsertRowId(saved, error, "Projekt");
    if (!insertResult.ok) {
      toast({
        title: editing.id ? "Aktualizácia zlyhala" : "Projekt sa nepodarilo vytvoriť",
        description: insertResult.error,
        variant: "destructive",
      });
      return;
    }

    const recordId = insertResult.id;
    if (linked.lead_id && linked.customer_id) {
      await linkLeadAfterDelivery(linked.lead_id, linked.customer_id);
    }

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

    toast({ title: editing.id ? "Aktualizované" : "Projekt vytvorený" });
    setCustomerFieldError(null);
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
    setEditCredentials(resolveProjectCredentials(item as ProjectNote));
    setCustomerFieldError(null);
    setEditing(item);
    setOpen(true);
  };

  const baseFiltered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const statusFiltered =
    mode === "passwords" ? baseFiltered.filter((i) => hasCredentials(i)) : baseFiltered;
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return statusFiltered;
    return statusFiltered.filter((item) => {
      const statusLabel = PROJECT_STATUSES.find((s) => s.value === item.status)?.label;
      const typeLabel = PROJECT_TYPE_OPTIONS.find((t) => t.value === item.project_type)?.label;
      return matchesSearchQuery(
        searchQuery,
        item.title,
        item.client_name,
        item.customer_email,
        item.url,
        item.notes,
        statusLabel,
        typeLabel,
      );
    });
  }, [statusFiltered, searchQuery]);

  return (
    <AdminShell
      title={cfg.title}
      subtitle={cfg.subtitle}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditCredentials([createEmptyCredential("Hlavný prístup")]);
            setCustomerFieldError(null);
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
            . Riadkový prehľad ako v Projektoch — odhalenie hesla je zámerné.
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

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={
              mode === "passwords"
                ? "Hľadať projekt, klienta, login, URL…"
                : "Hľadať projekt, klienta, stav, URL…"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
            {mode === "passwords"
              ? "Žiadne uložené prístupy."
              : items.length === 0
                ? "Žiadne projekty. Pridaj prvý."
                : "Žiadna zhoda pre zadané filtre alebo vyhľadávanie."}
          </div>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Klient</TableHead>
                  {mode === "passwords" ? (
                    <>
                      <TableHead>Login</TableHead>
                      <TableHead>Heslo</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Typ</TableHead>
                      <TableHead>URL</TableHead>
                    </>
                  )}
                  <TableHead>Stav</TableHead>
                  <TableHead>Aktualizované</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const status = PROJECT_STATUSES.find((s) => s.value === item.status);
                  const typeLabel =
                    PROJECT_TYPE_OPTIONS.find((t) => t.value === item.project_type)?.label ?? "—";
                  const creds = resolveProjectCredentials(item);
                  const primary = creds[0];
                  const shown = reveal[item.id];
                  const customerHref = item.client_name
                    ? customerHrefByClientName(item.client_name, clientEmailMap)
                    : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">
                        <Link
                          to={`/admin/projects/${item.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                        {mode === "projects" && hasCredentials(item) && (
                          <Link
                            to="/admin/passwords"
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary mt-0.5"
                          >
                            <KeyRound className="w-2.5 h-2.5" /> Prístupy
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.client_name ? (
                          <>
                            <span className="truncate block max-w-[180px]">{item.client_name}</span>
                            {customerHref && (
                              <Link
                                to={customerHref}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Klient 360°
                              </Link>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {mode === "passwords" ? (
                        <>
                          <TableCell className="text-xs font-mono max-w-[140px] truncate">
                            {primary?.login || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {primary?.password ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono truncate max-w-[120px]">
                                  {shown ? primary.password : MASKED_PASSWORD}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => setReveal((r) => ({ ...r, [item.id]: !r[item.id] }))}
                                >
                                  {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => copy(primary.password ?? null, "Heslo")}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs">{typeLabel}</TableCell>
                          <TableCell className="text-xs max-w-[160px]">
                            {item.url ? (
                              <a
                                href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate block"
                              >
                                {item.url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={status?.color}>
                          {status?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.updated_at).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <Link to={`/admin/projects/${item.id}`}>Detail</Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => void remove(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <EditDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        setEditing={setEditing}
        editCredentials={editCredentials}
        setEditCredentials={setEditCredentials}
        onSave={save}
        mode={mode}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={() => setCustomerFieldError(null)}
      />
    </AdminShell>
  );
}

function EditDialog({
  open,
  onOpenChange,
  editing,
  setEditing,
  editCredentials,
  setEditCredentials,
  onSave,
  mode,
  customerFieldError,
  onClearCustomerFieldError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Partial<ProjectNote> | null;
  setEditing: (v: Partial<ProjectNote> | null) => void;
  editCredentials: AccessCredential[];
  setEditCredentials: (v: AccessCredential[]) => void;
  onSave: () => void;
  mode: ProjectNotesViewMode;
  customerFieldError: string | null;
  onClearCustomerFieldError: () => void;
}) {
  if (!editing) return null;
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing.id ? "Upraviť záznam" : mode === "passwords" ? "Nový prístup" : "Nový projekt"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Zrušiť
          </Button>
          <Button onClick={onSave} className="w-full sm:w-auto">
            Uložiť
          </Button>
        </>
      }
    >
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Názov projektu *</Label>
              <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Klient</Label>
                <ClientPicker
                  clientName={editing.client_name || ""}
                  customerEmail={editing.customer_email}
                  customerId={editing.customer_id}
                  leadId={editing.lead_id}
                  onChange={({ client_name, customer_email, lead_id, customer_id }) => {
                    onClearCustomerFieldError();
                    setEditing({ ...editing, client_name, customer_email, lead_id, customer_id });
                  }}
                />
                {customerFieldError && (
                  <p className="text-destructive text-xs mt-1">{customerFieldError}</p>
                )}
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
            <AccessCredentialsEditor credentials={editCredentials} onChange={setEditCredentials} />
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
    </AdminDialog>
  );
}
