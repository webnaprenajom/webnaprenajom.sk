import { describe, expect, it } from "vitest";
import { allowClientNameHubFallback } from "@/lib/customerWorkbench/hubFallbackPolicy";

describe("allowClientNameHubFallback", () => {
  it("blocks client_name tier when customer_id is known", () => {
    expect(allowClientNameHubFallback("cust-1", "")).toBe(false);
    expect(allowClientNameHubFallback("cust-1", "a@b.sk")).toBe(false);
  });

  it("blocks client_name tier when resolved email is known", () => {
    expect(allowClientNameHubFallback(null, "a@b.sk")).toBe(false);
  });

  it("allows client_name tier only without canonical identity", () => {
    expect(allowClientNameHubFallback(null, "")).toBe(true);
    expect(allowClientNameHubFallback(null, "   ")).toBe(true);
  });
});
