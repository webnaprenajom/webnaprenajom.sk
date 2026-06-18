import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateLeadCustomerBeforeSave,
  prepareLeadCustomerForSave,
  LEAD_CUSTOMER_REQUIRED_MSG,
} from "@/lib/crmLookup/leadCustomerLifecycle";
import {
  shouldRequireLeadCustomer,
  shouldPromoteLeadToCustomer,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";
import { DELIVERY_CUSTOMER_AMBIGUOUS_MSG } from "@/lib/crmLookup/entitySaveHelpers";

const CANONICAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const CREATED_ID = "660e8400-e29b-41d4-a716-446655440001";

vi.mock("@/lib/crmLookup/customers", () => ({
  isCanonicalCustomerId: (value: string | null | undefined) => {
    if (!value?.trim()) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  },
  findCustomerByEmail: vi.fn(),
  ensureCustomerByEmail: vi.fn(),
}));

import { findCustomerByEmail, ensureCustomerByEmail } from "@/lib/crmLookup/customers";

describe("shouldRequireLeadCustomer", () => {
  it("includes scheduled, won, and order", () => {
    expect(shouldRequireLeadCustomer("scheduled")).toBe(true);
    expect(shouldRequireLeadCustomer("won")).toBe(true);
    expect(shouldRequireLeadCustomer("order")).toBe(true);
    expect(shouldRequireLeadCustomer("new")).toBe(false);
    expect(shouldPromoteLeadToCustomer("scheduled")).toBe(true);
  });
});

describe("validateLeadCustomerBeforeSave", () => {
  it("allows non-required status without customer", () => {
    expect(validateLeadCustomerBeforeSave({ status: "new" })).toEqual({ ok: true });
    expect(validateLeadCustomerBeforeSave({ status: "contacted" })).toEqual({ ok: true });
  });

  it("allows required status with canonical customer_id", () => {
    expect(
      validateLeadCustomerBeforeSave({
        status: "won",
        customer_id: CANONICAL_ID,
      }),
    ).toEqual({ ok: true });
  });

  it("allows required status with valid email", () => {
    expect(
      validateLeadCustomerBeforeSave({
        status: "order",
        email: "client@firma.sk",
      }),
    ).toEqual({ ok: true });
  });

  it("blocks required status without id or email", () => {
    expect(
      validateLeadCustomerBeforeSave({
        status: "scheduled",
        customer_id: null,
        email: null,
      }),
    ).toEqual({
      ok: false,
      message: LEAD_CUSTOMER_REQUIRED_MSG,
      field: "customer",
    });
  });

  it("blocks required status with invalid email", () => {
    expect(
      validateLeadCustomerBeforeSave({
        status: "won",
        email: "not-an-email",
      }),
    ).toEqual({
      ok: false,
      message: LEAD_CUSTOMER_REQUIRED_MSG,
      field: "customer",
    });
  });

  it("treats scheduled as required (in scope after Batch 2a)", () => {
    expect(
      validateLeadCustomerBeforeSave({
        status: "scheduled",
        customer_id: null,
        email: "",
      }),
    ).toEqual({
      ok: false,
      message: LEAD_CUSTOMER_REQUIRED_MSG,
      field: "customer",
    });
  });
});

describe("prepareLeadCustomerForSave", () => {
  beforeEach(() => {
    vi.mocked(findCustomerByEmail).mockReset();
    vi.mocked(ensureCustomerByEmail).mockReset();
  });

  it("returns canonical customer_id without calling ensureCustomerByEmail", async () => {
    const result = await prepareLeadCustomerForSave({
      status: "won",
      email: "client@firma.sk",
      name: "Acme",
      customer_id: CANONICAL_ID,
    });
    expect(result).toEqual({ ok: true, customer_id: CANONICAL_ID, created: false });
    expect(findCustomerByEmail).not.toHaveBeenCalled();
    expect(ensureCustomerByEmail).not.toHaveBeenCalled();
  });

  it("creates customer for required status with valid email", async () => {
    vi.mocked(findCustomerByEmail).mockResolvedValue(null);
    vi.mocked(ensureCustomerByEmail).mockResolvedValue({
      row: {
        id: CREATED_ID,
        email: "client@firma.sk",
        display_name: "Acme",
      },
      blocked: false,
    });

    const result = await prepareLeadCustomerForSave({
      leadId: "lead-1",
      status: "won",
      email: "client@firma.sk",
      name: "Acme",
    });

    expect(result).toEqual({ ok: true, customer_id: CREATED_ID, created: true });
    expect(findCustomerByEmail).toHaveBeenCalledWith("client@firma.sk");
    expect(ensureCustomerByEmail).toHaveBeenCalled();
  });

  it("returns existing customer without create when email matches", async () => {
    vi.mocked(findCustomerByEmail).mockResolvedValue({
      id: CANONICAL_ID,
      email: "client@firma.sk",
      display_name: "Acme",
    });

    const result = await prepareLeadCustomerForSave({
      status: "scheduled",
      email: "client@firma.sk",
      name: "Acme",
    });

    expect(result).toEqual({ ok: true, customer_id: CANONICAL_ID, created: false });
    expect(ensureCustomerByEmail).not.toHaveBeenCalled();
  });

  it("fails when customer create is blocked", async () => {
    vi.mocked(findCustomerByEmail).mockResolvedValue(null);
    vi.mocked(ensureCustomerByEmail).mockResolvedValue({
      row: null,
      blocked: true,
      warning: "ambiguous",
    });

    const result = await prepareLeadCustomerForSave({
      status: "order",
      email: "client@firma.sk",
      name: "Acme",
    });

    expect(result).toEqual({
      ok: false,
      message: DELIVERY_CUSTOMER_AMBIGUOUS_MSG,
      field: "customer",
    });
  });

  it("allows non-required status without customer resolution", async () => {
    const result = await prepareLeadCustomerForSave({
      status: "new",
      email: "",
      name: "Lead",
    });
    expect(result).toEqual({ ok: true, customer_id: null, created: false });
    expect(findCustomerByEmail).not.toHaveBeenCalled();
    expect(ensureCustomerByEmail).not.toHaveBeenCalled();
  });
});
