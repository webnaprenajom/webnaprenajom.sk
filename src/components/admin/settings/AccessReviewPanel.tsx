import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { loadRecentAuditLog, type AuditLogEntry } from "@/lib/audit/auditLog";
import { useCrmUserDirectory } from "@/hooks/useCrmUserDirectory";
import { CrmUserIdentity } from "@/components/admin/settings/CrmUserIdentity";
import { CrmUserDirectoryFilters } from "@/components/admin/settings/CrmUserDirectoryFilters";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  duplicateDisplayNameKeys,
  filterManagedUsers,
  sortUsersForAccessReview,
} from "@/lib/admin/crmUserDirectory";

/** Admin-only periodic access review (RC6.6). */
export function AccessReviewPanel() {
  const { loading, error, withRole, reload } = useCrmUserDirectory();
  const [filters, setFilters] = useState(DEFAULT_USER_DIRECTORY_FILTERS);
  const [auditByUser, setAuditByUser] = useState<Map<string, AuditLogEntry>>(new Map());
  const [auditLoading, setAuditLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const audit = await loadRecentAuditLog(100);
    const map = new Map<string, AuditLogEntry>();
    for (const a of audit) {
      if (a.target_type === "user" && a.target_id && !map.has(a.target_id)) {
        map.set(a.target_id, a);
      }
    }
    setAuditByUser(map);
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const filtered = useMemo(() => {
    return filterManagedUsers(withRole, filters).sort(sortUsersForAccessReview);
  }, [withRole, filters]);

  const duplicateNames = useMemo(() => duplicateDisplayNameKeys(withRole), [withRole]);

  const risky = withRole.filter((r) => r.missingProfile);

  if (loading || auditLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive">Chyba načítania: {error}</p>;
  }

  if (withRole.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Žiadni používatelia s rolou.</p>;
  }

  return (
    <div className="space-y-3">
      {risky.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          {risky.length} účet(ov) vyžaduje kontrolu mapovania
        </p>
      )}

      <CrmUserDirectoryFilters filters={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-4 border rounded-xl">
          Žiadni používatelia nezodpovedajú filtru. Skúste iné meno, e-mail alebo zmeňte filter role.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border text-xs">
          {filtered.map((user) => {
            const lastAudit = auditByUser.get(user.userId) ?? null;
            return (
              <li key={user.userId} className="p-3 space-y-2">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <CrmUserIdentity user={user} duplicateNames={duplicateNames} compact />
                  <div className="flex gap-1 flex-wrap items-center shrink-0">
                    <Badge variant="outline">{user.role}</Badge>
                    {user.implementerName && (
                      <Badge variant="secondary" className="text-[10px]">
                        {user.implementerName}
                      </Badge>
                    )}
                    {user.profileActive && !user.missingProfile ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" aria-label="Mapovanie OK" />
                    ) : user.missingProfile ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-label="Chýba mapovanie" />
                    ) : null}
                  </div>
                </div>
                {user.riskFlags.length > 0 && (
                  <ul className="text-[10px] text-amber-800 dark:text-amber-200 space-y-0.5 pl-0.5">
                    {user.riskFlags.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                )}
                {lastAudit && (
                  <p className="text-[10px] text-muted-foreground">
                    Posledná zmena: {lastAudit.summary} ·{" "}
                    {new Date(lastAudit.created_at).toLocaleString("sk-SK")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ButtonRefresh onRefresh={() => void Promise.all([reload(), loadAudit()])} />
    </div>
  );
}

function ButtonRefresh({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      type="button"
      className="text-[10px] text-muted-foreground hover:text-foreground underline"
      onClick={onRefresh}
    >
      Obnoviť prehľad
    </button>
  );
}
