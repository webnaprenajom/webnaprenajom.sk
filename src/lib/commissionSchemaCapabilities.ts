/**
 * Runtime probe for commissions.amount_mode / rate_percent (migration 20260621130000).
 * ponytail: one cached select; omit columns on write when DB not migrated yet.
 */
import { supabase } from "@/integrations/supabase/client";

export type CommissionSchemaCapabilities = {
  percentMode: boolean;
};

let cache: CommissionSchemaCapabilities | null = null;

export function isCommissionPercentModeSchemaError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("amount_mode") && (m.includes("schema cache") || m.includes("pgrst204"));
}

export const COMMISSION_PERCENT_MODE_MIGRATION_HINT =
  "Databáza nemá stĺpce amount_mode/rate_percent. Spustite migráciu 20260621130000_commission_percent_paid_validation.sql (supabase db push).";

export async function loadCommissionSchemaCapabilities(): Promise<CommissionSchemaCapabilities> {
  if (cache) return cache;
  const { error } = await supabase.from("commissions").select("amount_mode,rate_percent").limit(1);
  if (!error) {
    cache = { percentMode: true };
    return cache;
  }
  if (isCommissionPercentModeSchemaError(error.message)) {
    cache = { percentMode: false };
    return cache;
  }
  cache = { percentMode: true };
  return cache;
}

export function clearCommissionSchemaCapabilitiesCache(): void {
  cache = null;
}

export function omitCommissionPercentFields<T extends Record<string, unknown>>(
  payload: T,
  caps: CommissionSchemaCapabilities,
): T {
  if (caps.percentMode) return payload;
  const next = { ...payload };
  delete next.amount_mode;
  delete next.rate_percent;
  return next as T;
}
