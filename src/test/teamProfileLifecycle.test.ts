import { describe, expect, it } from "vitest";
import {
  archiveImplementerNameOnDeactivate,
  buildTeamProfileDeactivateUpdate,
  normalizeTeamDisplayName,
} from "@/lib/admin/teamProfileLifecycle";

describe("teamProfileLifecycle", () => {
  it("archives implementer name to free UNIQUE slot", () => {
    const archived = archiveImplementerNameOnDeactivate("Peter", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(archived).toBe("Peter__off__aaaaaaaa");
    expect(archived).not.toBe("Peter");
  });

  it("builds deactivate payload", () => {
    const payload = buildTeamProfileDeactivateUpdate("u1", "Maroš");
    expect(payload.active).toBe(false);
    expect(payload.implementer_name).toContain("Maroš__off__");
  });

  it("falls back display name to implementer", () => {
    expect(normalizeTeamDisplayName("", "Peter")).toBe("Peter");
    expect(normalizeTeamDisplayName("  Ján  ", "Peter")).toBe("Ján");
  });
});
