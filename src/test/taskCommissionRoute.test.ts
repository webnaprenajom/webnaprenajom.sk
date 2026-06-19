import { describe, expect, it } from "vitest";
import { sourceDetailHref } from "@/lib/commissionSource";

describe("task detail route wiring", () => {
  it("links commission source to /admin/tasks/:id", () => {
    const taskId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(sourceDetailHref("task", taskId)).toBe(`/admin/tasks/${taskId}`);
  });
});
