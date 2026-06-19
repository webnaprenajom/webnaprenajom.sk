import { describe, expect, it } from "vitest";
import {
  buildTaskCreateHref,
  isOrphanTask,
  isValidTaskParentType,
  parseTaskParentFromSearchParams,
  taskParentDetailHref,
  taskParentKey,
  taskParentRequiredError,
} from "@/lib/tasks/taskParentModel";

describe("taskParentModel", () => {
  it("validates parent type and orphan state", () => {
    expect(isValidTaskParentType("project")).toBe(true);
    expect(isValidTaskParentType("lead")).toBe(false);
    expect(isOrphanTask({ parent_type: null, parent_id: null })).toBe(true);
    expect(isOrphanTask({ parent_type: "customer", parent_id: "c-1" })).toBe(false);
  });

  it("requires parent for new tasks", () => {
    expect(taskParentRequiredError("project", "p-1")).toBeNull();
    expect(taskParentRequiredError(null, null)).toBeTruthy();
  });

  it("builds detail hrefs and create links", () => {
    expect(taskParentDetailHref("project", "abc")).toBe("/admin/projects/abc");
    expect(buildTaskCreateHref({ parent_type: "hosting", parent_id: "h-1", label: "Host" })).toContain(
      "parentType=hosting",
    );
    expect(taskParentKey("rental", "r-1")).toBe("rental:r-1");
  });

  it("parses parent from URL search params", () => {
    const params = new URLSearchParams({
      parentType: "marketing",
      parentId: "m-9",
      parentLabel: "Kampaň",
    });
    expect(parseTaskParentFromSearchParams(params)).toEqual({
      parent_type: "marketing",
      parent_id: "m-9",
      label: "Kampaň",
    });
  });
});
