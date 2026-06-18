import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { CRM_ASSIGNEES } from "@/lib/assignees";
import { countBySourceKind } from "@/lib/finance/commissionConsistency";

type ProfileRow = { user_id: string; implementer_name: string; active: boolean };
type RoleRow = { user_id: string; role: string };

type SoftDiag = {
  id: string;
  label: string;
  count: number;
  hint: string;
};

/** Admin-only soft diagnostics for team setup and commission quality (RC6.5). */
export function TeamSetupDiagnostics() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SoftDiag[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, profilesRes, commRes, hostingRes, projectRes] = await Promise.all([
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("team_profiles").select("user_id,implementer_name,active"),
      supabase.from("commissions").select("source_type,source_id"),
      supabase.from("hosting_records").select("monthly_price,operating_cost"),
      supabase.from("project_notes").select("operating_cost"),
    ]);

    const roles = (rolesRes.data || []) as RoleRow[];
    const profiles = (profilesRes.data || []) as ProfileRow[];
    const userRoles = roles.filter((r) => r.role === "user" || r.role === "administrator");
    const missingProfile = userRoles.filter(
      (r) => !profiles.some((p) => p.user_id === r.user_id && p.active),
    ).length;

    const commCounts = countBySourceKind(commRes.data || []);
    const legacyComm = commCounts.legacy;

    const hostingCostNoPrice = (hostingRes.data || []).filter(
      (h: { monthly_price: number | null; operating_cost: number | null }) =>
        Number(h.operating_cost || 0) > 0 && !Number(h.monthly_price || 0),
    ).length;

    const projectCostOnly = (projectRes.data || []).filter(
      (p: { operating_cost: number | null }) => Number(p.operating_cost || 0) > 0,
    ).length;

    const unmappedImplementers = CRM_ASSIGNEES.filter(
      (name) => !profiles.some((p) => p.implementer_name === name && p.active),
    ).length;

    const diags: SoftDiag[] = [];
    if (missingProfile > 0) {
      diags.push({
        id: "missing-profile",
        label: "Používatelia bez team profile",
        count: missingProfile,
        hint: "Role user bez implementer_name neuvidia provízie.",
      });
    }
    if (unmappedImplementers > 0) {
      diags.push({
        id: "unmapped-implementers",
        label: "Implementeri bez priradeného účtu",
        count: unmappedImplementers,
        hint: "Meno v províziách bez mapovania na auth usera.",
      });
    }
    if (legacyComm > 0) {
      diags.push({
        id: "legacy-comm",
        label: "Legacy provízie bez zdroja",
        count: legacyComm,
        hint: "Bez source_type/source_id — môžu spôsobiť nejasnosti vo financiách.",
      });
    }
    if (hostingCostNoPrice > 0) {
      diags.push({
        id: "hosting-cost-no-revenue",
        label: "Hosting s nákladmi bez ceny",
        count: hostingCostNoPrice,
        hint: "Zisk sa nepočíta — doplnite mesačnú cenu.",
      });
    }
    if (projectCostOnly > 0) {
      diags.push({
        id: "project-cost",
        label: "Projekty s nákladmi",
        count: projectCostOnly,
        hint: "Skontrolujte payment_records pre tržbový základ.",
      });
    }

    setItems(diags);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Žiadne upozornenia — team setup a provízne väzby vyzerajú v poriadku.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li key={d.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {d.label}
            </span>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {d.count}
            </Badge>
          </div>
          <p className="text-muted-foreground">{d.hint}</p>
        </li>
      ))}
    </ul>
  );
}
