import { describe, expect, it } from "vitest";
import {
  missingCommissionPaidPayoutFields,
  requiresCommissionPaidPayoutDetails,
  validateCommissionPaidPayoutDetails,
} from "@/lib/commissionPayoutValidation";

describe("commissionPayoutValidation", () => {
  it("scopes paid payout details to project/hosting/marketing", () => {
    expect(requiresCommissionPaidPayoutDetails("project")).toBe(true);
    expect(requiresCommissionPaidPayoutDetails("hosting")).toBe(true);
    expect(requiresCommissionPaidPayoutDetails("marketing")).toBe(true);
    expect(requiresCommissionPaidPayoutDetails("rental")).toBe(false);
    expect(requiresCommissionPaidPayoutDetails(null)).toBe(false);
  });

  it("allows unpaid without payout fields", () => {
    expect(
      validateCommissionPaidPayoutDetails({
        payment_status: "unpaid",
        source_type: "project",
        payment_form: null,
        note: null,
      }).valid,
    ).toBe(true);
  });

  it("blocks paid without payment_form and note", () => {
    const result = validateCommissionPaidPayoutDetails({
      payment_status: "paid",
      source_type: "hosting",
      payment_form: "",
      note: "  ",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missing).toEqual(["payment_form", "note"]);
    }
  });

  it("passes when paid has both fields", () => {
    expect(
      validateCommissionPaidPayoutDetails({
        payment_status: "paid",
        source_type: "marketing",
        payment_form: "iban",
        note: "Vyplatené 6/2026",
      }).valid,
    ).toBe(true);
  });

  it("reports single missing field", () => {
    expect(
      missingCommissionPaidPayoutFields({
        payment_status: "paid",
        source_type: "project",
        payment_form: "cash",
        note: "",
      }),
    ).toEqual(["note"]);
  });
});
