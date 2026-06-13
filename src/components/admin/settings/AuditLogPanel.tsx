import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { loadRecentAuditLog, type AuditLogEntry } from "@/lib/audit/auditLog";

const ACTION_LABELS: Record<string, string> = {
  role_assigned: "Rola pridaná",
  role_removed: "Rola odstránená",
  team_profile_assigned: "Team profile priradený",
  team_profile_updated: "Team profile upravený",
  commission_status_changed: "Stav provízie",
  operating_cost_changed: "Prevádzkové náklady",
  finance_config_changed: "Finančná konfigurácia",
};

/** Admin-only audit log viewer (RC6.6). */
export function AuditLogPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await loadRecentAuditLog(40));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="w-3 h-3 mr-1" /> Obnoviť
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Zatiaľ žiadne audit záznamy.</p>
      ) : (
        <ul className="divide-y rounded-xl border max-h-80 overflow-y-auto text-xs">
          {rows.map((r) => (
            <li key={r.id} className="p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <Badge variant="outline" className="text-[10px]">
                  {ACTION_LABELS[r.action_type] ?? r.action_type}
                </Badge>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleString("sk-SK")}
                </span>
              </div>
              <p className="text-muted-foreground">{r.summary || "—"}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                {r.target_type}
                {r.target_id ? ` · ${r.target_id}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
