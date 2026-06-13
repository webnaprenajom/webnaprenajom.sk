import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { EMAIL_ACCOUNT_STATUS_LABELS } from "@/lib/communication/summaryModel";
import { Loader2, Mail, Plus, RefreshCw } from "lucide-react";

type EmailAccount = {
  id: string;
  email_address: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
};

export function EmailAccountSettings({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmailAccount[]>([]);
  const [newEmail, setNewEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_email_accounts")
      .select("id,email_address,provider,status,last_sync_at,last_error")
      .eq("user_id", userId)
      .order("created_at");
    if (error) {
      toast({ title: "E-mail účty", description: error.message, variant: "destructive" });
    } else {
      setRows((data || []) as EmailAccount[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAccount = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      toast({ title: "Neplatný e-mail", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("user_email_accounts").insert({
      user_id: userId,
      email_address: email,
      provider: "manual",
      status: "disconnected",
    });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "E-mail pridaný", description: "Stav: odpojené — provider integrácia pripojí sync." });
    setNewEmail("");
    void load();
  };

  const markPending = async (id: string) => {
    const { error } = await supabase
      .from("user_email_accounts")
      .update({ status: "pending", last_error: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sync pripravený", description: "Účet označený na pripojenie (provider stub)." });
    void load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Každý používateľ mapuje vlastný e-mail pre prichádzajúcu a odchádzajúcu komunikáciu.
        Správy sa párujú na klienta podľa e-mailovej identity. Provider (IMAP/OAuth) pripojíte v ďalšom kroku —
        model a UI stav sú pripravené.
      </p>
      <ul className="space-y-2">
        {rows.length === 0 && (
          <li className="text-sm text-muted-foreground italic">Žiadny pripojený e-mail.</li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border p-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium truncate">{r.email_address}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.provider} ·{" "}
                  {r.last_sync_at
                    ? `Sync ${new Date(r.last_sync_at).toLocaleString("sk-SK")}`
                    : "Ešte nesyncované"}
                </p>
                {r.last_error && <p className="text-[10px] text-destructive">{r.last_error}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  r.status === "connected" ? "default" : r.status === "error" ? "destructive" : "outline"
                }
                className="text-[10px]"
              >
                {EMAIL_ACCOUNT_STATUS_LABELS[r.status] ?? r.status}
              </Badge>
              {r.status !== "connected" && (
                <Button size="sm" variant="outline" onClick={() => void markPending(r.id)}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Pripojiť
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="vas@email.sk"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="flex-1"
        />
        <Button onClick={() => void addAccount()} className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Pridať e-mail
        </Button>
      </div>
    </div>
  );
}
