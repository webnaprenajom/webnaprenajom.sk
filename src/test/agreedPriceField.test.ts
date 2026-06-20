import { describe, expect, it } from "vitest";
import { formatAgreedPrice } from "@/components/admin/AgreedPriceField";

describe("formatAgreedPrice", () => {
  it("formats positive amounts", () => {
    expect(formatAgreedPrice(1500)).toBe("1500.00 €");
  });

  it("shows dash for empty or zero", () => {
    expect(formatAgreedPrice(null)).toBe("—");
    expect(formatAgreedPrice(0)).toBe("—");
  });
});
