import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCustomerHref, adminCustomerHrefById } from "@/lib/adminNav";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";
import { fetchLookup } from "@/lib/crmLookup/fetchLookup";
import { Search } from "lucide-react";
import { useEffect } from "react";

export default function AdminClients() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; label: string; sublabel?: string; email?: string | null }>>([]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void fetchLookup("customer", query, 8).then((rows) =>
        setSuggestions(rows.map((r) => ({ id: r.id, label: r.label, sublabel: r.sublabel, email: r.email }))),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

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
    }
  };

  return (
    <AdminShell
      title="Klienti"
      subtitle="Kanónickí zákazníci a legacy vyhľadávanie podľa e-mailu"
    >
      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-search">E-mail, meno alebo customer ID</Label>
          <div className="flex gap-2">
            <Input
              id="client-search"
              placeholder="klient@firma.sk alebo UUID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openCustomer()}
            />
            <Button onClick={openCustomer} disabled={!query.trim()}>
              <Search className="w-4 h-4 mr-2" /> Otvoriť
            </Button>
          </div>
        </div>
        {suggestions.length > 0 && (
          <ul className="rounded-lg border border-border divide-y text-sm">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted"
                  onClick={() => navigate(adminCustomerHrefById(s.id))}
                >
                  <div className="font-medium">{s.label}</div>
                  {s.sublabel && <div className="text-xs text-muted-foreground">{s.sublabel}</div>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Nové záznamy ukladajú <strong>customer_id</strong> pri výbere z lookup. Legacy route{" "}
          <code className="text-[10px]">/admin/customer/:email</code> zostáva počas rolloutu.
        </p>
      </div>
    </AdminShell>
  );
}
