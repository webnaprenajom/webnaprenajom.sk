import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { adminCustomerHref, adminCustomerHrefById, adminLeadHref } from "@/lib/adminNav";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";
import { fetchLookupWithMeta } from "@/lib/crmLookup/fetchLookup";
import type { LookupResult } from "@/lib/crmLookup/types";
import { AlertCircle, Loader2, Search, UserRound, Users } from "lucide-react";

type ClientResult = LookupResult & { kind: "customer" | "lead" };

export default function AdminClients() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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

  return (
    <AdminShell
      title="Klienti"
      subtitle="Kanónickí klienti a leady — vyhľadajte podľa mena, e-mailu alebo ID"
    >
      <div className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-search">Meno, e-mail, customer ID alebo lead</Label>
          <div className="flex gap-2">
            <Input
              id="client-search"
              placeholder="napr. ACME s.r.o., klient@firma.sk"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openCustomer()}
            />
            <Button onClick={openCustomer} disabled={!query.trim() || loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Otvoriť</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            <strong>Lead</strong> = predajný kontakt. <strong>Klient</strong> = potvrdený vzťah (projekt, hosting, prenájom).
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Vyhľadávanie zlyhalo</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
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
                  className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-start gap-2"
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

        {!query.trim() && !loading && (
          <p className="text-xs text-muted-foreground">
            Začnite písať meno alebo e-mail — zobrazia sa kanónickí klienti aj neprepojené leady.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
