import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { FinanceCommissionRulesPanel } from "@/components/admin/finance/FinanceCommissionRulesPanel";
import { FinanceHostingPanel } from "@/components/admin/finance/FinanceHostingPanel";
import { FinanceReviewQueuePanel } from "@/components/admin/finance/FinanceReviewQueuePanel";
import { FinancePolicyPanel } from "@/components/admin/finance/FinancePolicyPanel";
import type { CommissionRule, CommissionRuleOverride } from "@/lib/finance/commissionRules";
import type { HostingRecordRow } from "@/lib/finance/buildReviewQueue";
import type { FinanceReviewStatusRow } from "@/lib/finance/buildReviewQueue";
import type { IssueDismissalRow } from "@/lib/finance/dismissals";
import type { SettlementDraft } from "@/lib/finance/types";
import type { PayoutPolicySetting } from "@/lib/finance/payoutPolicy";
import type { FinanceRawContext } from "@/lib/finance/factDrafts";

interface Props {
  rules: CommissionRule[];
  overrides: CommissionRuleOverride[];
  hostingRecords: HostingRecordRow[];
  dismissals: IssueDismissalRow[];
  settlementDrafts: SettlementDraft[];
  reviewStatuses: FinanceReviewStatusRow[];
  policies: PayoutPolicySetting[];
  financeCtx: FinanceRawContext;
  onSaved: () => void;
  pendingReviewCount: number;
}

export function FinanceGovernance({
  rules,
  overrides,
  hostingRecords,
  dismissals,
  settlementDrafts,
  reviewStatuses,
  policies,
  financeCtx,
  onSaved,
  pendingReviewCount,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground border rounded-lg p-3 bg-muted/20">
        Hygiena a audit — nie denný owner workflow. Review queue sleduje zamietnuté výnimky a
        advisory upozornenia; payout policy je dokumentácia bez auto-enforcementu.
      </p>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">
            Review queue
            {pendingReviewCount > 0 && (
              <span className="ml-1 text-amber-500">({pendingReviewCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hosting">Hosting</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4">
          <FinanceReviewQueuePanel
            dismissals={dismissals}
            overrides={overrides}
            hostingRecords={hostingRecords}
            settlementDrafts={settlementDrafts}
            reviewStatuses={reviewStatuses}
            rules={rules}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="hosting" className="mt-4">
          <FinanceHostingPanel records={hostingRecords} ctx={financeCtx} onSaved={onSaved} />
        </TabsContent>
      </Tabs>

      <Collapsible className="rounded-xl border border-dashed border-border/80">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs text-muted-foreground hover:bg-muted/30">
          <span>Audit & dokumentácia — commission rules, payout policy (advisory)</span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4 space-y-4">
          <FinanceCommissionRulesPanel rules={rules} overrides={overrides} onSaved={onSaved} />
          <FinancePolicyPanel policies={policies} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
