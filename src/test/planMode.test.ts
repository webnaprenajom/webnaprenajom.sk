import { describe, expect, it } from "vitest";
import {
  evaluatePlanModeScope,
  isCanonicalModulePath,
  isInlineQueryPagePath,
  normalizeRepoPath,
} from "@/lib/governance/planMode";

describe("planMode governance", () => {
  it("normalizes windows paths", () => {
    expect(normalizeRepoPath("src\\pages\\Admin.tsx")).toBe("src/pages/Admin.tsx");
  });

  it("detects canonical finance module", () => {
    expect(isCanonicalModulePath("src/lib/finance/buildFinanceSnapshot.ts")).toBe(true);
    expect(isCanonicalModulePath("src/lib/finance/labels.ts")).toBe(true);
    expect(isCanonicalModulePath("src/pages/AdminTasks.tsx")).toBe(false);
  });

  it("detects inline-query pages", () => {
    expect(isInlineQueryPagePath("src/pages/AdminFinance.tsx")).toBe(true);
    expect(isInlineQueryPagePath("src/pages/AdminToday.tsx")).toBe(false);
  });

  it("requires Plan Mode for canonical + multi-file finance touch", () => {
    const result = evaluatePlanModeScope([
      "src/lib/finance/buildFinanceSnapshot.ts",
      "src/pages/AdminFinance.tsx",
    ]);
    expect(result.requiresPlanMode).toBe(true);
    expect(result.reasons.some((r) => r.includes("canonical"))).toBe(true);
  });

  it("requires Plan Mode for 3+ files in one domain", () => {
    const result = evaluatePlanModeScope([
      "src/pages/AdminRentals.tsx",
      "src/components/admin/rentals/Foo.tsx",
      "src/components/admin/rentals/Bar.tsx",
    ]);
    expect(result.requiresPlanMode).toBe(true);
    expect(result.reasons.some((r) => r.includes("rentals"))).toBe(true);
  });
});
