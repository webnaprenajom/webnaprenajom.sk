import { describe, expect, it } from "vitest";
import {
  activeAssigneeOptions,
  buildHistoricalIdentityContext,
  formatActorLabel,
  formatImplementerLabel,
  HISTORICAL_ROLE_SUFFIX,
} from "@/lib/identity/historicalIdentity";
import { assigneeSelectOptions } from "@/lib/assignees";
import { archivedUserIdsFromRows } from "@/lib/admin/crmUserDirectory";

describe("historical identity", () => {
  const ctx = buildHistoricalIdentityContext({
    archives: [
      {
        user_id: "u-removed",
        email: "jan@firma.sk",
        display_name: "Ján Novák",
        historical_implementer_name: "Ján",
        removed_at: "2026-06-20T10:00:00Z",
        removed_by_user_id: "owner-1",
      },
    ],
    activeImplementerNames: ["Peter", "Maroš"],
  });

  it("marks archived implementer in business context", () => {
    expect(formatImplementerLabel("Ján", ctx)).toBe(`Ján ${HISTORICAL_ROLE_SUFFIX}`);
    expect(formatImplementerLabel("Peter", ctx)).toBe("Peter");
  });

  it("marks archived actor in history", () => {
    expect(formatActorLabel("u-removed", "jan@firma.sk", ctx)).toContain(HISTORICAL_ROLE_SUFFIX);
    expect(formatActorLabel("active-user", "owner@test.sk", ctx)).toBe("owner@test.sk");
  });

  it("excludes historical names from active assignee pickers", () => {
    const options = assigneeSelectOptions(null, ["Peter", "Ján", "Maroš"], ctx);
    expect(options).not.toContain("Ján");
    expect(options).toContain("Peter");
  });

  it("keeps current historical assignee on existing record forms", () => {
    const options = assigneeSelectOptions("Ján", ["Peter", "Maroš"], ctx);
    expect(options).toContain("Ján");
  });

  it("filters managed directory archived user ids", () => {
    const ids = archivedUserIdsFromRows([
      {
        user_id: "a",
        email: "",
        display_name: "A",
        historical_implementer_name: null,
        removed_at: "",
        removed_by_user_id: null,
      },
    ]);
    expect(ids.has("a")).toBe(true);
  });

  it("activeAssigneeOptions removes historical only", () => {
    expect(activeAssigneeOptions(["Peter", "Ján"], ctx)).toEqual(["Peter"]);
  });
});
