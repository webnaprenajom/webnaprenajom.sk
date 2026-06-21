import { describe, expect, it } from "vitest";
import {
  formatAmount1Decimal,
  formatCurrency1Decimal,
  roundTo1Decimal,
} from "@/lib/money/formatMoney";

describe("roundTo1Decimal", () => {
  it("rounds boundary values correctly", () => {
    expect(roundTo1Decimal(41.64)).toBe(41.6);
    expect(roundTo1Decimal(41.65)).toBe(41.7);
    expect(roundTo1Decimal(41.66)).toBe(41.7);
    expect(roundTo1Decimal(10.04)).toBe(10.0);
    expect(roundTo1Decimal(10.05)).toBe(10.1);
  });
});

describe("formatAmount1Decimal", () => {
  it("formats with one decimal digit", () => {
    expect(formatAmount1Decimal(41.65)).toBe("41.7");
    expect(formatAmount1Decimal(10.04)).toBe("10.0");
  });
});

describe("formatCurrency1Decimal", () => {
  it("formats euro suffix", () => {
    expect(formatCurrency1Decimal(41.65)).toBe("41.7 €");
    expect(formatCurrency1Decimal(0)).toBe("—");
  });
});
