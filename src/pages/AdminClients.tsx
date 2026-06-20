import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { matchesSearchQuery } from "@/lib/searchMatch";
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
  ListTodo,
  Megaphone,
  Plus,
  Search,
  Server,
  Trash2,
  UserRound,
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
  const [directory, setDirectory] = useState<UnifiedClientEntry[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const { entries, error: dirError } = await loadUnifiedClientDirectory(500);
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

  const filteredDirectory = useMemo(() => {
    if (!query.trim()) return directory;
    return directory.filter((entry) =>
      matchesSearchQuery(
        query,
        entry.displayName,
        entry.email,
        entry.customerId,
        unifiedClientSectionSummary(entry),
      ),
    );
  }, [directory, query]);

  const openCustomer = async () => {
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
    if (filteredDirectory.length === 1) {
      openDirectoryEntry(filteredDirectory[0]);
      return;
    }
    setOpenLoading(true);
    try {
      const { rows, error: fetchError } = await fetchLookupWithMeta("client", key, 12);
      if (fetchError) {
        setError(fetchError);
        return;
      }
      const hits = rows.filter((r): r is ClientResult => r.kind === "customer" || r.kind === "lead");
      if (hits.length === 1) {
        openResult(hits[0]);
      } else if (hits.length === 0) {
        toast({ title: "Nenašiel sa klient ani lead", variant: "destructive" });
      } else {
        toast({ title: "Viac zhôd", description: "Upresnite vyhľadávanie alebo kliknite na riadok v zozname." });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vyhľadávanie zlyhalo");
    } finally {
      setOpenLoading(false);
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
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="client-search">Meno, e-mail, customer ID alebo lead</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="client-search"
              className="flex-1"
              placeholder="napr. ACME s.r.o., klient@firma.sk"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void openCustomer()}
            />
            <Button onClick={() => void openCustomer()} disabled={!query.trim() || openLoading} className="min-h-10">
              {openLoading ? (
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

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Prehľad klientov
              {!directoryLoading && query.trim() && (
                <span className="font-normal text-muted-foreground ml-2">
                  ({filteredDirectory.length} / {directory.length})
                </span>
              )}
            </h2>
            {directoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {!directoryLoading && directory.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Zatiaľ žiadni klienti v databáze.</p>
          )}
          {!directoryLoading && directory.length > 0 && filteredDirectory.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center border rounded-xl">
              Žiadna zhoda pre „{query.trim()}“.
            </p>
          )}
          {!directoryLoading && filteredDirectory.length > 0 && (
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klient</TableHead>
                    <TableHead>Projekty</TableHead>
                    <TableHead>Hosting</TableHead>
                    <TableHead>Prenájmy</TableHead>
                    <TableHead>Marketing</TableHead>
                    <TableHead>Úlohy</TableHead>
                    <TableHead>Sekcie</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDirectory.map((entry) => (
                    <TableRow key={entry.customerId || entry.email || entry.nameKey || entry.displayName}>
                      <TableCell className="text-sm">
                        <button
                          type="button"
                          className="text-left hover:underline text-primary font-medium disabled:opacity-50 disabled:no-underline"
                          onClick={() => openDirectoryEntry(entry)}
                          disabled={!entry.customerId && !entry.email}
                        >
                          <span className="flex items-center gap-1.5">
                            <UserRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {entry.displayName}
                          </span>
                        </button>
                        {entry.email && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.email}</p>
                        )}
                        {entry.customerId && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                            {entry.customerId}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.projectCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <FolderKanban className="w-2.5 h-2.5" /> {entry.projectCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.hostingCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Server className="w-2.5 h-2.5" /> {entry.hostingCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.rentalCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Globe className="w-2.5 h-2.5" /> {entry.rentalCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.marketingCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Megaphone className="w-2.5 h-2.5" /> {entry.marketingCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.taskCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <ListTodo className="w-2.5 h-2.5" /> {entry.taskCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {unifiedClientSectionSummary(entry)}
                      </TableCell>
                      <TableCell>
                        {entry.customerId && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
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
