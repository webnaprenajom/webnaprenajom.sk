import { describe, expect, it } from "vitest";
import {
  buildNameEmailKey,
  normalizeEmail,
  normalizePhone,
  clientNameCompareKey,
} from "../../scripts/migration/lib/normalizeIdentity.js";
import {
  classifyDuplicateEmailGroups,
  duplicateEmailReviewItems,
  detectOrphanFkRisks as detectOrphanFk,
  detectSensitivePayloads as detectSensitive,
  isRealizedLeadStatus,
  shouldFlagForReview,
} from "../../scripts/migration/lib/matching.js";
import type { MigrationSourceDef } from "../../scripts/migration/lib/sources.js";
import type { StagedRow } from "../../scripts/migration/lib/types.js";

describe("migration normalizeIdentity", () => {
  it("normalizes email to lowercase trimmed", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });

  it("normalizes phone to digits-only key", () => {
    expect(normalizePhone("+421 905 601 881")).toBe("421905601881");
    expect(normalizePhone("123")).toBeNull();
  });

  it("builds name+email composite key", () => {
    expect(buildNameEmailKey("Karol Rosmány", "karol@design.sk")).toBe(
      "karol rosmány|karol@design.sk",
    );
    expect(buildNameEmailKey("", "a@b.com")).toBeNull();
  });

  it("collapses client name compare key", () => {
    expect(clientNameCompareKey("  Foo   Bar ")).toBe("foo bar");
  });
});

describe("migration matching helpers", () => {
  const lead = (id: string, email: string, status = "new"): StagedRow => ({
    sourceFile: "leads.csv",
    entityType: "lead",
    legacyId: id,
    rowHash: "abc",
    payload: { id, email, name: "Test", status },
  });

  const taskDef: MigrationSourceDef = {
    sourceFile: "tasks.csv",
    fileAliases: ["tasks.csv"],
    entityType: "task",
    legacyIdField: "id",
    kind: "entity",
    fkFields: [{ field: "lead_id", targetEntity: "lead", targetSourceFile: "leads.csv" }],
  };

  const projectDef: MigrationSourceDef = {
    sourceFile: "project_notes.csv",
    fileAliases: ["project_notes.csv"],
    entityType: "project_note",
    legacyIdField: "id",
    kind: "entity",
    sensitiveFields: ["username", "password"],
  };

  it("detects duplicate email groups", () => {
    const groups = classifyDuplicateEmailGroups([
      lead("1", "dup@x.com"),
      lead("2", "dup@x.com"),
      lead("3", "unique@x.com"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].legacyIds).toHaveLength(2);
  });

  it("classifies duplicate email as review", () => {
    const groups = classifyDuplicateEmailGroups([lead("1", "a@b.com"), lead("2", "a@b.com")]);
    const items = duplicateEmailReviewItems(groups);
    expect(items[0].reason).toBe("duplicate_email");
    expect(shouldFlagForReview(items[0])).toBe(true);
  });

  it("detects orphan lead_id on tasks", () => {
    const task: StagedRow = {
      sourceFile: "tasks.csv",
      entityType: "task",
      legacyId: "t1",
      rowHash: "x",
      payload: { id: "t1", lead_id: "missing-lead" },
    };
    const known = new Map([["leads.csv", new Set(["other-lead"])]]);
    const items = detectOrphanFk([task], taskDef, known);
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("orphan_fk");
  });

  it("flags sensitive project_notes credentials", () => {
    const row: StagedRow = {
      sourceFile: "project_notes.csv",
      entityType: "project_note",
      legacyId: "p1",
      rowHash: "h",
      payload: { id: "p1", username: "admin", password: "secret" },
    };
    const items = detectSensitive([row], projectDef);
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe("sensitive_payload");
  });

  it("recognizes realized lead statuses", () => {
    expect(isRealizedLeadStatus("won")).toBe(true);
    expect(isRealizedLeadStatus("order")).toBe(true);
    expect(isRealizedLeadStatus("new")).toBe(false);
  });
});
