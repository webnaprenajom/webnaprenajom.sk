import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { CRM_ASSIGNEES } from "@/lib/assignees";
import { loadRecentAuditLog, type AuditLogEntry } from "@/lib/audit/auditLog";

type RoleRow = { user_id: string; role: string };
type ProfileRow = { user_id: string; implementer_name: string; active: boolean };

type ReviewRow = {
  userId: string;
  role: string;
  implementerName: string | null;
  profileOk: boolean;
  lastAudit: AuditLogEntry | null;
  riskFlags: string[];
};

/** Admin-only periodic access review (RC6.6). */
export function AccessReviewPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, profilesRes, audit] = await Promise.all([
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("team_profiles").select("user_id,implementer_name,active"),
      loadRecentAuditLog(100),
    ]);
    const roles = (rolesRes.data || []) as RoleRow[];
    const profiles = (profilesRes.data || []) as ProfileRow[];

    const auditByTarget = new Map<string, AuditLogEntry>();
    for (const a of audit) {
      if (a.target_type === "user" && a.target_id && !auditByTarget.has(a.target_id)) {
        auditByTarget.set(a.target_id, a);
      }
    }

    const mapped: ReviewRow[] = roles.map((r) => {
      const prof = profiles.find((p) => p.user_id === r.user_id && p.active);
      const riskFlags: string[] = [];
      if (r.role === "user" && !prof) {
        riskFlags.push("Chýba team profile — provízie neuvidí");
      }
      if (r.role === "admin" && !prof) {
        riskFlags.push("Admin bez team profile (OK pre plný prístup)");
      }
      if (r.role === "user" && prof && !CRM_ASSIGNEES.includes(prof.implementer_name as any)) {
        riskFlags.push("Implementer mimo štandardného zoznamu");
      }
      return {
        userId: r.user_id,
        role: r.role,
        implementerName: prof?.implementer_name ?? null,
        profileOk: r.role === "admin" || !!prof,
        lastAudit: auditByTarget.get(r.user_id) ?? null,
        riskFlags,
      };
    });

    setRows(mapped.sort((a, b) => b.riskFlags.length - a.riskFlags.length));
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

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Žiadni používatelia s rolou.</p>;
  }

  const risky = rows.filter((r) => r.riskFlags.some((f) => f.includes("Chýba team profile")));

  return (
    <div className="space-y-3">
      {risky.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {risky.length} účet(ov) vyžaduje kontrolu mapovania
        </p>
      )}
      <ul className="divide-y rounded-xl border text-xs">
        {rows.map((r) => (
          <li key={r.userId} className="p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <code className="text-[10px] truncate max-w-[200px]">{r.userId}</code>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline">{r.role}</Badge>
                {r.implementerName && (
                  <Badge variant="secondary" className="text-[10px]">
                    {r.implementerName}
                  </Badge>
                )}
                {r.profileOk ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
              </div>
            </div>
            {r.riskFlags.length > 0 && (
              <ul className="text-[10px] text-amber-800 dark:text-amber-200 space-y-0.5">
                {r.riskFlags.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            )}
            {r.lastAudit && (
              <p className="text-[10px] text-muted-foreground">
                Posledná zmena: {r.lastAudit.summary} ·{" "}
                {new Date(r.lastAudit.created_at).toLocaleString("sk-SK")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
