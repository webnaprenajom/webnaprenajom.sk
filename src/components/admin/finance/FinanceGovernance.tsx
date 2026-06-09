import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Tabs defaultValue="review">
      <TabsList>
        <TabsTrigger value="review">
          Review queue
          {pendingReviewCount > 0 && <span className="ml-1 text-amber-500">({pendingReviewCount})</span>}
        </TabsTrigger>
        <TabsTrigger value="rules">Commission rules</TabsTrigger>
        <TabsTrigger value="hosting">Hosting</TabsTrigger>
        <TabsTrigger value="policy">Payout policy</TabsTrigger>
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

      <TabsContent value="rules" className="mt-4">
        <FinanceCommissionRulesPanel rules={rules} overrides={overrides} onSaved={onSaved} />
      </TabsContent>

      <TabsContent value="hosting" className="mt-4">
        <FinanceHostingPanel records={hostingRecords} ctx={financeCtx} onSaved={onSaved} />
      </TabsContent>

      <TabsContent value="policy" className="mt-4">
        <FinancePolicyPanel policies={policies} />
      </TabsContent>
    </Tabs>
  );
}
