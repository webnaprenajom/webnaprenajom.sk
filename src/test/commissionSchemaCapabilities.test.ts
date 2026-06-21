import { describe, expect, it } from "vitest";
import {
  COMMISSION_PERCENT_MODE_MIGRATION_HINT,
  isCommissionPercentModeSchemaError,
  omitCommissionPercentFields,
} from "@/lib/commissionSchemaCapabilities";

describe("commissionSchemaCapabilities", () => {
  it("detects PostgREST schema cache error for amount_mode", () => {
    expect(
      isCommissionPercentModeSchemaError(
        "Could not find the 'amount_mode' column of 'commissions' in the schema cache",
      ),
    ).toBe(true);
  });

  it("omits percent fields when percentMode is false", () => {
    const payload = {
      title: "A",
      amount: 100,
      amount_mode: "percent",
      rate_percent: 30,
    };
    expect(omitCommissionPercentFields(payload, { percentMode: false })).toEqual({
      title: "A",
      amount: 100,
    });
  });

  it("keeps percent fields when percentMode is true", () => {
    const payload = { amount_mode: "fixed", rate_percent: null };
    expect(omitCommissionPercentFields(payload, { percentMode: true })).toEqual(payload);
  });

  it("exposes migration hint copy", () => {
    expect(COMMISSION_PERCENT_MODE_MIGRATION_HINT).toContain("20260621130000");
  });
});
