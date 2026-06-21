import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** ponytail: static guard — deal delete RPC must not compare uuid columns to ::text. */
describe("deal delete RPC uuid comparisons", () => {
  const sql = readFileSync(
    resolve(
      import.meta.dirname,
      "../../supabase/migrations/20260621170000_fix_deal_delete_uuid_compare.sql",
    ),
    "utf8",
  );

  it("compares commissions.source_id as uuid", () => {
    expect(sql).toMatch(/c\.source_id = p_entity_id[^:]/);
    expect(sql).not.toMatch(/c\.source_id = p_entity_id::text/);
  });

  it("compares tasks.parent_id as uuid", () => {
    expect(sql).toMatch(/parent_id = p_entity_id[^:]/);
    expect(sql).not.toMatch(/parent_id = p_entity_id::text/);
  });

  it("keeps payment_records.source_id as text", () => {
    expect(sql).toMatch(/pr\.source_id = p_entity_id::text/);
  });
});
