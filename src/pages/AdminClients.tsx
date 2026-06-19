import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminCustomerHref, adminCustomerHrefById, adminLeadHref } from "@/lib/adminNav";
import {
  ensureCustomerByEmail,
  findCustomerByEmail,
  isCanonicalCustomerId,
} from "@/lib/crmLookup/customers";
import { validateFormEmail } from "@/lib/crmLookup/entitySaveHelpers";
import { fetchLookupWithMeta } from "@/lib/crmLookup/fetchLookup";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import {
  loadUnifiedClientDirectory,
  type UnifiedClientEntry,
} from "@/lib/crmLookup/loadUnifiedClientDirectory";
import { unifiedClientSectionSummary } from "@/lib/crmLookup/unifiedClientDedupe";
import { toast } from "@/hooks/use-toast";
import type { LookupResult } from "@/lib/crmLookup/types";
import {
  AlertCircle,
  FolderKanban,
  Globe,
  Loader2,
  Plus,
  Search,
  Server,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";
import { useAccessContext } from "@/hooks/useAccessContext";
import { isAdministrator, isOwner } from "@/lib/rbac/permissions";
import { filterLeadsForUser, filterRentalsForUser } from "@/lib/rbac/scopeHelpers";
import { supabase } from "@/integrations/supabase/client";

type ClientResult = LookupResult & { kind: "customer" | "lead" };

type CreateClientForm = { displayName: string; email: string };

const EMPTY_CREATE_FORM: CreateClientForm = { displayName: "", email: "" };

const CREATE_RLS_MSG =
  "Nového klienta tu nie je možné vytvoriť — chýba oprávnenie na samostatný zápis. Skúste ho založiť cez lead (stav Dohodnutý/Zrealizovaný) alebo pri uložení prenájmu či projektu s rovnakým e-mailom.";

function isLikelyRlsError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("permission denied") || m.includes("row-level security") || m.includes("42501");
}

export default function AdminClients() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClientResult[]>([]);
  const [directory, setDirectory] = useState<UnifiedClientEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClientForm>(EMPTY_CREATE_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createFieldError, setCreateFieldError] = useState<string | null>(null);
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({
    onSuccess: () => void loadDirectory(),
  });
  const accessCtx = useAccessContext();

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    const { entries, error: dirError } = await loadUnifiedClientDirectory(24);
    if (dirError) {
      setError(dirError);
    } else {
      setError(null);
    }
    if (entries.length === 0 && dirError) {
      setDirectory([]);
      setDirectoryLoading(false);
      return;
    }

    if (isOwner(accessCtx.role)) {
      setDirectory(entries);
      setDirectoryLoading(false);
      return;
    }

    if (isAdministrator(accessCtx.role)) {
      const [leadsRes, rentalsRes] = await Promise.all([
        supabase.from("leads").select("id, assigned_to, customer_id"),
        supabase.from("rental_websites").select("id, customer_id, implementers"),
      ]);
      const scopingErrors: string[] = [];
      if (leadsRes.error) scopingErrors.push(`leads: ${leadsRes.error.message}`);
      if (rentalsRes.error) scopingErrors.push(`prenájmy: ${rentalsRes.error.message}`);
      if (scopingErrors.length > 0) {
        toast({
          title: "Chyba načítania rozsahu klientov",
          description: scopingErrors.join("; "),
          variant: "destructive",
        });
      }
      const myLeadCustomerIds = filterLeadsForUser(leadsRes.data || [], accessCtx)
        .map((l) => l.customer_id)
        .filter(Boolean) as string[];
      const myRentalCustomerIds = filterRentalsForUser(rentalsRes.data || [], accessCtx)
        .map((r) => r.customer_id)
        .filter(Boolean) as string[];
      const myCustomerIds = new Set([...myLeadCustomerIds, ...myRentalCustomerIds]);
      setDirectory(entries.filter((e) => e.customerId && myCustomerIds.has(e.customerId)));
      setDirectoryLoading(false);
      return;
    }

    setDirectory([]);
    setDirectoryLoading(false);
  }, [accessCtx]);

  useEffect(() => {
    if (accessCtx.authChecking) return;
    void loadDirectory();
  }, [loadDirectory, accessCtx.authChecking, accessCtx.role]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSuggestions([]);
      setError(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const { rows, error: fetchError } = await fetchLookupWithMeta("client", trimmed, 12);
      if (fetchError) {
        setError(fetchError);
        setSuggestions([]);
      } else {
        setSuggestions(rows.filter((r): r is ClientResult => r.kind === "customer" || r.kind === "lead"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vyhľadávanie zlyhalo");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const openCustomer = () => {
    const key = query.trim();
    if (!key) return;
    if (isCanonicalCustomerId(key)) {
      navigate(adminCustomerHrefById(key));
      return;
    }
    if (key.includes("@")) {
      const href = adminCustomerHref(key.toLowerCase());
      if (href) navigate(href);
      return;
    }
    if (suggestions.length === 1) {
      openResult(suggestions[0]);
    }
  };

  const openResult = (row: ClientResult) => {
    if (row.kind === "customer") {
      navigate(adminCustomerHrefById(row.id));
      return;
    }
    navigate(adminLeadHref(row.id));
  };

  const openDirectoryEntry = (entry: UnifiedClientEntry) => {
    if (entry.customerId) {
      navigate(adminCustomerHrefById(entry.customerId));
      return;
    }
    if (entry.email) {
      const href = adminCustomerHref(entry.email);
      if (href) navigate(href);
    }
  };

  const closeCreateDialog = useCallback(() => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFieldError(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFieldError(null);
    setCreateOpen(true);
  }, []);

  const discardCreateChanges = useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFieldError(null);
  }, []);

  const finishCreateSuccess = useCallback(
    (customerId: string, toastInfo?: { title: string; description?: string }) => {
      toast(toastInfo ?? { title: "Klient vytvorený" });
      closeCreateDialog();
      void loadDirectory();
      navigate(adminCustomerHrefById(customerId));
    },
    [closeCreateDialog, loadDirectory, navigate],
  );

  const saveCreate = useCallback(async (): Promise<boolean> => {
    setCreateFieldError(null);
    const displayName = createForm.displayName.trim();
    const emailRaw = createForm.email.trim();

    if (!displayName) {
      setCreateFieldError("Meno klienta je povinné.");
      return false;
    }
    if (!emailRaw) {
      setCreateFieldError("E-mail klienta je povinný.");
      return false;
    }
    const emailCheck = validateFormEmail(emailRaw);
    if (!emailCheck.valid || !emailCheck.normalized) {
      setCreateFieldError(emailCheck.error ?? "E-mail klienta je povinný a musí byť platný.");
      return false;
    }

    setCreateSaving(true);
    try {
      const existing = await findCustomerByEmail(emailCheck.normalized);
      if (existing) {
        finishCreateSuccess(existing.id, {
          title: "Klient už existuje",
          description: "Otvárame existujúci záznam s týmto e-mailom.",
        });
        return true;
      }

      const result = await ensureCustomerByEmail(emailCheck.normalized, displayName, {
        allowReviewCreate: true,
      });

      if (result.blocked) {
        setCreateFieldError(
          result.warning ??
            "Klienta nie je možné vytvoriť — nejednoznačná identita. Vyhľadajte existujúceho klienta vyššie.",
        );
        return false;
      }

      if (result.row?.id) {
        finishCreateSuccess(
          result.row.id,
          result.warning
            ? { title: "Klient pripravený", description: result.warning }
            : undefined,
        );
        return true;
      }

      const failMsg = result.warning ?? "Klienta sa nepodarilo vytvoriť.";
      setCreateFieldError(isLikelyRlsError(failMsg) ? CREATE_RLS_MSG : failMsg);
      return false;
    } finally {
      setCreateSaving(false);
    }
  }, [createForm.displayName, createForm.email, finishCreateSuccess]);

  const createCloseGuard = useAdminCloseGuard({
    isOpen: createOpen,
    current: createForm,
    onSave: saveCreate,
    onDiscard: discardCreateChanges,
    saving: createSaving,
  });

  return (
    <AdminShell
      title="Klienti"
      subtitle="Jednotný zoznam klientov naprieč prenájmami, projektmi a hostingom"
      actions={
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Nový klient
        </Button>
      }
    >
      <div className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="client-search">Meno, e-mail, customer ID alebo lead</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="client-search"
              className="flex-1"
              placeholder="napr. ACME s.r.o., klient@firma.sk"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openCustomer()}
            />
            <Button onClick={openCustomer} disabled={!query.trim() || loading} className="min-h-10">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="ml-2">Otvoriť</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Deduplikácia: <strong>customer_id</strong> → e-mail → meno. Rovnaký klient sa nezobrazí dvakrát.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Chyba</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Hľadám…
          </div>
        )}

        {!loading && searched && !error && suggestions.length === 0 && query.trim() && (
          <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-lg">
            Nenašli sa žiadni klienti ani leady pre „{query.trim()}“.
          </p>
        )}

        {!loading && suggestions.length > 0 && (
          <ul className="rounded-lg border border-border divide-y text-sm">
            {suggestions.map((s) => (
              <li key={`${s.kind}-${s.id}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-3 hover:bg-muted flex items-start gap-2 min-h-[44px]"
                  onClick={() => openResult(s)}
                >
                  {s.kind === "customer" ? (
                    <UserRound className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Users className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{s.label}</span>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {s.kind === "customer" ? "Klient" : "Lead"}
                      </Badge>
                      {s.meta?.promoted_from_lead && (
                        <Badge variant="secondary" className="text-[9px] h-4">Z leadu</Badge>
                      )}
                    </div>
                    {s.sublabel && (
                      <div className="text-xs text-muted-foreground truncate">{s.sublabel}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!query.trim() && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Prehľad klientov</h2>
              {directoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {!directoryLoading && directory.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Zatiaľ žiadni klienti v databáze.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {directory.map((entry) => (
                <div
                  key={entry.customerId || entry.email || entry.nameKey || entry.displayName}
                  className="relative rounded-xl border p-3 hover:bg-muted/50 transition-colors min-h-[44px]"
                >
                  <button
                    type="button"
                    className="w-full text-left pr-8"
                    onClick={() => openDirectoryEntry(entry)}
                    disabled={!entry.customerId && !entry.email}
                  >
                    <div className="flex items-start gap-2">
                      <UserRound className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{entry.displayName}</p>
                        {entry.email && (
                          <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {entry.projectCount > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                              <FolderKanban className="w-2.5 h-2.5" /> {entry.projectCount}
                            </Badge>
                          )}
                          {entry.hostingCount > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                              <Server className="w-2.5 h-2.5" /> {entry.hostingCount}
                            </Badge>
                          )}
                          {entry.rentalCount > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                              <Globe className="w-2.5 h-2.5" /> {entry.rentalCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {unifiedClientSectionSummary(entry)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {entry.customerId && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute top-2 right-2 h-8 w-8"
                      title="Zmazať klienta"
                      onClick={() =>
                        void requestDelete({
                          entityType: "customer",
                          entityId: entry.customerId!,
                          entityLabel: entry.displayName,
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <DestructiveModal {...modalProps} />
      {createCloseGuard.closeGuardDialog}
      <AdminDialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) createCloseGuard.handleOpenChange(o, closeCreateDialog);
        }}
        size="sm"
        title="Nový klient"
        description="E-mail je povinný — slúži ako jednoznačný identifikátor klienta v CRM."
        footer={
          <>
            <Button variant="outline" onClick={() => createCloseGuard.requestClose(closeCreateDialog)}>
              Zrušiť
            </Button>
            <Button onClick={() => void saveCreate()} disabled={createSaving}>
              {createSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vytvoriť
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-client-name">Meno klienta</Label>
            <Input
              id="create-client-name"
              value={createForm.displayName}
              onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="napr. ACME s.r.o."
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-client-email">E-mail klienta</Label>
            <Input
              id="create-client-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="klient@firma.sk"
              autoComplete="email"
            />
          </div>
          {createFieldError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{createFieldError}</p>
            </div>
          )}
        </div>
      </AdminDialog>
    </AdminShell>
  );
}
