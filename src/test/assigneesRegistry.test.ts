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

  it("falls back to seed list when registry is empty", () => {
    const options = assigneeSelectOptions();
    expect(options).toContain("Peter");
    expect(options).toContain("Maroš");
  });

  it("treats registry names as known when registry is loaded", () => {
    expect(isKnownAssignee("Ján", ["Ján", "Peter"])).toBe(true);
    expect(isKnownAssignee("Legacy Guy", ["Ján"])).toBe(false);
  });

  it("falls back to seed when registry is empty", () => {
    expect(isKnownAssignee("Peter", [])).toBe(true);
    expect(isKnownAssignee("Ján", [])).toBe(false);
  });

  it("isRegistryImplementer is case-insensitive", () => {
    expect(isRegistryImplementer("peter", ["Peter"])).toBe(true);
  });
});
