import { describe, expect, it } from "vitest";
import { assigneeSelectOptions, isKnownAssignee, isRegistryImplementer } from "@/lib/assignees";

describe("assigneeSelectOptions registry rollout", () => {
  it("uses active registry when loaded, plus current legacy value for edit", () => {
    const options = assigneeSelectOptions("Legacy Guy", ["Ján", "Peter"]);
    expect(options).toContain("Ján");
    expect(options).toContain("Peter");
    expect(options).not.toContain("Maroš");
    expect(options).toContain("Legacy Guy");
  });

  it("falls back to seed list only when registry is not yet available", () => {
    const options = assigneeSelectOptions();
    expect(options).toContain("Peter");
    expect(options).toContain("Maroš");
  });

  it("does not resurrect seeds when registry loaded but empty (add/remove cycle)", () => {
    const withNew = assigneeSelectOptions(null, ["Nový"], null, true);
    expect(withNew).toEqual(["Nový"]);
    expect(withNew).not.toContain("Peter");

    const afterRemove = assigneeSelectOptions(null, [], null, true);
    expect(afterRemove).toEqual([]);
    expect(afterRemove).not.toContain("Peter");
    expect(afterRemove).not.toContain("Maroš");
    expect(afterRemove).not.toContain("Matuš");
  });

  it("keeps stored legacy value selectable when editing but not in live registry", () => {
    const options = assigneeSelectOptions("Peter", [], null, true);
    expect(options).toEqual(["Peter"]);
  });

  it("treats registry names as known when registry is loaded", () => {
    expect(isKnownAssignee("Ján", ["Ján", "Peter"])).toBe(true);
    expect(isKnownAssignee("Legacy Guy", ["Ján"])).toBe(false);
  });

  it("falls back to seed when registry is unavailable", () => {
    expect(isKnownAssignee("Peter", [])).toBe(true);
    expect(isKnownAssignee("Ján", [])).toBe(false);
  });

  it("unknown when registry ready but empty", () => {
    expect(isKnownAssignee("Peter", [], true)).toBe(false);
  });

  it("isRegistryImplementer is case-insensitive", () => {
    expect(isRegistryImplementer("peter", ["Peter"])).toBe(true);
  });
});
