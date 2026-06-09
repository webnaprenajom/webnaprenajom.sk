import { Badge } from "@/components/ui/badge";
import {
  getActivePayoutPolicy,
  PAYOUT_POLICY_DESCRIPTION,
  type PayoutPolicySetting,
} from "@/lib/finance/payoutPolicy";

interface Props {
  policies: PayoutPolicySetting[];
}

export function FinancePolicyPanel({ policies }: Props) {
  const active = getActivePayoutPolicy(policies);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground border rounded p-3 bg-muted/20">{PAYOUT_POLICY_DESCRIPTION}</p>
      {active && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs text-muted-foreground">Aktuálny dokumentovaný default</div>
          <div className="font-semibold text-sm mt-1">{active.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{active.description}</div>
        </div>
      )}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 text-xs font-medium">Politika</th>
              <th className="text-left p-3 text-xs font-medium">Popis</th>
              <th className="text-left p-3 text-xs font-medium">Stav</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="p-3">{p.label}</td>
                <td className="p-3 text-xs text-muted-foreground">{p.description ?? "—"}</td>
                <td className="p-3">
                  {p.is_active_default ? (
                    <Badge className="text-[10px]">active default</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{p.policy_value}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
