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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { matchesSearchQuery } from "@/lib/searchMatch";
import { buildClientNameEmailMap, customerHrefByClientName } from "@/lib/adminNav";
import {
  CREDENTIAL_CATEGORIES,
  CREDENTIAL_LIST_SELECT,
  MASKED_PASSWORD,
  type CredentialFormState,
  type CustomerCredential,
  type LinkedEntityType,
  credentialDisplayLabel,
  emptyCredentialFormState,
  linkedEntityTypeLabel,
} from "@/lib/customerCredentials";
import {
  deleteCustomerCredential,
  loadCredentialEntityOptions,
  loadCredentialFormForEdit,
  saveCustomerCredentialBatch,
} from "@/lib/customerCredentialsSave";
import {
  CredentialFormDialog,
  type EntityOptions,
} from "@/components/admin/customerCredentials/CredentialFormDialog";
import { Copy, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

function entityHref(type: LinkedEntityType | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "project":
      return `/admin/projects/${id}`;
    case "hosting":
      return `/admin/hosting/${id}`;
    case "marketing":
      return `/admin/marketing/${id}`;
    case "rental":
      return `/admin/rentals`;
    default:
      return null;
  }
}

export function CustomerCredentialsView() {
  const [items, setItems] = useState<CustomerCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CredentialFormState | null>(null);
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOptions>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [clientEmailMap, setClientEmailMap] = useState<Map<string, string>>(new Map());
  const [customerFieldError, setCustomerFieldError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Heslá a prístupy | CRM";
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [credsRes, leadsRes] = await Promise.all([
      supabase.from("customer_credentials").select(CREDENTIAL_LIST_SELECT).order("updated_at", { ascending: false }),
      supabase.from("leads").select("name,email"),
    ]);
    if (credsRes.error) {
      toast({ title: "Chyba", description: credsRes.error.message, variant: "destructive" });
    } else {
      setItems((credsRes.data || []) as CustomerCredential[]);
    }
    if (!leadsRes.error && leadsRes.data) {
      setClientEmailMap(buildClientNameEmailMap(leadsRes.data));
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm(null);
    setRemovedDbIds([]);
  };

  const openCreate = () => {
    setCustomerFieldError(null);
    setEntityOptions({});
    setRemovedDbIds([]);
    setForm(emptyCredentialFormState());
    setOpen(true);
  };

  const openEdit = async (item: CustomerCredential) => {
    setCustomerFieldError(null);
    setRemovedDbIds([]);
    const loaded = await loadCredentialFormForEdit(item);
    setForm(loaded);
    setOpen(true);
    const opts = await loadCredentialEntityOptions(item.customer_id, item.customer_email, item.client_name);
    setEntityOptions(opts);
  };

  const onCustomerChange = async (fields: {
    client_name: string;
    customer_email: string | null;
    lead_id: string | null;
    customer_id: string | null;
  }) => {
    if (!form) return;
    onClearCustomerFieldError();
    setForm({
      ...form,
      client_name: fields.client_name,
      customer_email: fields.customer_email,
      lead_id: fields.lead_id,
      customer_id: fields.customer_id,
      linked_entity_type: null,
      linked_entity_id: null,
    });
    const opts = await loadCredentialEntityOptions(
      fields.customer_id,
      fields.customer_email,
      fields.client_name,
    );
    setEntityOptions(opts);
  };

  const save = async (): Promise<boolean> => {
    if (!form) return false;
    const result = await saveCustomerCredentialBatch(form, removedDbIds);
    if (!result.ok) {
      if (result.customerFieldError) setCustomerFieldError(result.customerFieldError);
      toast({
        title: result.customerFieldError ? result.customerFieldError : "Uloženie zlyhalo",
        description: result.message,
        variant: "destructive",
      });
      return false;
    }
    toast({
      title: result.savedCount > 1 ? `${result.savedCount} prístupov uložených` : "Prístup uložený",
    });
    setCustomerFieldError(null);
    setOpen(false);
    resetForm();
    void load();
    return true;
  };

  const remove = async (id: string) => {
    if (!confirm("Naozaj zmazať tento prístup?")) return;
    const error = await deleteCustomerCredential(id);
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

  const onClearCustomerFieldError = () => setCustomerFieldError(null);

  const filtered = useMemo(() => {
    let pool = items;
    if (categoryFilter !== "all") {
      pool = pool.filter((i) => i.category === categoryFilter);
    }
    if (!searchQuery.trim()) return pool;
    return pool.filter((item) =>
      matchesSearchQuery(
        searchQuery,
        credentialDisplayLabel(item),
        item.client_name,
        item.customer_email,
        item.url,
        item.login,
        item.note,
        linkedEntityTypeLabel(item.linked_entity_type),
      ),
    );
  }, [items, categoryFilter, searchQuery]);

  return (
    <AdminShell
      title="Heslá a prístupy"
      subtitle="Prihlasovacie údaje viazané na klienta — voliteľné prepojenie na projekt, hosting, marketing alebo prenájom"
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nový prístup
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          Projekty sú samostatná sekcia —{" "}
          <Link to="/admin/projects" className="text-primary hover:underline">
            Projekty
          </Link>
          . V jednom modale môžeš uložiť viac loginov naraz.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
          >
            Všetko ({items.length})
          </Button>
          {CREDENTIAL_CATEGORIES.map((c) => {
            const count = items.filter((i) => i.category === c.value).length;
            if (!count) return null;
            return (
              <Button
                key={c.value}
                size="sm"
                variant={categoryFilter === c.value ? "default" : "outline"}
                onClick={() => setCategoryFilter(c.value)}
              >
                {c.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Hľadať klienta, kategóriu, login, URL…"
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
            {items.length === 0 ? "Žiadne uložené prístupy." : "Žiadna zhoda pre filter alebo vyhľadávanie."}
          </div>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategória</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Heslo</TableHead>
                  <TableHead>Prepojenie</TableHead>
                  <TableHead>Aktualizované</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const shown = reveal[item.id];
                  const customerHref = item.client_name
                    ? customerHrefByClientName(item.client_name, clientEmailMap)
                    : item.customer_id
                      ? `/admin/customer/id/${item.customer_id}`
                      : null;
                  const linkHref = entityHref(item.linked_entity_type, item.linked_entity_id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {credentialDisplayLabel(item)}
                        </Badge>
                        {item.batch_id && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">skupina</span>
                        )}
                        {item.url && (
                          <span className="block text-[10px] text-muted-foreground truncate max-w-[160px] mt-0.5">
                            {item.url}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.client_name ? (
                          <>
                            <span className="truncate block max-w-[180px]">{item.client_name}</span>
                            {customerHref && (
                              <Link to={customerHref} className="text-[10px] text-primary hover:underline">
                                Klient 360°
                              </Link>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[140px] truncate">
                        {item.login || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.password ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono truncate max-w-[120px]">
                              {shown ? item.password : MASKED_PASSWORD}
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
                              onClick={() => copy(item.password, "Heslo")}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.linked_entity_type && item.linked_entity_id ? (
                          linkHref ? (
                            <Link to={linkHref} className="text-primary hover:underline">
                              {linkedEntityTypeLabel(item.linked_entity_type)}
                            </Link>
                          ) : (
                            linkedEntityTypeLabel(item.linked_entity_type)
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.updated_at).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => void openEdit(item)}
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

      <CredentialFormDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
        form={form}
        setForm={setForm}
        removedDbIds={removedDbIds}
        onRemoveItem={(dbId) => {
          if (dbId) setRemovedDbIds((ids) => [...ids, dbId]);
        }}
        entityOptions={entityOptions}
        onCustomerChange={onCustomerChange}
        onSave={save}
        customerFieldError={customerFieldError}
        onClearCustomerFieldError={onClearCustomerFieldError}
      />
    </AdminShell>
  );
}
