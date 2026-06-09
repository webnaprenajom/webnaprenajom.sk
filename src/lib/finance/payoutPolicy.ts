/** Payout timing policy — documented metadata, not enforcement engine. */

export interface PayoutPolicySetting {
  id: string;
  policy_key: string;
  policy_value: string;
  label: string;
  description: string | null;
  is_active_default: boolean;
}

export const PAYOUT_POLICY_DESCRIPTION =
  "Politiky výplaty sú dokumentované referencie. CRM ich zatiaľ nevynucuje automaticky — payout vyžaduje explicitné human confirm.";

export function getActivePayoutPolicy(policies: PayoutPolicySetting[]): PayoutPolicySetting | undefined {
  return policies.find((p) => p.is_active_default);
}
