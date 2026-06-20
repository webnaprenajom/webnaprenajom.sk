import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveCustomerIdentity } from "@/lib/customerWorkbench/resolveCustomerIdentity";

const findCustomerById = vi.fn();
const findCustomerByEmail = vi.fn();

vi.mock("@/lib/crmLookup/customers", () => ({
  findCustomerById: (...args: unknown[]) => findCustomerById(...args),
  findCustomerByEmail: (...args: unknown[]) => findCustomerByEmail(...args),
}));

describe("resolveCustomerIdentity", () => {
  beforeEach(() => {
    findCustomerById.mockReset();
    findCustomerByEmail.mockReset();
  });

  it("email route uses findCustomerByEmail with normalized lookup path", async () => {
    findCustomerByEmail.mockResolvedValue({
      id: "cust-1",
      email: "client@example.com",
      display_name: "Client",
    });

    const result = await resolveCustomerIdentity({
      routeMode: "email",
      routeValue: "  Client@Example.COM ",
    });

    expect(findCustomerByEmail).toHaveBeenCalledWith("  Client@Example.COM ");
    expect(result.customerId).toBe("cust-1");
    expect(result.resolvedEmail).toBe("client@example.com");
    expect(result.leadFilter).toBe("customer_id.eq.cust-1,email.ilike.client@example.com");
  });

  it("email route without canonical customer still filters leads by normalized email", async () => {
    findCustomerByEmail.mockResolvedValue(null);

    const result = await resolveCustomerIdentity({
      routeMode: "email",
      routeValue: "Lead@Example.COM",
    });

    expect(result.customerId).toBeNull();
    expect(result.resolvedEmail).toBe("lead@example.com");
    expect(result.leadFilter).toBe("email.ilike.lead@example.com");
  });

  it("id route does not keep raw route uuid when customer row is missing", async () => {
    findCustomerById.mockResolvedValue(null);

    const result = await resolveCustomerIdentity({
      routeMode: "id",
      routeValue: "00000000-0000-4000-8000-000000000099",
    });

    expect(result.customerId).toBeNull();
    expect(result.canonicalCustomer).toBeNull();
    expect(result.leadFilter).toBeNull();
  });
});
