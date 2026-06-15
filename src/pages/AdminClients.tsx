import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { adminCustomerHref, adminCustomerHrefById, adminLeadHref } from "@/lib/adminNav";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";
import { fetchLookupWithMeta } from "@/lib/crmLookup/fetchLookup";
import {
  loadUnifiedClientDirectory,
  type ClientDirectoryMode,
  type UnifiedClientEntry,
} from "@/lib/crmLookup/loadUnifiedClientDirectory";
import { unifiedClientSectionSummary } from "@/lib/crmLookup/unifiedClientDedupe";
import type { LookupResult } from "@/lib/crmLookup/types";
import {
  AlertCircle,
  FolderKanban,
  Globe,
  Loader2,
  Search,
  Server,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useDestructiveAction } from "@/hooks/useDestructiveAction";

type ClientResult = LookupResult & { kind: "customer" | "lead" };

export default function AdminClients() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClientResult[]>([]);
  const [directory, setDirectory] = useState<UnifiedClientEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [directoryMode, setDirectoryMode] = useState<ClientDirectoryMode>("active");
  const { requestDelete, modalProps, DestructiveModal } = useDestructiveAction({
    onSuccess: () => void loadDirectory(directoryMode),
  });

  const loadDirectory = useCallback(async (mode: ClientDirectoryMode) => {
    setDirectoryLoading(true);
    const { entries, error: dirError } = await loadUnifiedClientDirectory(24, mode);
    if (dirError) {
      setError(dirError);
    } else {
      setDirectory(entries);
    }
    setDirectoryLoading(false);
  }, []);

  useEffect(() => {
    void loadDirectory(directoryMode);
  }, [directoryMode, loadDirectory]);

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

  return (
    <AdminShell
      title="Klienti"
      subtitle="Jednotný zoznam klientov naprieč prenájmami, projektmi a hostingom"
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">Prehľad klientov</h2>
              <div className="flex items-center gap-2">
                {directoryLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={directoryMode}
                  onValueChange={(v) => v && setDirectoryMode(v as ClientDirectoryMode)}
                  className="border rounded-lg p-0.5"
                >
                  <ToggleGroupItem value="active" className="text-xs h-7 px-2.5 data-[state=on]:bg-muted">
                    Aktívni
                  </ToggleGroupItem>
                  <ToggleGroupItem value="inactive" className="text-xs h-7 px-2.5 data-[state=on]:bg-muted">
                    Neaktívni
                  </ToggleGroupItem>
                  <ToggleGroupItem value="all" className="text-xs h-7 px-2.5 data-[state=on]:bg-muted">
                    Všetci
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
            {!directoryLoading && directory.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                {directoryMode === "active" && "Žiadni aktívni klienti."}
                {directoryMode === "inactive" && "Žiadni neaktívni klienti."}
                {directoryMode === "all" && "Zatiaľ žiadni klienti v databáze."}
              </p>
            )}
            {directory.length > 0 && (
              <div className="rounded-xl border border-border overflow-x-auto bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Meno</th>
                      <th className="text-left font-semibold px-4 py-2.5">E-mail</th>
                      <th className="text-left font-semibold px-4 py-2.5 hidden md:table-cell">Sekcie</th>
                      <th className="text-left font-semibold px-4 py-2.5 hidden lg:table-cell">Súhrn</th>
                      <th className="px-4 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {directory.map((entry) => {
                      const clickable = !!(entry.customerId || entry.email);
                      return (
                        <tr
                          key={entry.customerId || entry.email || entry.nameKey || entry.displayName}
                          className={`transition-colors ${clickable ? "cursor-pointer hover:bg-muted/40" : ""}`}
                          onClick={() => clickable && openDirectoryEntry(entry)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserRound className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-medium truncate">{entry.displayName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {entry.email ? (
                              <a
                                href={`mailto:${entry.email}`}
                                className="hover:text-primary hover:underline truncate inline-block max-w-[240px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entry.email}
                              </a>
                            ) : (
                              <span className="italic text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1.5">
                              {entry.projectCount > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                  <FolderKanban className="w-3 h-3" /> {entry.projectCount}
                                </Badge>
                              )}
                              {entry.hostingCount > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                  <Server className="w-3 h-3" /> {entry.hostingCount}
                                </Badge>
                              )}
                              {entry.rentalCount > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                  <Globe className="w-3 h-3" /> {entry.rentalCount}
                                </Badge>
                              )}
                              {entry.leadCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                                  <Users className="w-3 h-3" /> {entry.leadCount}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                            {unifiedClientSectionSummary(entry)}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {entry.customerId && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Zmazať klienta"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void requestDelete({
                                    entityType: "customer",
                                    entityId: entry.customerId!,
                                    entityLabel: entry.displayName,
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
      <DestructiveModal {...modalProps} />
    </AdminShell>
  );
}
