import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CREDENTIAL_LIST_SELECT } from "@/lib/customerCredentials";
import { MARKETING_LIST_SELECT } from "@/components/admin/marketing/shared";

const hubLoaderPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/customerWorkbench/loadCustomerHubAggregate.ts",
);

describe("hub finance linked-source parity", () => {
  const src = readFileSync(hubLoaderPath, "utf8");

  it("queries marketing_records costs when marketingIds are present (symmetric with payments)", () => {
    expect(src).toMatch(
      /if \(marketingIds\.length\)[\s\S]*?costQueries\.push[\s\S]*?marketing_records/,
    );
    expect(src).toMatch(
      /if \(marketingIds\.length\)[\s\S]*?paymentQueries\.push[\s\S]*?marketing_records/,
    );
  });
});

describe("admin list projections", () => {
  it("credentials list select is explicit and excludes created_at noise", () => {
    const cols = CREDENTIAL_LIST_SELECT.split(",").map((c) => c.trim());
    expect(cols).toContain("login");
    expect(cols).toContain("password");
    expect(cols).not.toContain("*");
  });

  it("marketing list select covers table fields without star projection", () => {
    const cols = MARKETING_LIST_SELECT.split(",").map((c) => c.trim());
    expect(cols).toContain("channel");
    expect(cols).toContain("agreed_fee");
    expect(cols).not.toContain("*");
  });
});
